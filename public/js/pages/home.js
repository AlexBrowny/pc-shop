import { html, $, toast } from '../util.js';
import { t, fmtPrice, getLang } from '../i18n.js';
import {
  getCategories, getProducts, getGames, getPresets, evaluateBuild,
} from '../api.js';
import { productCard } from '../components.js';
import { icons, catIcon } from '../icons.js';
import { actions, go } from '../router.js';
import { loadBuild } from '../store.js';

const FEATURED = [
  'amd-ryzen-7-7800x3d', 'nvidia-geforce-rtx-4070-super-12gb', 'amd-radeon-rx-7800-xt-16gb', 'intel-core-i5-13400f',
  'samsung-990-pro-1tb', 'corsair-vengeance-32gb-2x16gb-ddr5-6000', 'corsair-4000d-airflow', 'nvidia-geforce-rtx-4060-8gb',
];

const state = { viewer: null, token: 0, themeHandler: null };

const presetCard = (p) => html`
  <button class="qs-card spot reveal" data-action="load-preset" data-key="${p.key}">
    <div class="qs-img"><img src="${p.image}" alt="" loading="lazy"><span class="qs-fps">${icons.gauge} ${t('qs.fps', { n: p.avgFps, res: p.resolution.replace('2160p', '4K') })}</span></div>
    <div class="qs-body">
      <b>${t(`qs.${p.key}`)}</b>
      <span class="qs-spec">${p.cpu.replace(/^AMD |^Intel /, '')} · ${p.gpu.replace(/^GeForce |^Radeon /, '').replace(/\s+\d+\s?GB$/i, '')} · ${p.ram} ${t('unit.gb')}</span>
      <span class="qs-price">${fmtPrice(p.total)}</span>
    </div>
  </button>`;

const heroBuild = (preset) => (preset ? html`
  <div class="build-card">
    <div class="bc-head"><span class="bc-ok">${icons.shield} ${t('home2.compatible')}</span><span class="bc-fps">${icons.gauge} ${preset.avgFps} FPS</span></div>
    <ul class="bc-parts">
      ${['cpu', 'gpu', 'ram'].map((cat) => {
    const part = preset.parts.find((x) => x.category === cat);
    return part ? html`<li><img src="${part.image}" alt=""><span>${part.name}</span><b>${fmtPrice(part.price_uzs)}</b></li>` : '';
  })}
    </ul>
    <div class="bc-total"><span>${t('home2.build_total')}</span><strong>${fmtPrice(preset.total)}</strong></div>
  </div>` : '');

