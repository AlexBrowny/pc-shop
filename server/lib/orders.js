import { query, rows, row, tx } from '../db.js';

// pending — заказ с оплатой картой ждёт платежа (остатки зарезервированы)
export const ORDER_STATUSES = ['pending', 'new', 'paid', 'shipped', 'done', 'cancelled'];
const MAX_LINES = 50;
const MAX_QTY = 99;

const clean = (value, max) =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);

/** +998901234567 из «90 123 45 67», «998 90 123-45-67», «+998 (90) 123-45-67». */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
}

/** Разбирает состав заказа: [{ id, qty }] без дублей. Возвращает null при некорректных данных. */
export function parseItems(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_LINES) return null;
  const merged = new Map();
  for (const item of list) {
    const id = Number(item?.id);
    const qty = Number(item?.qty);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

export function validateCustomer(body) {
  const name = clean(body.name, 80);
  const phone = normalizePhone(body.phone);
  if (name.length < 2) return { error: 'invalid_name', field: 'name' };
  if (!phone) return { error: 'invalid_phone', field: 'phone' };
  return {
    value: {
      name,
      phone,
      address: clean(body.address, 300),
      comment: clean(body.comment, 500),
      lang: body.lang === 'uz' ? 'uz' : 'ru',
    },
  };
}

/** Загружает товары заказа и считает сумму по ценам из БД (цены клиента игнорируются). */
export async function priceItems(items) {
  const found = await rows('SELECT * FROM products WHERE active AND id = ANY($1::int[])', [items.map((i) => i.id)]);
  const byId = new Map(found.map((p) => [p.id, p]));
  const lines = [];
  for (const { id, qty } of items) {
    const product = byId.get(id);
    if (!product) return { error: 'unknown_product' };
    if (product.stock < qty) return { error: 'out_of_stock', product: `${product.brand} ${product.name}`, available: product.stock };
    lines.push({ product, qty });
  }
  const total = lines.reduce((sum, l) => sum + l.product.price_uzs * l.qty, 0);
  return { lines, total };
}

/**
 * Создаёт заказ и списывает остатки одной транзакцией.
 * Строки товаров блокируются (FOR UPDATE), поэтому два одновременных заказа не уведут остаток в минус.
 */
export function createOrder({ customer, lines, receipt = null, payment = 'receipt', userId = null }) {
  const stripe = payment === 'stripe';
  return tx(async (db) => {
    const ids = lines.map((l) => l.product.id).sort((a, b) => a - b);
    const locked = new Map((await db.rows('SELECT id, stock, price_uzs FROM products WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids])).map((r) => [r.id, r]));
    for (const { product, qty } of lines) {
      if (!locked.get(product.id) || locked.get(product.id).stock < qty) {
        return { error: 'out_of_stock', product: `${product.brand} ${product.name}` };
      }
    }
    const total = lines.reduce((sum, l) => sum + l.product.price_uzs * l.qty, 0);
    const order = await db.row(
      `INSERT INTO orders (customer_name, phone, address, comment, lang, total_uzs, receipt_file, receipt_mime, receipt_name,
                           status, payment_method, payment_status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [customer.name, customer.phone, customer.address, customer.comment, customer.lang, total,
        receipt?.file ?? null, receipt?.mime ?? null, receipt?.name ?? null,
        stripe ? 'pending' : 'new', payment, stripe ? 'awaiting' : 'manual', userId],
    );
    for (const { product, qty } of lines) {
      await db.query('INSERT INTO order_items (order_id, product_id, brand, name, price_uzs, qty) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, product.id, product.brand, product.name, product.price_uzs, qty]);
      await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, product.id]);
    }
    return { id: order.id, total };
  });
}

export async function getOrder(id) {
  const order = await row('SELECT * FROM orders WHERE id = $1', [id]);
  if (!order) return null;
  const items = await rows('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]);
  return { order, items };
}

export async function saveTelegramResult(id, { status, error }) {
  await query('UPDATE orders SET telegram_status = $1, telegram_error = $2, updated_at = now() WHERE id = $3', [status, error ?? null, id]);
}

/**
 * Меняет статус. При отмене остатки возвращаются на склад; «воскресить» отменённый заказ нельзя
 * (товар мог уйти другому покупателю), для этого оформляется новый заказ.
 */
export function changeStatus(id, status) {
  return tx(async (db) => {
    const order = await db.row('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!order) return { error: 'not_found' };
    if (order.status === status) return { ok: true };
    if (order.status === 'cancelled') return { error: 'order_cancelled' };
    if (status === 'cancelled') {
      await db.query(
        `UPDATE products p SET stock = p.stock + i.qty
         FROM order_items i WHERE i.order_id = $1 AND i.product_id = p.id`,
        [id],
      );
    }
    await db.query('UPDATE orders SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
    return { ok: true };
  });
}

// ───────── Оплата картой (Stripe) ─────────

export const attachStripeSession = (id, sessionId) =>
  query('UPDATE orders SET stripe_session_id = $1, updated_at = now() WHERE id = $2', [sessionId, id]);

export async function getOrderByStripeSession(sessionId) {
  const order = await row('SELECT id FROM orders WHERE stripe_session_id = $1', [sessionId]);
  return order ? getOrder(order.id) : null;
}

/**
 * Фиксирует успешную оплату. Идемпотентна: вебхук Stripe может прийти повторно, а страница возврата — раньше вебхука.
 * Возвращает { changed: true } только в тот раз, когда заказ действительно перешёл в «оплачен» (чтобы уведомить менеджера один раз),
 * и { late: true }, если деньги пришли за уже отменённый заказ (нужно разобраться вручную).
 */
export function markOrderPaid(id, { paymentIntent, currency, amount }) {
  return tx(async (db) => {
    const order = await db.row('SELECT id, status, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!order) return { error: 'not_found' };
    if (order.payment_status === 'paid') return { changed: false };
    if (order.status === 'cancelled') {
      await db.query(
        `UPDATE orders SET payment_status = 'paid', stripe_payment_intent = $1, paid_currency = $2, paid_amount = $3, updated_at = now() WHERE id = $4`,
        [paymentIntent ?? null, currency ?? null, amount ?? null, id],
      );
      return { changed: false, late: true };
    }
    await db.query(
      `UPDATE orders SET status = 'paid', payment_status = 'paid', stripe_payment_intent = $1, paid_currency = $2, paid_amount = $3, updated_at = now() WHERE id = $4`,
      [paymentIntent ?? null, currency ?? null, amount ?? null, id],
    );
    return { changed: true };
  });
}

/** Отменяет неоплаченный Stripe-заказ (сессия истекла/платёж не прошёл) и возвращает товар на склад. */
export function cancelUnpaidOrder(id, paymentStatus = 'expired') {
  return tx(async (db) => {
    const order = await db.row('SELECT id, status, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!order || order.status !== 'pending' || order.payment_status !== 'awaiting') return { changed: false };
    await db.query(
      `UPDATE products p SET stock = p.stock + i.qty FROM order_items i WHERE i.order_id = $1 AND i.product_id = p.id`,
      [id],
    );
    await db.query(`UPDATE orders SET status = 'cancelled', payment_status = $1, updated_at = now() WHERE id = $2`, [paymentStatus, id]);
    return { changed: true };
  });
}

/** Подстраховка на случай недошедшего вебхука expired: старые неоплаченные заказы отменяются сами. */
export async function cancelStaleUnpaid(olderThanMinutes) {
  const stale = await rows(
    `SELECT id FROM orders WHERE status = 'pending' AND payment_status = 'awaiting' AND created_at < now() - ($1::int * interval '1 minute')`,
    [olderThanMinutes],
  );
  for (const { id } of stale) await cancelUnpaidOrder(id, 'expired');
  return stale.length;
}
