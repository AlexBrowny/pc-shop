import {
  html, $, $$, api, toast, openModal, fmtUzs, fmtDate, STATUS_LABEL, PAYMENT_STATUS_LABEL, TG_LABEL, errorText, ApiError,
} from '/admin/common.js';

const STATUSES = Object.keys(STATUS_LABEL);
const REFRESH_MS = 30_000;

const badge = (kind, text) => html`<span class="badge ${kind}">${text}</span>`;

export async function ordersView(main) {
  const state = { status: '', q: '' };
  const stats = await api('/stats');

  main.innerHTML = html`
    <div class="stats">
      ${STATUSES.map((s) => html`<button class="stat ${s}" data-status="${s}"><b>${stats.byStatus[s]}</b><span>${STATUS_LABEL[s]}</span></button>`)}
      <div class="stat revenue"><b>${fmtUzs(stats.revenue)}</b><span>Оплаченные заказы</span></div>
    </div>
    <div class="toolbar">
      <select id="f-status" aria-label="Статус"><option value="">Все статусы</option>${STATUSES.map((s) => html`<option value="${s}">${STATUS_LABEL[s]}</option>`)}</select>
      <input id="f-q" type="search" placeholder="№ заказа, имя или телефон" aria-label="Поиск">
    </div>
    <div class="table-wrap"><table class="table" id="orders-table"></table></div>`.toString();

  const load = async () => {
    const params = new URLSearchParams();
    if (state.status) params.set('status', state.status);
    if (state.q) params.set('q', state.q);
    const rows = await api(`/orders?${params}`);
    $('#orders-table', main).innerHTML = html`
      <thead><tr><th>№</th><th>Дата</th><th>Клиент</th><th>Телефон</th><th>Сумма</th><th>Статус</th><th>Telegram</th><th></th></tr></thead>
      <tbody>
        ${rows.map((o) => html`
          <tr>
            <td>#${o.id}</td><td>${fmtDate(o.created_at)}</td><td>${o.customer_name}</td><td>${o.phone}</td>
            <td class="num">${fmtUzs(o.total_uzs)}</td>
            <td>${badge(o.status, STATUS_LABEL[o.status])}</td>
            <td>${badge(`tg-${o.telegram_status}`, TG_LABEL[o.telegram_status])}</td>
            <td><button class="btn small" data-open="${o.id}">Открыть</button></td>
          </tr>`)}
        ${rows.length ? '' : html`<tr><td colspan="8" class="muted center">Заказов нет</td></tr>`}
      </tbody>`.toString();
  };

  $('#f-status', main).addEventListener('change', (e) => { state.status = e.target.value; load(); });
  let timer;
  $('#f-q', main).addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 250);
  });
  main.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) openOrder(Number(open.dataset.open), load);
    const stat = e.target.closest('.stat[data-status]');
    if (stat) { $('#f-status', main).value = stat.dataset.status; state.status = stat.dataset.status; load(); }
  });

  await load();
  const interval = setInterval(() => { if (!document.querySelector('.modal-backdrop')) load().catch(() => {}); }, REFRESH_MS);
  return { stop: () => clearInterval(interval) };
}

