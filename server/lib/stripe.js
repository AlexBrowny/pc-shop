// Оплата картой через Stripe Checkout: создание сессии, разбор вебхуков, фиксация оплаты.
// Деньги списываются в долларах (курс USD_RATE): так оплата работает при любой стране аккаунта Stripe.
import Stripe from 'stripe';
import { config } from '../config.js';
import {
  getOrder, markOrderPaid, cancelUnpaidOrder, saveTelegramResult, getOrderByStripeSession,
} from './orders.js';
import { sendOrderToTelegram, sendLatePaymentAlert } from './telegram.js';

const SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9]+$/;

let client = null;
export const isStripeConfigured = () => !!config.stripe.secretKey;
export const isWebhookConfigured = () => !!config.stripe.webhookSecret;
export const isValidSessionId = (id) => SESSION_ID_RE.test(String(id ?? ''));

export function stripe() {
  if (!client) {
    const base = config.stripe.apiBase ? new URL(config.stripe.apiBase) : null;
    client = new Stripe(config.stripe.secretKey, {
      maxNetworkRetries: base ? 0 : 2,
      timeout: 20_000,
      ...(base ? { host: base.hostname, port: base.port, protocol: base.protocol.replace(':', '') } : {}),
    });
  }
  return client;
}

/** Сумы → центы доллара (минимум 1 цент, чтобы Stripe не отклонил позицию). */
export const uzsToMinor = (uzs) => Math.max(1, Math.round((Number(uzs) / config.stripe.usdRate) * 100));
export const fmtMinor = (minor, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);

/** Адрес сайта для возврата из Stripe: PUBLIC_URL или домен текущего запроса. */
export const baseUrlOf = (req) => config.stripe.publicUrl || `${req.protocol}://${req.get('host')}`;

export function createCheckoutSession({ order, items, baseUrl }) {
  const expiresAt = Math.floor(Date.now() / 1000) + (config.stripe.sessionMinutes + 1) * 60;
  return stripe().checkout.sessions.create({
    mode: 'payment',
    line_items: items.map((i) => ({
      quantity: i.qty,
      price_data: {
        currency: config.stripe.currency,
        unit_amount: uzsToMinor(i.price_uzs),
        product_data: { name: `${i.brand} ${i.name}`.slice(0, 250) },
      },
    })),
    client_reference_id: String(order.id),
    metadata: { order_id: String(order.id) },
    payment_intent_data: { metadata: { order_id: String(order.id) }, description: `PC Market, заказ №${order.id}` },
    locale: order.lang === 'uz' ? 'uz' : 'ru',
    expires_at: expiresAt,
    success_url: `${baseUrl}/#/paid/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/#/checkout`,
  });
}

const orderIdOf = (session) => {
  const id = Number(session?.metadata?.order_id ?? session?.client_reference_id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const intentIdOf = (session) => (typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null);

/**
 * Применяет состояние Checkout Session к заказу. Вызывается и из вебхука, и со страницы возврата — повторный вызов безопасен.
 * Менеджеру уходит ровно одно уведомление: в момент, когда заказ стал оплаченным.
 */
export async function applyCheckoutSession(session) {
  const id = orderIdOf(session);
  if (!id) return { ignored: true };

  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    const result = await markOrderPaid(id, { paymentIntent: intentIdOf(session), currency: session.currency, amount: session.amount_total });
    if (result.changed || result.late) {
      const found = await getOrder(id);
      if (found) {
        const sent = result.late ? await sendLatePaymentAlert(found.order) : await sendOrderToTelegram(found.order, found.items);
        await saveTelegramResult(id, sent);
      }
    }
    return { id, ...result };
  }
  if (session.status === 'expired') return { id, ...(await cancelUnpaidOrder(id, 'expired')) };
  return { id, changed: false };
}

/** Разбирает событие вебхука. Неизвестные типы молча подтверждаем (Stripe не должен повторять доставку). */
export async function processStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return applyCheckoutSession(event.data.object);
    case 'checkout.session.expired': {
      const id = orderIdOf(event.data.object);
      return id ? cancelUnpaidOrder(id, 'expired') : { ignored: true };
    }
    case 'checkout.session.async_payment_failed': {
      const id = orderIdOf(event.data.object);
      return id ? cancelUnpaidOrder(id, 'failed') : { ignored: true };
    }
    default:
      return { ignored: true };
  }
}

/** Для страницы возврата: проверяем сессию у Stripe и обновляем заказ (вебхук мог ещё не дойти). */
export async function syncOrderBySession(sessionId) {
  const known = await getOrderByStripeSession(sessionId);
  if (!known) return null;
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  await applyCheckoutSession(session);
  return getOrder(known.order.id);
}
