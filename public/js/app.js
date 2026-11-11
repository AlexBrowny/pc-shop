import { html, $, toast } from './util.js';
import {
  t, getLang, setLang, LANGS, categoryName,
} from './i18n.js';
import { actions, parseHash, go } from './router.js';
import {
  subscribe, cartCount, getCart, addToCart, setQty, clearCart, setPart, addStorage, resetBuild, getTheme, applyTheme,
} from './store.js';
import { getCategories } from './api.js';
import { errorState, loading } from './components.js';
import { icons, logoMark, catIcon } from './icons.js';
import {
  initMotion, pageEnter, bump, themeTransition,
} from './motion.js';
import { openSearch, initSearchHotkeys } from './search.js';
import { homePage } from './pages/home.js';
import { catalogPage } from './pages/catalog.js';
import { productPage } from './pages/product.js';
import { builderPage } from './pages/builder.js';
import { cartPage } from './pages/cart.js';
import { checkoutPage } from './pages/checkout.js';

const ROUTES = [
  { re: /^\/$/, page: homePage, nav: 'home' },
  { re: /^\/catalog$/, page: catalogPage, nav: 'catalog' },
  { re: /^\/product\/[^/]+$/, page: productPage, nav: 'catalog' },
  { re: /^\/builder$/, page: builderPage, nav: 'builder' },
  { re: /^\/cart$/, page: cartPage, nav: 'cart' },
  { re: /^\/checkout$/, page: checkoutPage, nav: 'cart' },
];

const NAV = [
  ['home', '/', icons.home], ['catalog', '/catalog', icons.grid], ['builder', '/builder', icons.cube],
];

const SB_KEY = 'pcm_sidebar';
const appEl = $('#app');
const sidebarEl = $('#sidebar');
const headerEl = $('#header');
const footerEl = $('#footer');
let routeToken = 0;
let currentPage = null;
let activeNav = 'home';
let activeCat = '';
let categories = [];
let lastCount = cartCount();

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

