import { Router } from 'express';
import { config } from '../config.js';
import { rows, row, query } from '../db.js';
import {
  checkCredentials, createSession, destroySession, sessionTokenOf, setSessionCookie, clearSessionCookie, requireAdmin, isValidSession,
} from '../lib/auth.js';
import { rateLimiter } from '../lib/ratelimit.js';
import { getSetting, setSetting, EDITABLE_SETTINGS } from '../lib/settings.js';
import {
  getOrder, changeStatus, saveTelegramResult, ORDER_STATUSES,
} from '../lib/orders.js';
import {
  imageUpload, handleUpload, detectMime, isImageMime, saveImage, saveGeneratedSvg, isReceiptKey,
} from '../lib/uploads.js';
import { getObject, RECEIPTS } from '../lib/storage.js';
import { sendOrderToTelegram, sendTestMessage, isTelegramConfigured, telegramToken, telegramChatId } from '../lib/telegram.js';
import { SPEC_FIELDS, CATEGORY_KEYS, validateSpecs, validateGame } from '../lib/specs.js';
import { productSvg, gameSvg, slugify } from '../lib/illustrations.js';

export const adminRouter = Router();

const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: config.limits.loginAttempts, onlyFailures: true });

// ───────── Сессия ─────────
adminRouter.post('/login', loginLimiter, wrap(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string' || !(await checkCredentials(username, password))) {
    return fail(res, 401, 'invalid_credentials');
  }
  setSessionCookie(res, createSession(), req.secure || config.isProduction);
  return ok(res, { user: config.admin.user });
}));

adminRouter.get('/me', (req, res) => {
  if (!isValidSession(sessionTokenOf(req))) return fail(res, 401, 'unauthorized');
  return ok(res, { user: config.admin.user });
});

adminRouter.post('/logout', (req, res) => {
  destroySession(sessionTokenOf(req));
  clearSessionCookie(res);
  ok(res, {});
});

adminRouter.use(requireAdmin);

// ───────── Сводка ─────────
adminRouter.get('/stats', wrap(async (_req, res) => {
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const r of await rows('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')) byStatus[r.status] = r.n;
  const { s: revenue } = await row("SELECT COALESCE(SUM(total_uzs), 0) AS s FROM orders WHERE status IN ('paid','shipped','done')");
  ok(res, { byStatus, revenue });
}));

