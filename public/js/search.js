// Быстрый поиск (Ctrl/⌘+K или «/»): палитра команд по товарам и разделам.
import { html, $, esc } from './util.js';
import { t, fmtPrice, categoryName } from './i18n.js';
import { getProducts, getCategories } from './api.js';
import { icons, catIcon } from './icons.js';
import { go } from './router.js';

let catalog = null;
let open = null; // { el, close }

async function loadCatalog() {
  if (!catalog) {
    const [products, categories] = await Promise.all([getProducts({ sort: 'name' }), getCategories()]);
    catalog = { products, categories, byKey: new Map(categories.map((c) => [c.key, c])) };
  }
  return catalog;
}

const tokens = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (p, ts) => {
  const hay = `${p.brand} ${p.name}`.toLowerCase();
  return ts.every((tk) => hay.includes(tk));
};

export function closeSearch() {
  open?.close();
}

export async function openSearch() {
  if (open) return;
  const data = await loadCatalog();
  const backdrop = document.createElement('div');
  backdrop.className = 'cmdk-backdrop';
  backdrop.innerHTML = html`
    <div class="cmdk" role="dialog" aria-modal="true" aria-label="${t('search.title')}">
      <div class="cmdk-input">${icons.search}<input id="cmdk-q" type="search" autocomplete="off" placeholder="${t('search.placeholder')}" aria-label="${t('common.search')}"><kbd>Esc</kbd></div>
      <div class="cmdk-list" id="cmdk-list" role="listbox"></div>
    </div>`.toString();
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  const input = $('#cmdk-q', backdrop);
  const list = $('#cmdk-list', backdrop);
  let results = [];
  let active = 0;

  const draw = () => {
    const q = input.value.trim();
    const ts = tokens(q);
    const quick = [
      { href: '#/builder', label: t('nav.builder'), icon: icons.cube },
      { href: '#/catalog', label: t('nav.catalog'), icon: icons.grid },
      { href: '#/cart', label: t('nav.cart'), icon: icons.cart },
    ];
    const cats = data.categories.filter((c) => !ts.length || ts.every((tk) => categoryName(c).toLowerCase().includes(tk)));
    const prods = ts.length ? data.products.filter((p) => matches(p, ts)).slice(0, 8) : data.products.filter((p) => ['nvidia-geforce-rtx-4070-super-12gb', 'amd-ryzen-7-7800x3d', 'samsung-990-pro-1tb'].includes(p.slug));
    results = [
      ...(ts.length ? [] : quick.map((x) => ({ type: 'link', ...x }))),
      ...cats.slice(0, ts.length ? 3 : 0).map((c) => ({ type: 'link', href: `#/catalog?cat=${c.key}`, label: categoryName(c), icon: catIcon(c.key) })),
      ...prods.map((p) => ({ type: 'product', p, href: `#/product/${p.slug}` })),
    ];
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results.length
      ? results.map((r, i) => (r.type === 'link'
        ? html`<a class="cmdk-item ${i === active ? 'active' : ''}" role="option" href="${r.href}" data-i="${i}"><span class="cmdk-ico">${r.icon}</span><span>${r.label}</span>${icons.arrow}</a>`
        : html`<a class="cmdk-item ${i === active ? 'active' : ''}" role="option" href="${r.href}" data-i="${i}">
            <img src="${r.p.image}" alt="" loading="lazy">
            <span class="cmdk-name"><small>${r.p.brand} · ${categoryName(data.byKey.get(r.p.category))}</small>${r.p.name}</span>
            <b>${fmtPrice(r.p.price_uzs)}</b></a>`)).join('')
      : `<div class="cmdk-empty">${esc(t('common.nothing'))}</div>`;
    $('.cmdk-item.active', list)?.scrollIntoView({ block: 'nearest' });
  };

  const close = () => {
    backdrop.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey, true);
    open = null;
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); const { href } = results[active]; close(); go(href.slice(1)); }
  };
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', () => { active = 0; draw(); });
  list.addEventListener('click', (e) => { if (e.target.closest('.cmdk-item')) close(); });
  list.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.cmdk-item');
    if (item && Number(item.dataset.i) !== active) { active = Number(item.dataset.i); list.querySelectorAll('.cmdk-item').forEach((el, i) => el.classList.toggle('active', i === active)); }
  });
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  open = { el: backdrop, close };
  draw();
  input.focus();
}

export function initSearchHotkeys() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
    else if (e.key === '/' && !typing && !open) { e.preventDefault(); openSearch(); }
  });
}