function setCollapsed(on) {
  document.body.classList.toggle('sb-collapsed', on);
  try { localStorage.setItem(SB_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}
try { setCollapsed(localStorage.getItem(SB_KEY) === '1'); } catch { /* ignore */ }

const closeDrawer = () => document.body.classList.remove('sb-open');

function renderSidebar() {
  sidebarEl.innerHTML = html`
    <a class="sb-logo" href="#/">${logoMark}<span class="sb-label"><b>PC Market</b><small>${t('brand.tagline')}</small></span></a>
    <nav class="sb-nav" aria-label="main">
      ${NAV.map(([key, path, icon]) => html`
        <a class="sb-link ${activeNav === key && !activeCat ? 'active' : ''}" href="#${path}" title="${t(`nav.${key}`)}">
          ${icon}<span class="sb-label">${t(`nav.${key}`)}</span>
          ${key === 'builder' ? html`<button class="sb-new" data-action="new-build" title="${t('nav.new_build')}" aria-label="${t('nav.new_build')}">${icons.plus}</button>` : ''}
        </a>`)}
    </nav>
    <div class="sb-group-title">${t('nav.categories')}</div>
    <nav class="sb-nav sb-cats" aria-label="categories">
      ${categories.map((c) => html`
        <a class="sb-link ${activeCat === c.key ? 'active' : ''}" href="#/catalog?cat=${c.key}" title="${categoryName(c)}">
          ${catIcon(c.key)}<span class="sb-label">${categoryName(c)}</span><small class="sb-count">${c.count}</small>
        </a>`)}
    </nav>
    <button class="sb-collapse" data-action="sb-toggle" title="${t('nav.collapse')}" aria-label="${t('nav.collapse')}">${icons.chevL}<span class="sb-label">${t('nav.collapse')}</span></button>`.toString();
}

function renderHeader() {
  const theme = document.documentElement.dataset.theme;
  const label = theme === 'dark' ? t('theme.light') : t('theme.dark');
  headerEl.innerHTML = html`
    <button class="icon-btn menu-btn" data-action="sb-open" aria-label="${t('nav.menu')}">${icons.menu}</button>
    <button class="search-btn" data-action="search" aria-label="${t('search.title')}">${icons.search}<span>${t('search.placeholder')}</span><kbd>${isMac ? '⌘' : 'Ctrl'} K</kbd></button>
    <div class="topbar-tools">
      <div class="seg" role="group" aria-label="language">
        ${LANGS.map((l) => html`<button data-action="lang" data-lang="${l}" class="${getLang() === l ? 'active' : ''}">${l.toUpperCase()}</button>`)}
      </div>
      <button class="icon-btn" data-action="theme" title="${label}" aria-label="${label}">${theme === 'dark' ? icons.sun : icons.moon}</button>
      <a class="cart-link ${activeNav === 'cart' ? 'active' : ''}" href="#/cart" aria-label="${t('nav.cart')}">${icons.cart}<span id="cart-count" class="badge">${cartCount()}</span></a>
      <a class="btn btn-primary top-cta" href="#/builder">${t('nav.start')} ${icons.arrow}</a>
    </div>`.toString();
  footerEl.innerHTML = html`
    <div class="footer-grid">
      <div class="logo">${logoMark}<span><b>PC Market</b><small>${t('footer.note')}</small></span></div>
      <div class="footer-links">
        ${NAV.map(([key, path]) => html`<a href="#${path}">${t(`nav.${key}`)}</a>`)}
        <a href="#/cart">${t('nav.cart')}</a>
      </div>
    </div>`.toString();
}

async function route() {
  currentPage?.unmount?.();
  currentPage = null;
  const token = ++routeToken;
  const { path, params } = parseHash();
  const match = ROUTES.find((r) => r.re.test(path)) ?? ROUTES[0];
  activeNav = match.nav;
  activeCat = path === '/catalog' ? (params.get('cat') ?? '') : '';
  closeDrawer();
  renderSidebar();
  renderHeader();
  appEl.innerHTML = loading().toString();
  try {
    const content = await match.page.render();
    if (token !== routeToken) return;
    appEl.innerHTML = content.toString();
    pageEnter(appEl);
    currentPage = match.page;
    match.page.mount?.(appEl);
  } catch {
    if (token === routeToken) appEl.innerHTML = errorState().toString();
  }
  if (token === routeToken) window.scrollTo({ top: 0, behavior: 'instant' });
}

// ───────── Действия оболочки ─────────
actions.lang = (el) => { setLang(el.dataset.lang); route(); };
actions.theme = () => {
  themeTransition();
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  renderHeader();
};
actions.search = () => openSearch();
actions['sb-toggle'] = () => setCollapsed(!document.body.classList.contains('sb-collapsed'));
actions['sb-open'] = () => document.body.classList.add('sb-open');
actions['new-build'] = (el, e) => { e.preventDefault(); e.stopPropagation(); resetBuild(); go('/builder'); };
actions['cart-add'] = (el) => { addToCart(Number(el.dataset.id)); toast(`${t('common.in_cart')} ✓`); };
actions.qty = (el) => {
  const id = Number(el.dataset.id);
  setQty(id, (getCart()[id] ?? 0) + Number(el.dataset.delta));
  if (parseHash().path === '/cart') route();
};
actions['cart-clear'] = () => { clearCart(); route(); };
actions['to-builder'] = (el) => {
  const id = Number(el.dataset.id);
  if (el.dataset.category === 'storage') addStorage(id);
  else setPart(el.dataset.category, id);
  toast(t('product.added_builder'));
  go('/builder');
};
$('#scrim').addEventListener('click', closeDrawer);

subscribe(() => {
  const badge = $('#cart-count');
  const count = cartCount();
  if (badge) {
    badge.textContent = count;
    if (count > lastCount) bump(badge);
  }
  lastCount = count;
});

applyTheme(getTheme());
window.addEventListener('hashchange', route);
initMotion();
initSearchHotkeys();
getCategories().then((c) => { categories = c; renderSidebar(); }).catch(() => {});
route();