// ───────── Заказы ─────────
adminRouter.get('/orders', wrap(async (req, res) => {
  const where = [];
  const params = [];
  const { status, q } = req.query;
  if (status && ORDER_STATUSES.includes(String(status))) { params.push(String(status)); where.push(`o.status = $${params.length}`); }
  if (q) {
    params.push(`%${String(q).replace(/[%_\\]/g, '\\$&')}%`);
    const like = `$${params.length}`;
    params.push(String(q).replace(/^#?№?/, ''));
    where.push(`(o.customer_name ILIKE ${like} OR o.phone ILIKE ${like} OR o.id::text = $${params.length})`);
  }
  const data = await rows(
    `SELECT o.id, o.customer_name, o.phone, o.total_uzs, o.status, o.telegram_status, o.created_at,
            (SELECT COALESCE(SUM(qty), 0) FROM order_items i WHERE i.order_id = o.id) AS items_count
     FROM orders o ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY o.id DESC LIMIT 300`,
    params,
  );
  ok(res, data);
}));

const orderId = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

adminRouter.get('/orders/:id', wrap(async (req, res) => {
  const id = orderId(req);
  const found = id && await getOrder(id);
  if (!found) return fail(res, 404, 'not_found');
  const { receipt_file: _file, ...order } = found.order;
  return ok(res, { ...order, items: found.items });
}));

adminRouter.patch('/orders/:id', wrap(async (req, res) => {
  const id = orderId(req);
  if (!id || !(await getOrder(id))) return fail(res, 404, 'not_found');
  const { status, admin_note: note } = req.body ?? {};
  if (status !== undefined) {
    if (!ORDER_STATUSES.includes(status)) return fail(res, 400, 'invalid_status');
    const result = await changeStatus(id, status);
    if (result.error) return fail(res, 409, result.error);
  }
  if (note !== undefined) {
    await query('UPDATE orders SET admin_note = $1, updated_at = now() WHERE id = $2', [String(note).slice(0, 1000), id]);
  }
  return ok(res, (await getOrder(id)).order.status);
}));

adminRouter.get('/orders/:id/receipt', wrap(async (req, res) => {
  const id = orderId(req);
  const found = id && await getOrder(id);
  if (!found || !isReceiptKey(found.order.receipt_file)) return fail(res, 404, 'not_found');
  const stored = await getObject(RECEIPTS, found.order.receipt_file);
  if (!stored) return fail(res, 404, 'not_found');
  res.setHeader('Content-Type', found.order.receipt_mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${found.order.id}.${found.order.receipt_file.split('.').pop()}"`);
  return res.send(stored.buffer);
}));

adminRouter.post('/orders/:id/resend-telegram', wrap(async (req, res) => {
  const id = orderId(req);
  const found = id && await getOrder(id);
  if (!found) return fail(res, 404, 'not_found');
  const result = await sendOrderToTelegram(found.order, found.items);
  await saveTelegramResult(id, result);
  return ok(res, result);
}));

// ───────── Товары ─────────
const intIn = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

function readProductBody(req) {
  const body = req.body ?? {};
  const errors = {};
  const category = String(body.category ?? '');
  if (!CATEGORY_KEYS.includes(category)) errors.category = 'invalid';
  const brand = String(body.brand ?? '').trim();
  const name = String(body.name ?? '').trim();
  if (!brand || brand.length > 40) errors.brand = 'invalid';
  if (!name || name.length > 90) errors.name = 'invalid';
  const price = intIn(body.price_uzs, 0, 10_000_000_000);
  if (price === null) errors.price_uzs = 'invalid';
  const stock = intIn(body.stock, 0, 100_000);
  if (stock === null) errors.stock = 'invalid';
  let specsInput = body.specs;
  if (typeof specsInput === 'string') {
    try { specsInput = JSON.parse(specsInput); } catch { errors.specs = 'invalid_json'; }
  }
  let specs = null;
  if (!errors.category && !errors.specs) {
    const res = validateSpecs(category, specsInput);
    if (res.ok) specs = res.value;
    else return { errors: { ...errors, specs: res.errors } };
  }
  if (Object.keys(errors).length) return { errors };
  const active = body.active === undefined ? undefined : (body.active === true || body.active === 'true' || body.active === '1');
  return {
    value: {
      category, brand, name, price_uzs: price, stock, specs, active,
    },
  };
}

async function uniqueSlug(base, table, exceptId = 0) {
  let slug = base || 'item';
  for (let i = 2; await row(`SELECT id FROM ${table} WHERE slug = $1 AND id <> $2`, [slug, exceptId]); i += 1) slug = `${base}-${i}`;
  return slug;
}

adminRouter.get('/spec-schema', (_req, res) => ok(res, SPEC_FIELDS));

adminRouter.get('/products', wrap(async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.category) { params.push(String(req.query.category)); where.push(`category = $${params.length}`); }
  if (req.query.q) {
    params.push(`%${String(req.query.q).replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(name ILIKE $${params.length} OR brand ILIKE $${params.length})`);
  }
  ok(res, await rows(`SELECT * FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY category, brand, name`, params));
}));

adminRouter.post('/products', handleUpload(imageUpload), wrap(async (req, res) => {
  const parsed = readProductBody(req);
  if (parsed.errors) return fail(res, 400, 'validation', { fields: parsed.errors });
  const p = parsed.value;
  const slug = await uniqueSlug(slugify(`${p.brand} ${p.name}`), 'products');

  let image;
  if (req.file) {
    const mime = detectMime(req.file.buffer);
    if (!mime || !isImageMime(mime)) return fail(res, 400, 'image_invalid_type', { fields: { image: 'image_invalid_type' } });
    image = await saveImage(req.file.buffer, mime, 'products', slug);
  } else {
    image = await saveGeneratedSvg('products', slug, productSvg(p));
  }
  const created = await row(
    `INSERT INTO products (category, slug, brand, name, price_uzs, stock, image, specs, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING *`,
    [p.category, slug, p.brand, p.name, p.price_uzs, p.stock, image, JSON.stringify(p.specs), p.active !== false],
  );
  return ok(res, created, 201);
}));

adminRouter.put('/products/:id', handleUpload(imageUpload), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const existing = Number.isInteger(id) ? await row('SELECT * FROM products WHERE id = $1', [id]) : null;
  if (!existing) return fail(res, 404, 'not_found');
  const parsed = readProductBody(req);
  if (parsed.errors) return fail(res, 400, 'validation', { fields: parsed.errors });
  const p = parsed.value;
  let { image } = existing;
  if (req.file) {
    const mime = detectMime(req.file.buffer);
    if (!mime || !isImageMime(mime)) return fail(res, 400, 'image_invalid_type', { fields: { image: 'image_invalid_type' } });
    image = await saveImage(req.file.buffer, mime, 'products', existing.slug);
  }
  const updated = await row(
    `UPDATE products SET category = $1, brand = $2, name = $3, price_uzs = $4, stock = $5, image = $6, specs = $7::jsonb, active = $8
     WHERE id = $9 RETURNING *`,
    [p.category, p.brand, p.name, p.price_uzs, p.stock, image, JSON.stringify(p.specs), p.active === undefined ? existing.active : p.active, id],
  );
  return ok(res, updated);
}));

