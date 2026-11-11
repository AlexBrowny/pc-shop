// Страница возврата из Stripe Checkout: проверяет результат оплаты и показывает итог.
import { html, $ } from '../util.js';
import { t, fmtPrice } from '../i18n.js';
import { getStripeSession } from '../api.js';
import { clearCart } from '../store.js';
import { parseHash } from '../router.js';

const POLL_MS = 3000;
const POLL_MAX = 8; // вебхук обычно приходит за секунды; ждём до ~25 с

const sessionIdOf = () => parseHash().path.split('/')[2];

function view(order) {
  if (!order) {
    return html`<div class="card success"><h1>${t('paid.fail_title')}</h1><p>${t('paid.not_found')}</p><a class="btn btn-primary" href="#/checkout">${t('paid.back')}</a></div>`;
  }
  if (order.payment_status === 'paid') {
    return html`
      <div class="card success">
        <div class="success-mark" aria-hidden="true">✓</div>
        <h1>${t('paid.ok_title', { id: order.id })}</h1>
        <p>${t('paid.ok_text', { phone: order.phone })}</p>
        <p class="muted">${t('checkout.done_total')}: <strong>${fmtPrice(order.total_uzs)}</strong></p>
        <a class="btn btn-primary" href="#/catalog">${t('cart.go_catalog')}</a>
      </div>`;
  }
  if (order.payment_status === 'awaiting') {
    return html`<div class="card success"><h1>${t('paid.wait_title')}</h1><p class="muted">${t('paid.wait_text')}</p></div>`;
  }
  return html`
    <div class="card success">
      <h1>${t('paid.fail_title')}</h1>
      <p>${t('paid.fail_text', { id: order.id })}</p>
      <a class="btn btn-primary" href="#/checkout">${t('paid.back')}</a>
    </div>`;
}

async function load() {
  try {
    return await getStripeSession(sessionIdOf());
  } catch {
    return null;
  }
}

export const paidPage = {
  timer: null,

  async render() {
    const order = await load();
    if (order?.payment_status === 'paid') clearCart();
    this.order = order;
    return html`<div id="paid-root">${view(order)}</div>`;
  },

  mount(root) {
    let tries = 0;
    const tick = async () => {
      if (this.order?.payment_status !== 'awaiting' || tries >= POLL_MAX) return;
      tries += 1;
      this.timer = setTimeout(async () => {
        this.order = await load();
        if (this.order?.payment_status === 'paid') clearCart();
        const el = $('#paid-root', root);
        if (el) el.innerHTML = view(this.order).toString();
        tick();
      }, POLL_MS);
    };
    tick();
  },

  unmount() {
    clearTimeout(this.timer);
  },
};