async function openOrder(id, reload) {
  const order = await api(`/orders/${id}`);
  const isPdf = order.receipt_mime === 'application/pdf';
  const isCard = order.payment_method === 'stripe';
  const paidSum = order.paid_amount != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: String(order.paid_currency || 'usd').toUpperCase() }).format(order.paid_amount / 100) : '';
  const receiptUrl = `/api/admin/orders/${id}/receipt`;
  const locked = order.status === 'cancelled';
  const modal = openModal(`Заказ №${order.id}`, html`
    <div class="order-grid">
      <section>
        <dl class="kv">
          <dt>Клиент</dt><dd>${order.customer_name}</dd>
          <dt>Телефон</dt><dd><a href="tel:${order.phone}">${order.phone}</a></dd>
          <dt>Адрес</dt><dd>${order.address || '—'}</dd>
          <dt>Комментарий</dt><dd>${order.comment || '—'}</dd>
          <dt>Язык клиента</dt><dd>${order.lang === 'uz' ? "O'zbekcha" : 'Русский'}</dd>
          <dt>Оплата</dt><dd>${PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}${paidSum ? ` · ${paidSum}` : ''}</dd>
          <dt>Создан</dt><dd>${fmtDate(order.created_at)}</dd>
          <dt>Telegram</dt><dd>${badge(`tg-${order.telegram_status}`, TG_LABEL[order.telegram_status])}
            ${order.telegram_error ? html`<div class="form-error small">${order.telegram_error}</div>` : ''}
            <button class="btn small" id="resend">Отправить в Telegram повторно</button></dd>
        </dl>
        <table class="table compact">
          <thead><tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead>
          <tbody>${order.items.map((i) => html`<tr><td>${i.brand} ${i.name}</td><td>${i.qty}</td><td class="num">${fmtUzs(i.price_uzs)}</td><td class="num">${fmtUzs(i.price_uzs * i.qty)}</td></tr>`)}</tbody>
          <tfoot><tr><th colspan="3">Итого</th><th class="num">${fmtUzs(order.total_uzs)}</th></tr></tfoot>
        </table>
        <label class="field"><span>Статус</span>
          <select id="o-status" ${locked ? 'disabled' : ''}>${STATUSES.map((s) => html`<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`)}</select>
          ${locked ? html`<small class="muted">Заказ отменён, товар возвращён на склад. Изменить статус нельзя.</small>` : html`<small class="muted">«Отменён» возвращает товар на склад.</small>`}
        </label>
        <label class="field"><span>Заметка (видна только вам)</span><textarea id="o-note" rows="3" maxlength="1000">${order.admin_note ?? ''}</textarea></label>
        <button class="btn primary" id="o-save">Сохранить</button>
      </section>
      <section>
        ${isCard ? html`
        <h3>Оплата картой (Stripe)</h3>
        <p>${PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}${paidSum ? html` — <strong>${paidSum}</strong>` : ''}</p>
        ${order.stripe_payment_intent ? html`<p><a class="btn" href="https://dashboard.stripe.com/payments/${order.stripe_payment_intent}" target="_blank" rel="noopener">Открыть платёж в Stripe</a></p>` : ''}
        <p class="muted small">Чека нет: платёж подтверждён Stripe автоматически.</p>` : html`
        <h3>Чек об оплате</h3>
        ${isPdf
          ? html`<p><a class="btn" href="${receiptUrl}" target="_blank" rel="noopener">Открыть PDF</a></p><p class="muted small">${order.receipt_name || ''}</p>`
          : html`<a href="${receiptUrl}" target="_blank" rel="noopener"><img class="receipt" src="${receiptUrl}" alt="Чек к заказу №${order.id}"></a>`}`}
      </section>
    </div>`, { wide: true });

  $('#o-save', modal.el).addEventListener('click', async () => {
    try {
      const body = { admin_note: $('#o-note', modal.el).value };
      if (!locked) body.status = $('#o-status', modal.el).value;
      await api(`/orders/${id}`, { method: 'PATCH', json: body });
      toast('Сохранено');
      modal.close();
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? errorText(err.code) : 'Ошибка', 'err');
    }
  });
  $('#resend', modal.el).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const result = await api(`/orders/${id}/resend-telegram`, { method: 'POST', json: {} });
      toast(result.status === 'sent' ? 'Отправлено в Telegram' : (result.error ?? TG_LABEL[result.status]), result.status === 'sent' ? 'ok' : 'err');
      modal.close();
      reload();
    } catch {
      toast('Ошибка отправки', 'err');
      e.target.disabled = false;
    }
  });
  $$('img.receipt', modal.el).forEach((img) => img.addEventListener('error', () => { img.alt = 'Файл чека недоступен'; }));
}
