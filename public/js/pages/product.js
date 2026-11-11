import { html } from '../util.js';
import { t, fmtPrice, specRows, categoryName } from '../i18n.js';
import { getProduct, getCategories } from '../api.js';
import { parseHash } from '../router.js';
import { icons } from '../icons.js';

export const productPage = {
  async render() {
    const slug = parseHash().path.split('/')[2];
    let product;
    try {
      product = await getProduct(slug);
    } catch {
      return html`<div class="empty">${t('product.not_found')} <a href="#/catalog">${t('cart.go_catalog')}</a></div>`;
    }
    const cat = (await getCategories()).find((c) => c.key === product.category);

    return html`
      <nav class="crumbs"><a href="#/catalog">${t('catalog.title')}</a> / <a href="#/catalog?cat=${product.category}">${categoryName(cat)}</a></nav>
      <div class="product">
        <div class="product-img card spot"><img src="${product.image}" alt="${product.brand} ${product.name}"></div>
        <div class="product-info">
          <div class="brand">${product.brand}</div>
          <h1>${product.name}</h1>
          <div class="price price-lg">${fmtPrice(product.price_uzs)}</div>
          <p class="stock-line">${product.stock > 0 ? html`${icons.check} ${t('common.stock_n', { n: product.stock })}` : ''}</p>
          <div class="actions">
            <button class="btn btn-primary" data-action="cart-add" data-id="${product.id}">${icons.cart} ${t('common.add_to_cart')}</button>
            <button class="btn btn-ghost" data-action="to-builder" data-id="${product.id}" data-category="${product.category}">${icons.cube} ${t('product.to_builder')}</button>
          </div>
          <h3>${t('common.specs')}</h3>
          <table class="spec-table"><tbody>
            ${specRows(product).map((r) => html`<tr><th>${r.label}</th><td>${r.value}</td></tr>`)}
          </tbody></table>
        </div>
      </div>`;
  },
};
