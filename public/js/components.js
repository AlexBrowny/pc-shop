import { html, raw } from './util.js';
import { t, fmtPrice, keySpecs } from './i18n.js';
import { icons } from './icons.js';
import { inCompare } from './store.js';

const LOW_STOCK = 5;

/** Звёзды рейтинга: заливка пропорциональна оценке (0–5). */
export const stars = (avg, size = 14) => {
  const pct = Math.max(0, Math.min(5, avg)) * 20;
  return raw(`<span class="stars" style="--pct:${pct}%;--size:${size}px" role="img" aria-label="${avg.toFixed(1)} / 5"></span>`);
};

export const compareButton = (p) => html`
  <button class="cmp-btn ${inCompare(p.id) ? 'on' : ''}" data-action="compare-toggle" data-id="${p.id}" data-category="${p.category}"
    aria-pressed="${inCompare(p.id)}" title="${inCompare(p.id) ? t('compare.in') : t('compare.add')}">${icons.compare}<span>${inCompare(p.id) ? t('compare.in') : t('compare.add')}</span></button>`;

/** Настоящее фото (PNG/JPG/WEBP) показываем на светлой подложке как на маркетплейсах; иллюстрации — на тёмной. */
export const isPhoto = (src) => !String(src ?? '').endsWith('.svg');

/** Круглая кнопка «сравнить» на фото карточки. */
export const compareFab = (p) => html`
  <button class="cmp-fab ${inCompare(p.id) ? 'on' : ''}" data-action="compare-toggle" data-id="${p.id}" data-category="${p.category}"
    aria-pressed="${inCompare(p.id)}" title="${inCompare(p.id) ? t('compare.in') : t('compare.add')}" aria-label="${t('compare.add')}">${icons.compare}</button>`;

export const productCard = (p) => html`
  <article class="card product-card mk reveal">
    <div class="mk-media ${isPhoto(p.image) ? 'is-photo' : ''} ${p.image2 ? 'has-alt' : ''}">
      <a class="mk-link" href="#/product/${p.slug}" aria-label="${p.brand} ${p.name}">
        <img class="mk-img" src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy" width="400" height="300">
        ${p.image2 ? html`<img class="mk-img mk-alt" src="${p.image2}" alt="" loading="lazy" width="400" height="300">` : ''}
      </a>
      ${p.stock > 0 ? '' : html`<span class="mk-flag out">${t('common.out_of_stock')}</span>`}
      ${p.stock > 0 && p.stock <= LOW_STOCK ? html`<span class="mk-flag low">${t('common.stock_low', { n: p.stock })}</span>` : ''}
      ${compareFab(p)}
      ${p.image2 ? html`<span class="mk-dots" aria-hidden="true"><i class="on"></i><i></i></span>` : ''}
    </div>
    <div class="card-body mk-body">
      <div class="mk-price">${fmtPrice(p.price_uzs)}</div>
      <a class="mk-title" href="#/product/${p.slug}"><b>${p.brand}</b> ${p.name}</a>
      ${p.rating_count ? html`<div class="card-rating">${stars(p.rating_avg)}<small class="muted">${p.rating_avg.toFixed(1)} · ${p.rating_count}</small></div>` : html`<div class="card-rating"><small class="muted">${p.stock > 0 ? t('common.stock_ok') : ''}</small></div>`}
      <ul class="chips">${keySpecs(p).slice(0, 3).map((s) => html`<li>${s}</li>`)}</ul>
      <button class="btn btn-primary mk-buy" data-action="cart-add" data-id="${p.id}" ${p.stock > 0 ? '' : 'disabled'}>${icons.cart}<span>${t('common.add_to_cart')}</span></button>
    </div>
  </article>`;

export const emptyState = (text) => html`<div class="empty">${text}</div>`;

/** Скелетон-карточки на время загрузки. */
export const skeletonGrid = (n = 8) => html`
  <div class="grid">${Array.from({ length: n }, () => html`<div class="sk-card"><div class="skeleton"></div><div class="sk-lines"><div class="skeleton"></div><div class="skeleton"></div></div></div>`)}</div>`;

export const loading = () => skeletonGrid(8);
export const errorState = () => html`<div class="empty error">${t('common.error')}</div>`;