// «Удаление» — скрытие с витрины: товар может входить в старые заказы
adminRouter.delete('/products/:id', wrap(async (req, res) => {
  const r = await query('UPDATE products SET active = false WHERE id = $1', [Number(req.params.id) || 0]);
  return r.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));

// ───────── Галерея фото товара ─────────
const MAX_GALLERY = 8;

adminRouter.get('/products/:id/images', wrap(async (req, res) => {
  ok(res, await rows('SELECT id, url FROM product_images WHERE product_id = $1 ORDER BY sort, id', [Number(req.params.id) || 0]));
}));

adminRouter.post('/products/:id/images', handleUpload(imageUpload), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const product = Number.isInteger(id) ? await row('SELECT id, slug FROM products WHERE id = $1', [id]) : null;
  if (!product) return fail(res, 404, 'not_found');
  if (!req.file) return fail(res, 400, 'image_required', { fields: { image: 'required' } });
  const mime = detectMime(req.file.buffer);
  if (!mime || !isImageMime(mime)) return fail(res, 400, 'image_invalid_type', { fields: { image: 'image_invalid_type' } });
  if ((await row('SELECT COUNT(*) AS n FROM product_images WHERE product_id = $1', [id])).n >= MAX_GALLERY) return fail(res, 409, 'too_many_images');
  const url = await saveImage(req.file.buffer, mime, 'products', `${product.slug}-gallery`);
  const created = await row(
    'INSERT INTO product_images (product_id, url, sort) VALUES ($1, $2, COALESCE((SELECT MAX(sort) + 1 FROM product_images WHERE product_id = $1), 0)) RETURNING id, url',
    [id, url],
  );
  return ok(res, created, 201);
}));