export const homePage = {
  async render() {
    const [categories, products, games, presets] = await Promise.all([getCategories(), getProducts({ sort: 'name' }), getGames(), getPresets()]);
    const featured = FEATURED.map((slug) => products.find((p) => p.slug === slug)).filter(Boolean);
    const heroPreset = presets.find((p) => p.key === 'balanced') ?? presets[0];
    this.heroPreset = heroPreset;
    const collage = games.slice(0, 5);
    const lang = getLang();

    return html`
      <section class="hero2">
        <div class="hero2-text">
          <span class="eyebrow">${t('home.eyebrow')}</span>
          <h1>${t('home2.title_a')} <span class="grad">${t('home2.title_b')}</span></h1>
          <p>${t('home2.sub')}</p>
          <ul class="feat-list">
            <li><span class="ico-box">${icons.cube}</span>${t('home2.f1')}</li>
            <li><span class="ico-box">${icons.shield}</span>${t('home2.f2')}</li>
            <li><span class="ico-box">${icons.gauge}</span>${t('home2.f3')}</li>
            <li><span class="ico-box">${icons.coin}</span>${t('home2.f4')}</li>
          </ul>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/builder">${t('nav.start')} ${icons.arrow}</a>
            <a class="btn btn-lg" href="#/catalog">${t('home.cta_catalog')}</a>
          </div>
          <div class="hero-stats">
            <div><b data-count="${products.length}">0</b><span>${t('home.stat_products')}</span></div>
            <div><b data-count="${games.length}">0</b><span>${t('home.stat_games')}</span></div>
            <div><b data-count="${categories.length}">0</b><span>${t('home2.stat_cats')}</span></div>
          </div>
        </div>
        <div class="hero-viewport">
          <div class="floor" aria-hidden="true"></div>
          <img class="hero-fallback" src="${heroPreset?.image ?? '/img/products/corsair-4000d-airflow.svg'}" alt="">
          <div id="hero-3d" class="hero-3d"></div>
          <span class="drag-hint">${icons.rotate} ${t('home2.drag')}</span>
          ${heroBuild(heroPreset)}
        </div>
      </section>

      <div class="marquee" aria-hidden="true"><div class="marquee-track">${[...new Set(products.map((p) => p.brand))].flatMap((b) => [b, b]).map((b) => html`<span>${b}</span>`)}</div></div>

      <section class="bp qs reveal">
        <div class="bp-side">
          <h2>${t('qs.title')}</h2>
          <p class="muted">${t('qs.sub')}</p>
          <div class="dots" aria-hidden="true"></div>
          <a class="btn" href="#/builder">${t('qs.scratch')} ${icons.arrow}</a>
        </div>
        <div class="qs-cards bp-hatch">${presets.map(presetCard)}</div>
      </section>

      <div class="section-head reveal"><h2>${t('bento.title')}</h2><p class="muted">${t('bento.sub')}</p></div>
      <div class="bento">
        <article class="bento-card b-3d spot reveal">
          <img class="b-art" src="/img/products/corsair-4000d-airflow.svg" alt="" loading="lazy">
          <div class="b-text"><h3>${t('bento.b3d_t')}</h3><p>${t('bento.b3d_d')}</p></div>
        </article>
        <article class="bento-card b-compat spot reveal">
          <h3>${t('bento.compat_t')}</h3>
          <ul class="checks">
            ${[['bento.compat_socket', 'AM5'], ['bento.compat_mem', 'DDR5'], ['bento.compat_gpu', '267 mm'], ['bento.compat_cooler', '155 mm']].map(([k, v], i) => html`<li style="--i:${i}"><span class="ck">${icons.check}</span>${t(k)}<em>${v}</em></li>`)}
          </ul>
        </article>
        <article class="bento-card b-fps spot reveal">
          <div class="collage" aria-hidden="true">${collage.map((g, i) => html`<img src="${g.cover}" alt="" loading="lazy" style="--i:${i}">`)}</div>
          <div class="b-text"><h3>${t('bento.fps_t')}</h3><p>${t('bento.fps_d')}</p></div>
        </article>
        <article class="bento-card b-power spot reveal">
          <div class="power"><div class="power-ring">${icons.bolt}</div>
            <div class="power-meter"><div class="pm-row"><span>${t('bento.power_draw')}</span><b>311 ${t('unit.w')} / 850 ${t('unit.w')}</b></div><div class="meter"><i></i></div></div></div>
          <h3>${t('bento.power_t')}</h3>
        </article>
        <article class="bento-card b-small spot reveal"><span class="ico-box lg">${icons.coin}</span><h3>${t('bento.price_t')}</h3><p class="big-num">${lang === 'uz' ? "12 500 000 so'm" : '12 500 000 сум'}</p></article>
        <article class="bento-card b-small spot reveal"><span class="ico-box lg">${icons.receipt}</span><h3>${t('bento.pay_t')}</h3><p>${t('bento.pay_d')}</p></article>
        <article class="bento-card b-small spot reveal"><span class="ico-box lg">${icons.globe}</span><h3>${t('bento.lang_t')}</h3><p class="lang-pills"><span>RU</span><span>UZ</span></p></article>
      </div>

      <div class="section-head reveal"><h2>${t('home.popular')}</h2></div>
      <div class="grid">${featured.map(productCard)}</div>

      <section class="cta-band reveal">
        <h2>${t('home.cta_t')}</h2>
        <p>${t('home.cta_d')}</p>
        <a class="btn btn-primary btn-lg" href="#/builder">${t('nav.start')} ${icons.arrow}</a>
      </section>`;
  },

  /** Живая 3D-сборка в «герое». До готовности виден статичный рендер корпуса. */
  async mount(root) {
    const token = ++state.token;
    const preset = this.heroPreset;
    if (!preset) return;
    const slot = $('#hero-3d', root);
    try {
      const mod = await import('../viewer/viewer.js');
      if (token !== state.token) return;
      const viewer = mod.createViewer();
      if (!viewer) return;
      viewer.setTheme(document.documentElement.dataset.theme);
      viewer.setAutoRotate(true);
      const ev = await evaluateBuild(preset.ids, '1080p');
      if (token !== state.token) { viewer.dispose(); return; }
      await viewer.update(ev.parts);
      if (token !== state.token) { viewer.dispose(); return; }
      state.viewer = viewer;
      state.themeHandler = (e) => viewer.setTheme(e.detail);
      document.addEventListener('themechange', state.themeHandler);
      slot.appendChild(viewer.el);
      requestAnimationFrame(() => slot.classList.add('ready'));
    } catch { /* остаётся статичная картинка */ }
  },

  unmount() {
    state.token += 1;
    if (state.themeHandler) document.removeEventListener('themechange', state.themeHandler);
    state.themeHandler = null;
    state.viewer?.dispose();
    state.viewer = null;
  },
};

// Загрузка готовой сборки в конструктор
actions['load-preset'] = async (el) => {
  const presets = await getPresets();
  const preset = presets.find((p) => p.key === el.dataset.key);
  if (!preset) return;
  loadBuild(preset.ids);
  toast(t('qs.loaded'));
  go('/builder');
};

export { catIcon };
