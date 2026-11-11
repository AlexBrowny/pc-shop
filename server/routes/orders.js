import { Router } from 'express';
import { config } from '../config.js';
import { getSetting } from '../lib/settings.js';
import { rateLimiter } from '../lib/ratelimit.js';
import {
  receiptUpload, handleUpload, detectMime, saveReceipt, deleteReceipt,
} from '../lib/uploads.js';
import {
  parseItems, validateCustomer, priceItems, createOrder, getOrder, saveTelegramResult,
} from '../lib/orders.js';
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
      },
    });
  } catch (err) {
    next(err);
  }
});

ordersRouter.post('/orders', limiter, handleUpload(receiptUpload), async (req, res, next) => {
  try {
    const customer = validateCustomer(req.body ?? {});
    if (customer.error) return fail(res, 400, customer.error, { field: customer.field });

    const items = parseItems(req.body?.items);
    if (!items) return fail(res, 400, 'invalid_items');

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
