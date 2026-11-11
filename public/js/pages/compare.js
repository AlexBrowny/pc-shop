// Сравнение товаров одной категории (до 4): характеристики в строках, отличия подсвечиваются.
import { html, $ } from '../util.js';
import { t, fmtPrice, specRows } from '../i18n.js';
import { getProducts } from '../api.js';
import { getCompare, clearCompare } from '../store.js';
import { actions } from '../router.js';
import { stars } from '../components.js';
import { icons } from '../icons.js';

const state = { onlyDiff: false, products: [] };

function table() {
  const { products } = state;
  const perProduct = products.map((p) => new Map(specRows(p).map((r) => [r.label, r.value])));
  const labels = [...new Set(perProduct.flatMap((m) => [...m.keys()]))];
  const rows = labels
    .map((label) => {
      const values = perProduct.map((m) => m.get(label) ?? '—');
      return { label, values, differs: new Set(values.map(String)).size > 1 };
    })
    .filter((r) => !state.onlyDiff || r.differs);

  const cheapest = Math.min(...products.map((p) => p.price_uzs));
  return html`
    <div class="cmp-scroll">
      <table class="cmp-table">
        <thead>
          <tr>
            <th></th>
            ${products.map((p) => html`
              <th>
                <a class="cmp-prod" href="#/product/${p.slug}"><img src="${p.image}" alt="" loading="lazy"><b>${p.brand}</b><span>${p.name}</span></a>
                <button class="btn btn-ghost btn-sm" data-action="compare-remove" data-id="${p.id}" aria-label="${t('common.remove')}">${icons.close}</button>
              </th>`)}
          </tr>
          <tr class="cmp-price">
            <th>${t('common.price')}</th>
            ${products.map((p) => html`<td class="${p.price_uzs === cheapest && products.length > 1 ? 'best' : ''}"><b>${fmtPrice(p.price_uzs)}</b></td>`)}
          </tr>
          <tr>
            <th>${t('reviews.title')}</th>
            ${products.map((p) => html`<td>${p.rating_count ? html`${stars(p.rating_avg)} <small class="muted">${p.rating_avg.toFixed(1)} (${p.rating_count})</small>` : html`<span class="muted">—</span>`}</td>`)}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => html`<tr class="${r.differs ? 'diff' : ''}"><th>${r.label}</th>${r.values.map((v) => html`<td>${v}</td>`)}</tr>`)}
        </tbody>
        <tfoot>
          <tr>
            <th></th>
            ${products.map((p) => html`<td><button class="btn btn-primary btn-sm" data-action="cart-add" data-id="${p.id}">${icons.cart} ${t('common.add_to_cart')}</button></td>`)}
          </tr>
        </tfoot>
      </table>
    </div>`;
}

export const comparePage = {
  async render() {
    const ids = getCompare().map((c) => c.id);
    if (!ids.length) {
      state.products = [];
      return html`<h1>${t('compare.title')}</h1><div class="empty">${t('compare.empty')}<a class="btn btn-primary" href="#/catalog">${t('cart.go_catalog')}</a></div>`;
    }
    const found = await getProducts({ ids: ids.join(',') });
    state.products = ids.map((id) => found.find((p) => p.id === id)).filter(Boolean);
    return html`
      <div class="acc-top">
        <h1>${t('compare.title')}</h1>
        <div class="cmp-tools">
          <label class="check"><input type="checkbox" id="cmp-diff" data-change="compare-diff" ${state.onlyDiff ? 'checked' : ''}> ${t('compare.only_diff')}</label>
          <button class="btn btn-ghost btn-sm" data-action="compare-clear">${icons.trash} ${t('compare.clear')}</button>
        </div>
      </div>
      <div id="cmp-root">${table()}</div>`;
  },
};

actions['compare-diff'] = (el) => {
  state.onlyDiff = el.checked;
  $('#cmp-root').innerHTML = table().toString();
};
