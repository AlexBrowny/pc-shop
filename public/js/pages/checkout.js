import { html, $, toast } from '../util.js';
import { t, fmtPrice, fmtNumber, getLang } from '../i18n.js';
import { getProducts, getConfig, createOrder } from '../api.js';
import { getCart, clearCart } from '../store.js';
import { actions } from '../router.js';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

const form = { file: null, fileError: '', method: 'receipt' };

const normalizePhone = (raw) => {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
};

const fmtSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} ${t('unit.mb')}` : `${Math.max(1, Math.round(bytes / 1024))} ${t('unit.kb')}`);

function paymentBlock(config, total) {
  const { card, holder, note_ru: noteRu, note_uz: noteUz } = config.payment;
  const note = getLang() === 'uz' ? noteUz : noteRu;
  if (!card) return html`<p class="muted">${t('checkout.no_payment')}</p>`;
  return html`
    <p>${t('checkout.pay_to', { sum: fmtPrice(total) })}</p>
    <div class="pay-card">
      <div><span class="muted small">${t('checkout.card')}</span><div class="pay-number">${card}</div></div>
      ${holder ? html`<div><span class="muted small">${t('checkout.holder')}</span><div>${holder}</div></div>` : ''}
      <button type="button" class="btn btn-sm" data-action="copy-card" data-card="${card}">${t('checkout.copy')}</button>
    </div>
    ${note ? html`<p class="muted small">${note}</p>` : ''}`;
}

function successView(order) {
  return html`
    <div class="card success">
      <div class="success-mark" aria-hidden="true">✓</div>
      <h1>${t('checkout.done_title', { id: order.id })}</h1>
      <p>${t('checkout.done_text', { phone: order.phone })}</p>
      <p class="muted">${t('checkout.done_total')}: <strong>${fmtPrice(order.total_uzs)}</strong></p>
      <a class="btn btn-primary" href="#/catalog">${t('cart.go_catalog')}</a>
    </div>`;
}

export const checkoutPage = {
  async render() {
    form.file = null;
    form.fileError = '';
    const cart = getCart();
    const ids = Object.keys(cart);
    if (!ids.length) {
      return html`<h1>${t('checkout.title')}</h1><div class="empty">${t('checkout.empty')}<a class="btn btn-primary" href="#/catalog">${t('cart.go_catalog')}</a></div>`;
    }
    const [products, config] = await Promise.all([getProducts({ ids: ids.join(',') }), getConfig()]);
    const lines = products.map((p) => ({ p, qty: cart[p.id] }));
    const total = lines.reduce((sum, l) => sum + l.p.price_uzs * l.qty, 0);
    this.state = { lines, total, config };
    const card = !!config.stripe?.enabled;
    form.method = card ? 'card' : 'receipt';
    const usd = card ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lines.reduce((sum, l) => sum + Math.max(1, Math.round((l.p.price_uzs / config.stripe.usdRate) * 100)) * l.qty, 0) / 100) : '';

    return html`
      <h1>${t('checkout.title')}</h1>
      <div id="checkout-root" class="checkout">
        <form id="checkout-form" class="card checkout-form" novalidate>
          <h2>${t('checkout.contacts')}</h2>
          <label class="field"><span>${t('checkout.name')}</span><input name="name" autocomplete="name" maxlength="80" required></label>
          <label class="field"><span>${t('checkout.phone')}</span><input name="phone" type="tel" autocomplete="tel" placeholder="+998 90 123 45 67" required></label>
          <label class="field"><span>${t('checkout.address')}</span><input name="address" autocomplete="street-address" maxlength="300"></label>
          <label class="field"><span>${t('checkout.comment')}</span><textarea name="comment" rows="2" maxlength="500"></textarea></label>

          <h2>${t('checkout.payment')}</h2>
          ${card ? html`
            <div class="pay-methods" role="radiogroup" aria-label="${t('checkout.pay_method')}">
              <label class="pay-method"><input type="radio" name="pay" value="card" data-change="pay-method" checked><span>${t('checkout.method_card')}</span></label>
              <label class="pay-method"><input type="radio" name="pay" value="receipt" data-change="pay-method"><span>${t('checkout.method_transfer')}</span></label>
            </div>
            <p id="pay-card-info" class="muted small">${t('checkout.card_hint', { usd, rate: fmtNumber(config.stripe.usdRate) })}</p>` : ''}
          <div id="pay-receipt" ${card ? 'hidden' : ''}>
          ${paymentBlock(config, total)}

          <div class="field">
            <span>${t('checkout.receipt')}</span>
            <label class="dropzone" id="dropzone">
              <input type="file" id="receipt" accept="image/png,image/jpeg,image/webp,application/pdf" data-change="receipt-file" hidden>
              <span class="btn btn-sm">${t('checkout.choose_file')}</span>
              <span id="file-name" class="muted">${t('checkout.no_file')}</span>
            </label>
            <small class="muted">${t('checkout.receipt_hint', { mb: config.receiptMaxMb })}</small>
            <img id="file-preview" class="file-preview" alt="" hidden>
          </div>
          </div>

          <p id="form-error" class="form-error" role="alert" hidden></p>
          <button type="submit" id="submit-btn" class="btn btn-primary">${card ? t('checkout.pay_card') : t('checkout.submit')}</button>
        </form>

        <aside class="card checkout-summary">
          <h3>${t('checkout.items')}</h3>
          <ul class="summary-lines">
            ${lines.map(({ p, qty }) => html`<li><span>${p.brand} ${p.name} <small class="muted">× ${qty}</small></span><span>${fmtNumber(p.price_uzs * qty)}</span></li>`)}
          </ul>
          <div class="row"><span>${t('common.total')}</span><strong class="price-lg">${fmtPrice(total)}</strong></div>
        </aside>
      </div>`;
  },

  mount(root) {
    const formEl = $('#checkout-form', root);
    if (!formEl) return;
    formEl.addEventListener('submit', (event) => {
      event.preventDefault();
      submit(root, formEl);
    });
    const zone = $('#dropzone', root);
    ['dragover', 'dragenter'].forEach((name) => zone.addEventListener(name, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((name) => zone.addEventListener(name, () => zone.classList.remove('drag')));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) setFile(root, file);
    });
  },
};

function setFile(root, file) {
  const maxBytes = (checkoutPage.state?.config.receiptMaxMb ?? 10) * 1024 * 1024;
  form.file = null;
  form.fileError = '';
  const preview = $('#file-preview', root);
  preview.hidden = true;
  if (!ALLOWED_TYPES.includes(file.type)) form.fileError = t('err.receipt_invalid_type');
  else if (file.size > maxBytes) form.fileError = t('err.file_too_large');
  else form.file = file;
  $('#file-name', root).textContent = form.file ? `${file.name} (${fmtSize(file.size)})` : t('checkout.no_file');
  if (form.file && file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  }
  showError(root, form.fileError);
}

function showError(root, message) {
  const el = $('#form-error', root);
  el.textContent = message;
  el.hidden = !message;
}

async function submit(root, formEl) {
  const data = new FormData(formEl);
  const name = String(data.get('name') ?? '').trim();
  const phone = normalizePhone(data.get('phone'));
  if (name.length < 2) return showError(root, t('err.invalid_name'));
  if (!phone) return showError(root, t('err.invalid_phone'));
  const card = form.method === 'card';
  if (!card && form.fileError) return showError(root, form.fileError);
  if (!card && !form.file) return showError(root, t('err.receipt_required'));
  showError(root, '');

  const { lines } = checkoutPage.state;
  const body = new FormData();
  body.set('name', name);
  body.set('phone', phone);
  body.set('address', String(data.get('address') ?? ''));
  body.set('comment', String(data.get('comment') ?? ''));
  body.set('lang', document.documentElement.lang === 'uz' ? 'uz' : 'ru');
  body.set('items', JSON.stringify(lines.map(({ p, qty }) => ({ id: p.id, qty }))));
  if (card) body.set('payment_method', 'stripe');
  else body.set('receipt', form.file, form.file.name);

  const btn = $('#submit-btn', root);
  btn.disabled = true;
  btn.textContent = card ? t('checkout.redirecting') : t('checkout.sending');
  try {
    const order = await createOrder(body);
    if (card) {
      // корзина очистится на странице «Оплата прошла»: если покупатель вернётся без оплаты, товары останутся
      window.location.assign(order.checkout_url);
      return undefined;
    }
    clearCart();
    $('#checkout-root', root).outerHTML = successView({ ...order, phone }).toString();
  } catch (err) {
    const key = `err.${err.code}`;
    const known = t(key) !== key;
    showError(root, known ? t(key, { product: err.details?.product ?? '' }) : t('err.generic'));
    btn.disabled = false;
    btn.textContent = card ? t('checkout.pay_card') : t('checkout.submit');
  }
  return undefined;
}

actions['pay-method'] = (el) => {
  form.method = el.value === 'receipt' ? 'receipt' : 'card';
  const card = form.method === 'card';
  $('#pay-receipt').hidden = card;
  $('#pay-card-info').hidden = !card;
  $('#submit-btn').textContent = card ? t('checkout.pay_card') : t('checkout.submit');
  showError(document, '');
};

actions['receipt-file'] = (el) => {
  const file = el.files?.[0];
  if (file) setFile(document, file);
};

actions['copy-card'] = async (el) => {
  try {
    await navigator.clipboard.writeText(el.dataset.card);
    toast(t('checkout.copied'));
  } catch { /* буфер обмена недоступен */ }
};
