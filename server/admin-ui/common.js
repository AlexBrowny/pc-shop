// Общие помощники админки: экранирование, API-клиент, модальные окна, уведомления.
// Внимание: CSP админки запрещает inline-стили и скрипты, поэтому весь внешний вид — в admin.css.

class Safe {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const render = (v) => {
  if (v instanceof Safe) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
};
export const raw = (s) => new Safe(s);
export const html = (strings, ...values) => new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? render(values[i]) : ''), ''));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export class UnauthorizedError extends Error {}
export class ApiError extends Error {
  constructor(code, fields) {
    super(code);
    this.code = code;
    this.fields = fields ?? {};
  }
}

export async function api(path, { method = 'GET', json, form } = {}) {
  const headers = { 'X-Admin-CSRF': '1' };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }
  const res = await fetch(`/api/admin${path}`, { method, headers, body, credentials: 'same-origin' });
  if (res.status === 401) throw new UnauthorizedError();
  let data = null;
  try { data = await res.json(); } catch { /* не JSON */ }
  if (!res.ok || !data?.success) throw new ApiError(data?.error ?? `http_${res.status}`, data?.fields);
  return data.data;
}

export const fmtUzs = (n) => `${new Intl.NumberFormat('ru-RU').format(n).replace(/[  ]/g, ' ')} сум`;
export const fmtDate = (ts) => {
  const sqlTs = String(ts);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(sqlTs) ? sqlTs : `${sqlTs.replace(' ', 'T')}Z`); // ISO из Postgres либо «2026-11-08 12:00:00»
  return Number.isNaN(d.getTime()) ? sqlTs : d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
};

export const STATUS_LABEL = { pending: 'Ждёт оплаты', new: 'Новый', paid: 'Оплачен', shipped: 'Отправлен', done: 'Завершён', cancelled: 'Отменён' };
export const PAYMENT_STATUS_LABEL = { manual: 'Перевод по чеку', awaiting: 'Ждёт оплаты картой', paid: 'Оплачено картой', failed: 'Платёж не прошёл', expired: 'Сессия оплаты истекла' };
export const TG_LABEL = { sent: 'Отправлено', failed: 'Ошибка', disabled: 'Не настроен', pending: 'Ожидает' };
export const CATEGORY_LABEL = {
  cpu: 'Процессоры', motherboard: 'Материнские платы', ram: 'Память', gpu: 'Видеокарты',
  storage: 'Накопители', psu: 'Блоки питания', case: 'Корпуса', cooler: 'Охлаждение',
};

const ERROR_TEXT = {
  required: 'обязательное поле', invalid: 'неверное значение', out_of_range: 'вне допустимого диапазона', invalid_json: 'некорректный JSON',
  less_than_cores: 'потоков не может быть меньше ядер', mismatch: 'тип и интерфейс не сочетаются', image_invalid_type: 'нужен PNG, JPG или WEBP',
  unauthorized: 'нужно войти', invalid_credentials: 'неверный логин или пароль', too_many_requests: 'слишком много попыток, подождите',
  validation: 'проверьте поля формы', order_cancelled: 'отменённый заказ нельзя изменить', file_too_large: 'файл слишком большой',
  invalid_url: 'нужна ссылка https://…', blocked_host: 'этот адрес запрещён', too_large: 'файл слишком большой', fetch_timeout: 'сайт не ответил вовремя',
  too_many_redirects: 'слишком много перенаправлений', fetch_failed: 'не удалось скачать файл по ссылке', too_many_images: 'в галерее уже 8 фото',
  image_required: 'выберите файл',
};
export const errorText = (code) => ERROR_TEXT[code] ?? code;

/** Плоский список ошибок полей: { specs: { vram_gb: 'required' } } → ['specs.vram_gb: обязательное поле']. */
export function flattenErrors(fields, prefix = '') {
  return Object.entries(fields ?? {}).flatMap(([key, value]) =>
    (typeof value === 'object' ? flattenErrors(value, `${prefix}${key}.`) : [`${prefix}${key}: ${errorText(value)}`]));
}

let toastTimer;
export function toast(message, kind = 'ok') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2800);
}

/** Модальное окно; возвращает { el, close }. */
export function openModal(title, content, { wide = false } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = html`
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head"><h2>${title}</h2><button class="btn ghost" data-close aria-label="Закрыть">✕</button></div>
      <div class="modal-body">${content}</div>
    </div>`.toString();
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (!$('.modal-backdrop')) document.body.classList.remove('modal-open');
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  $('[data-close]', backdrop).addEventListener('click', close);
  return { el: $('.modal-body', backdrop), close };
}
