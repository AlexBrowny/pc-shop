// Отправка заказов и чеков менеджеру через Telegram Bot API.
// Токен берётся только из окружения и никогда не попадает в логи/ответы.
import { config } from '../config.js';
import { getSetting } from './settings.js';
import { isImageMime, isReceiptKey } from './uploads.js';
import { getObject, RECEIPTS } from './storage.js';

const TIMEOUT_MS = 15_000;
const TELEGRAM_PHOTO_LIMIT = 10 * 1024 * 1024;

export const telegramToken = () => config.telegram.token;
export const telegramChatId = async () => (await getSetting('telegram_chat_id')) || config.telegram.chatId;
export const isTelegramConfigured = async () => !!(telegramToken() && (await telegramChatId()));

const escapeHtml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmtUzs = (n) => `${new Intl.NumberFormat('ru-RU').format(n).replace(/[  ]/g, ' ')} сум`;

/** Убирает токен из текста ошибки. */
const scrub = (text) => String(text ?? '').split(telegramToken() || '\u0000').join('***').slice(0, 300);

async function call(method, body) {
  const url = `${config.telegram.apiBase}/bot${telegramToken()}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    body,
    headers: typeof body === 'string' ? { 'Content-Type': 'application/json' } : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let data = null;
  try {
    data = await res.json();
  } catch { /* не JSON */ }
  if (!res.ok || !data?.ok) throw new Error(`Telegram ${method}: ${data?.description ?? `HTTP ${res.status}`}`);
  return data.result;
}

const fmtMinor = (minor, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: String(currency || 'usd').toUpperCase() }).format(minor / 100);

export function formatOrderMessage(order, items) {
  const lines = items.map((i) => `• ${escapeHtml(i.brand)} ${escapeHtml(i.name)} — ${i.qty} × ${fmtUzs(i.price_uzs)}`);
  const card = order.payment_method === 'stripe';
  return [
    card ? `💳 <b>Новый оплаченный заказ №${order.id}</b> (карта, Stripe)` : `🧾 <b>Новый заказ №${order.id}</b>`,
    `👤 ${escapeHtml(order.customer_name)}`,
    `📞 ${escapeHtml(order.phone)}`,
    order.address ? `📍 ${escapeHtml(order.address)}` : null,
    order.comment ? `💬 ${escapeHtml(order.comment)}` : null,
    '',
    ...lines,
    '',
    `💰 <b>Итого: ${fmtUzs(order.total_uzs)}</b>`,
    card && order.paid_amount != null ? `✅ Оплачено картой: <b>${fmtMinor(order.paid_amount, order.paid_currency)}</b>` : null,
    `🌐 Язык клиента: ${order.lang === 'uz' ? "o'zbek" : 'русский'}`,
  ].filter((l) => l !== null).join('\n');
}

/**
 * Отправляет сообщение с составом заказа и затем файл чека (берётся из Neon Object Storage).
 * Возвращает { status: 'sent' | 'failed' | 'disabled', error? } и не бросает исключений.
 */
export async function sendOrderToTelegram(order, items) {
  if (!(await isTelegramConfigured())) return { status: 'disabled' };
  const chatId = await telegramChatId();
  try {
    await call('sendMessage', JSON.stringify({ chat_id: chatId, text: formatOrderMessage(order, items), parse_mode: 'HTML' }));

    // оплата картой: чека нет, платёж подтверждён Stripe
    if (order.payment_method === 'stripe') return { status: 'sent' };

    const stored = isReceiptKey(order.receipt_file) ? await getObject(RECEIPTS, order.receipt_file) : null;
    if (!stored) throw new Error('Файл чека не найден в хранилище');
    const { buffer } = stored;
    const asPhoto = isImageMime(order.receipt_mime) && buffer.length <= TELEGRAM_PHOTO_LIMIT;
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set('caption', `Чек к заказу №${order.id}`);
    const field = asPhoto ? 'photo' : 'document';
    form.set(field, new Blob([buffer], { type: order.receipt_mime }), order.receipt_name || `receipt-${order.id}`);
    await call(asPhoto ? 'sendPhoto' : 'sendDocument', form);
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: scrub(err.message) };
  }
}

/** Платёж прошёл за заказ, который к этому моменту уже отменён: менеджеру нужно вернуть деньги или оформить заказ заново. */
export async function sendLatePaymentAlert(order) {
  if (!(await isTelegramConfigured())) return { status: 'disabled' };
  try {
    const text = `⚠️ <b>Оплата за отменённый заказ №${order.id}</b>
Stripe принял платёж ${order.paid_amount != null ? fmtMinor(order.paid_amount, order.paid_currency) : ''}, но заказ уже отменён (товар возвращён на склад). Свяжитесь с клиентом ${escapeHtml(order.phone)} или сделайте возврат в Stripe.`;
    await call('sendMessage', JSON.stringify({ chat_id: await telegramChatId(), text, parse_mode: 'HTML' }));
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: scrub(err.message) };
  }
}

export async function sendTestMessage() {
  if (!(await isTelegramConfigured())) return { status: 'disabled' };
  try {
    await call('sendMessage', JSON.stringify({ chat_id: await telegramChatId(), text: '✅ PC Market: тестовое сообщение из админки.' }));
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: scrub(err.message) };
  }
}
