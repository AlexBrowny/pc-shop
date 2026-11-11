import { Router } from 'express';
import { config } from '../config.js';
import { getSetting } from '../lib/settings.js';
import { rateLimiter } from '../lib/ratelimit.js';
import {
  receiptUpload, handleUpload, detectMime, saveReceipt, deleteReceipt,
} from '../lib/uploads.js';
import {
  parseItems, validateCustomer, priceItems, createOrder, getOrder, saveTelegramResult,
  attachStripeSession, cancelUnpaidOrder, cancelStaleUnpaid,
} from '../lib/orders.js';
import {
  isStripeConfigured, createCheckoutSession, baseUrlOf, uzsToMinor,
} from '../lib/stripe.js';
import { sendOrderToTelegram } from '../lib/telegram.js';

export const ordersRouter = Router();

const limiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: config.limits.ordersPerHour });
const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });

/** Реквизиты для оплаты, которые видит покупатель (значения из админки перекрывают окружение). */
ordersRouter.get('/config', async (_req, res, next) => {
  try {
    const [card, holder, noteRu, noteUz] = await Promise.all([
      getSetting('payment_card'), getSetting('payment_holder'), getSetting('payment_note_ru'), getSetting('payment_note_uz'),
    ]);
    res.json({
      success: true,
      data: {
        payment: {
          card: card || config.payment.card,
          holder: holder || config.payment.holder,
          note_ru: noteRu,
          note_uz: noteUz,
        },
        receiptMaxMb: config.limits.receiptBytes / 1024 / 1024,
        stripe: { enabled: isStripeConfigured(), currency: config.stripe.currency, usdRate: config.stripe.usdRate },
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Оплата картой: заказ резервирует товар и ждёт оплаты в Stripe Checkout; менеджер получит уведомление после платежа. */
async function createStripeOrder(req, res, customer, items) {
  if (!isStripeConfigured()) return fail(res, 400, 'stripe_disabled');
  await cancelStaleUnpaid(config.stripe.sessionMinutes + 10); // освобождаем резерв за брошенными оплатами

  const priced = await priceItems(items);
  if (priced.error) return fail(res, priced.error === 'out_of_stock' ? 409 : 400, priced.error, { product: priced.product, available: priced.available });

  const created = await createOrder({ customer, lines: priced.lines, payment: 'stripe' });
  if (created.error) return fail(res, 409, created.error, { product: created.product });

  const { order, items: saved } = await getOrder(created.id);
  try {
    const session = await createCheckoutSession({ order, items: saved, baseUrl: baseUrlOf(req) });
    await attachStripeSession(order.id, session.id);
    return res.status(201).json({
      success: true,
      data: { id: order.id, total_uzs: created.total, checkout_url: session.url, charge_minor: saved.reduce((s, i) => s + uzsToMinor(i.price_uzs) * i.qty, 0) },
    });
  } catch (err) {
    process.stderr.write(`Stripe checkout session: ${err.message}\n`);
    await cancelUnpaidOrder(order.id, 'failed'); // платёж не создан — возвращаем товар на склад
    return fail(res, 502, 'payment_unavailable');
  }
}

ordersRouter.post('/orders', limiter, handleUpload(receiptUpload), async (req, res, next) => {
  try {
    const customer = validateCustomer(req.body ?? {});
    if (customer.error) return fail(res, 400, customer.error, { field: customer.field });

    const items = parseItems(req.body?.items);
    if (!items) return fail(res, 400, 'invalid_items');

    if (req.body?.payment_method === 'stripe') return await createStripeOrder(req, res, customer.value, items);

    if (!req.file) return fail(res, 400, 'receipt_required', { field: 'receipt' });
    const mime = detectMime(req.file.buffer);
    if (!mime) return fail(res, 400, 'receipt_invalid_type', { field: 'receipt' });

    const priced = await priceItems(items);
    if (priced.error) return fail(res, priced.error === 'out_of_stock' ? 409 : 400, priced.error, { product: priced.product, available: priced.available });

    // Чек уходит в Neon Object Storage до записи заказа; если запись в БД не удалась — объект удаляем.
    const file = await saveReceipt(req.file.buffer, mime);
    let created;
    try {
      created = await createOrder({
        customer: customer.value,
        lines: priced.lines,
        receipt: { file, mime, name: String(req.file.originalname ?? '').slice(0, 120) },
      });
    } catch (err) {
      await deleteReceipt(file).catch(() => {});
      throw err;
    }
    if (created.error) {
      await deleteReceipt(file).catch(() => {});
      return fail(res, 409, created.error, { product: created.product });
    }

    // Заказ уже сохранён: сбой Telegram не должен его отменять — статус виден в админке, отправку можно повторить.
    const { order, items: savedItems } = await getOrder(created.id);
    const result = await sendOrderToTelegram(order, savedItems);
    await saveTelegramResult(created.id, result);

    return res.status(201).json({ success: true, data: { id: created.id, total_uzs: created.total } });
  } catch (err) {
    return next(err);
  }
});