adminRouter.delete('/products/:id/images/:imageId', wrap(async (req, res) => {
  const removed = await query('DELETE FROM product_images WHERE id = $1 AND product_id = $2', [Number(req.params.imageId) || 0, Number(req.params.id) || 0]);
  return removed.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));

// ───────── Отзывы: модерация ─────────
adminRouter.get('/reviews', wrap(async (req, res) => {
  const status = ['published', 'hidden'].includes(req.query.status) ? req.query.status : null;
  ok(res, await rows(
    `SELECT r.id, r.rating, r.body, r.status, r.created_at, p.brand, p.name AS product, p.slug, u.name AS author, u.email
     FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
     ${status ? 'WHERE r.status = $1' : ''} ORDER BY r.created_at DESC LIMIT 300`,
    status ? [status] : [],
  ));
}));

adminRouter.patch('/reviews/:id', wrap(async (req, res) => {
  const status = req.body?.status;
  if (!['published', 'hidden'].includes(status)) return fail(res, 400, 'invalid_status');
  const updated = await query('UPDATE reviews SET status = $1, updated_at = now() WHERE id = $2', [status, Number(req.params.id) || 0]);
  return updated.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));

adminRouter.delete('/reviews/:id', wrap(async (req, res) => {
  const removed = await query('DELETE FROM reviews WHERE id = $1', [Number(req.params.id) || 0]);
  return removed.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));

// ───────── Игры ─────────
const gameBody = (req) => {
  const body = { ...(req.body ?? {}) };
  for (const key of ['gpu_fps', 'cpu_fps', 'vram']) {
    if (typeof body[key] === 'string') {
      try { body[key] = JSON.parse(body[key]); } catch { body[key] = null; }
    }
  }
  return validateGame(body);
};

adminRouter.get('/games', wrap(async (_req, res) => {
  ok(res, await rows('SELECT * FROM games ORDER BY builtin DESC, id'));
}));

adminRouter.post('/games', handleUpload(imageUpload), wrap(async (req, res) => {
  const parsed = gameBody(req);
  if (!parsed.ok) return fail(res, 400, 'validation', { fields: parsed.errors });
  const g = parsed.value;
  const slug = await uniqueSlug(slugify(g.title), 'games');
  let cover;
  if (req.file) {
    const mime = detectMime(req.file.buffer);
    if (!mime || !isImageMime(mime)) return fail(res, 400, 'image_invalid_type', { fields: { image: 'image_invalid_type' } });
    cover = await saveImage(req.file.buffer, mime, 'games', slug);
  } else {
    cover = await saveGeneratedSvg('games', slug, gameSvg(g));
  }
  const created = await row(
    `INSERT INTO games (slug, title, year, cover, gpu_fps, cpu_fps, vram, ram_gb, builtin)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, false) RETURNING *`,
    [slug, g.title, g.year, cover, JSON.stringify(g.gpu_fps), JSON.stringify(g.cpu_fps), JSON.stringify(g.vram), g.ram_gb],
  );
  return ok(res, created, 201);
}));

adminRouter.put('/games/:id', handleUpload(imageUpload), wrap(async (req, res) => {
  const id = Number(req.params.id);
  const existing = Number.isInteger(id) ? await row('SELECT * FROM games WHERE id = $1', [id]) : null;
  if (!existing) return fail(res, 404, 'not_found');
  const parsed = gameBody(req);
  if (!parsed.ok) return fail(res, 400, 'validation', { fields: parsed.errors });
  const g = parsed.value;
  let { cover } = existing;
  if (req.file) {
    const mime = detectMime(req.file.buffer);
    if (!mime || !isImageMime(mime)) return fail(res, 400, 'image_invalid_type', { fields: { image: 'image_invalid_type' } });
    cover = await saveImage(req.file.buffer, mime, 'games', existing.slug);
  }
  const active = req.body?.active === undefined ? existing.active : (req.body.active === true || req.body.active === 'true' || req.body.active === '1');
  const updated = await row(
    `UPDATE games SET title = $1, year = $2, cover = $3, gpu_fps = $4::jsonb, cpu_fps = $5::jsonb, vram = $6::jsonb, ram_gb = $7, active = $8
     WHERE id = $9 RETURNING *`,
    [g.title, g.year, cover, JSON.stringify(g.gpu_fps), JSON.stringify(g.cpu_fps), JSON.stringify(g.vram), g.ram_gb, active, id],
  );
  return ok(res, updated);
}));

adminRouter.delete('/games/:id', wrap(async (req, res) => {
  const r = await query('UPDATE games SET active = false WHERE id = $1', [Number(req.params.id) || 0]);
  return r.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));

// ───────── Настройки и Telegram ─────────
const settingsPayload = async () => ({
  telegram: {
    tokenConfigured: !!telegramToken(), // сам токен никогда не отдаётся
    chatId: await telegramChatId(),
    ready: await isTelegramConfigured(),
  },
  values: Object.fromEntries(await Promise.all(EDITABLE_SETTINGS.map(async (k) => [k, await getSetting(k)]))),
  defaults: { payment_card: config.payment.card, payment_holder: config.payment.holder },
});

adminRouter.get('/settings', wrap(async (_req, res) => ok(res, await settingsPayload())));

const SETTING_RULES = {
  telegram_chat_id: (v) => v === '' || /^-?\d{1,20}$/.test(v) || /^@[A-Za-z0-9_]{4,32}$/.test(v),
  payment_card: (v) => v.length <= 40,
  payment_holder: (v) => v.length <= 80,
  payment_note_ru: (v) => v.length <= 300,
  payment_note_uz: (v) => v.length <= 300,
};

adminRouter.put('/settings', wrap(async (req, res) => {
  const body = req.body ?? {};
  const errors = {};
  for (const key of EDITABLE_SETTINGS) {
    if (body[key] === undefined) continue;
    const value = String(body[key]).trim();
    if (!SETTING_RULES[key](value)) errors[key] = 'invalid';
  }
  if (Object.keys(errors).length) return fail(res, 400, 'validation', { fields: errors });
  for (const key of EDITABLE_SETTINGS) if (body[key] !== undefined) await setSetting(key, String(body[key]).trim());
  return ok(res, await settingsPayload());
}));

adminRouter.post('/telegram/test', wrap(async (_req, res) => {
  ok(res, await sendTestMessage());
}));
