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

export const productCard = (p) => html`
  <article class="card product-card spot reveal">
    <a class="card-img" href="#/product/${p.slug}" aria-label="${p.brand} ${p.name}">
      <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy" width="400" height="300">
      ${p.stock > 0 ? html`<span class="stock-tag ${p.stock <= LOW_STOCK ? 'low' : ''}">${p.stock <= LOW_STOCK ? t('common.stock_low', { n: p.stock }) : t('common.stock_ok')}</span>` : ''}
    </a>
    <div class="card-body">
      <div class="brand">${p.brand}</div>
      <a class="card-title" href="#/product/${p.slug}">${p.name}</a>
      ${p.rating_count ? html`<div class="card-rating">${stars(p.rating_avg)}<small class="muted">${p.rating_avg.toFixed(1)} · ${p.rating_count}</small></div>` : ''}
      <ul class="chips">${keySpecs(p).map((s) => html`<li>${s}</li>`)}</ul>
      <div class="card-foot">
        <div class="price">${fmtPrice(p.price_uzs)}</div>
        <button class="btn btn-primary btn-sm" data-action="cart-add" data-id="${p.id}">${icons.cart}<span>${t('common.add_to_cart')}</span></button>
      </div>
      ${compareButton(p)}
    </div>
  </article>`;

export const emptyState = (text) => html`<div class="empty">${text}</div>`;

/** Скелетон-карточки на время загрузки. */
export const skeletonGrid = (n = 8) => html`
  <div class="grid">${Array.from({ length: n }, () => html`<div class="sk-card"><div class="skeleton"></div><div class="sk-lines"><div class="skeleton"></div><div class="skeleton"></div></div></div>`)}</div>`;

export const loading = () => skeletonGrid(8);
export const errorState = () => html`<div class="empty error">${t('common.error')}</div>`;
