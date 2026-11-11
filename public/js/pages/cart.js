import { html } from '../util.js';
import { t, fmtPrice } from '../i18n.js';
import { getProducts } from '../api.js';
import { getCart } from '../store.js';
import { icons } from '../icons.js';

export const cartPage = {
  async render() {
    const cart = getCart();
    const ids = Object.keys(cart);
    if (!ids.length) {
      return html`<h1>${t('cart.title')}</h1><div class="empty">${t('cart.empty')}<br><a class="btn btn-primary" href="#/catalog">${t('cart.go_catalog')}</a></div>`;
    }
    const products = await getProducts({ ids: ids.join(',') });
    const lines = products.map((p) => ({ p, qty: cart[p.id] }));
    const total = lines.reduce((sum, l) => sum + l.p.price_uzs * l.qty, 0);

    return html`
      <h1>${t('cart.title')}</h1>
      <div class="cart">
        <div class="cart-lines">
          ${lines.map(({ p, qty }) => html`
            <div class="card cart-line reveal">
              <img src="${p.image}" alt="">
              <div class="cart-name"><div class="brand">${p.brand}</div><a href="#/product/${p.slug}">${p.name}</a></div>
              <div class="qty">
                <button class="btn btn-sm" data-action="qty" data-id="${p.id}" data-delta="-1" aria-label="−">−</button>
                <span>${qty}</span>
                <button class="btn btn-sm" data-action="qty" data-id="${p.id}" data-delta="1" aria-label="+">+</button>
              </div>
              <div class="price">${fmtPrice(p.price_uzs * qty)}</div>
              <button class="btn btn-sm btn-ghost" data-action="qty" data-id="${p.id}" data-delta="-99" aria-label="${t('common.remove')}">${icons.trash}</button>
            </div>`)}
        </div>
        <aside class="card cart-summary">
          <div class="row"><span>${t('common.total')}</span><strong class="price-lg">${fmtPrice(total)}</strong></div>
          <a class="btn btn-primary btn-lg" href="#/checkout">${t('cart.checkout')} ${icons.arrow}</a>
          <button class="btn btn-ghost btn-sm" data-action="cart-clear">${t('cart.clear')}</button>
        </aside>
      </div>`;
  },
};
