// Stripe: вебхук (подпись проверяется по сырому телу) и проверка результата оплаты на странице возврата.
import { Router } from 'express';
import { config } from '../config.js';
import {
  stripe, isStripeConfigured, isWebhookConfigured, isValidSessionId, processStripeEvent, syncOrderBySession,
} from '../lib/stripe.js';

const fail = (res, status, error) => res.status(status).json({ success: false, error });

/** Монтируется в app.js ДО express.json(): подписи нужно сырое тело запроса. */
export async function stripeWebhook(req, res) {
  if (!isStripeConfigured() || !isWebhookConfigured()) return fail(res, 503, 'stripe_not_configured');
  if (!Buffer.isBuffer(req.body)) return fail(res, 400, 'bad_body');

  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature') ?? '', config.stripe.webhookSecret);
  } catch {
    return fail(res, 400, 'bad_signature');
  }
  try {
    await processStripeEvent(event);
    return res.json({ received: true });
  } catch (err) {
    // 500 → Stripe повторит доставку позже; обработка идемпотентна
    process.stderr.write(`Stripe webhook ${event.type}: ${err.stack ?? err}\n`);
    return fail(res, 500, 'webhook_failed');
  }
}

export const stripeRouter = Router();

/** Страница «Спасибо» вызывает это после возврата из Stripe. Работает только для сессий, созданных нашим сайтом. */
stripeRouter.get('/stripe/session/:id', async (req, res, next) => {
  try {
    if (!isStripeConfigured() || !isValidSessionId(req.params.id)) return fail(res, 404, 'not_found');
    const found = await syncOrderBySession(req.params.id);
    if (!found) return fail(res, 404, 'not_found');
    const { order } = found;
    return res.json({
      success: true,
      data: {
        id: order.id, status: order.status, payment_status: order.payment_status, total_uzs: order.total_uzs, phone: order.phone,
      },
    });
  } catch (err) {
    return next(err);
  }
});
