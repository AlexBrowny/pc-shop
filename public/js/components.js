import { html } from './util.js';
import { t, fmtPrice, keySpecs } from './i18n.js';
import { icons } from './icons.js';

const LOW_STOCK = 5;

export const productCard = (p) => html`
  <article class="card product-card spot reveal">
    <a class="card-img" href="#/product/${p.slug}" aria-label="${p.brand} ${p.name}">
      <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy" width="400" height="300">
      ${p.stock > 0 ? html`<span class="stock-tag ${p.stock <= LOW_STOCK ? 'low' : ''}">${p.stock <= LOW_STOCK ? t('common.stock_low', { n: p.stock }) : t('common.stock_ok')}</span>` : ''}
    </a>
    <div class="card-body">
      <div class="brand">${p.brand}</div>
      <a class="card-title" href="#/product/${p.slug}">${p.name}</a>
      <ul class="chips">${keySpecs(p).map((s) => html`<li>${s}</li>`)}</ul>
      <div class="card-foot">
        <div class="price">${fmtPrice(p.price_uzs)}</div>
        <button class="btn btn-primary btn-sm" data-action="cart-add" data-id="${p.id}">${icons.cart}<span>${t('common.add_to_cart')}</span></button>
      </div>
    </div>
  </article>`;

export const emptyState = (text) => html`<div class="empty">${text}</div>`;

/** Скелетон-карточки на время загрузки. */
export const skeletonGrid = (n = 8) => html`
  <div class="grid">${Array.from({ length: n }, () => html`<div class="sk-card"><div class="skeleton"></div><div class="sk-lines"><div class="skeleton"></div><div class="skeleton"></div></div></div>`)}</div>`;

export const loading = () => skeletonGrid(8);
export const errorState = () => html`<div class="empty error">${t('common.error')}</div>`;
