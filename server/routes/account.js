// Личный кабинет покупателя: регистрация/вход, история заказов, сохранённые сборки.
import { Router } from 'express';
import { config } from '../config.js';
import { rows, row, query } from '../db.js';
import { rateLimiter } from '../lib/ratelimit.js';
import {
  hashPassword, verifyPassword, validateRegistration, normalizeEmail, createToken, setCustomerCookie, clearCustomerCookie,
  publicUser, loadUser, requireUser,
} from '../lib/customers.js';

export const accountRouter = Router();
accountRouter.use(loadUser);

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const registerLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const loginLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, onlyFailures: true });
const secure = (req) => req.secure || config.isProduction;
const noStore = (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); };
accountRouter.use(noStore);

// Хеш-пустышка: при неизвестном email тратим столько же времени, сколько при проверке настоящего пароля
const DUMMY_HASH = await hashPassword('dummy-password-for-timing');

accountRouter.post('/register', registerLimiter, wrap(async (req, res) => {
  const v = validateRegistration(req.body);
  if (v.error) return fail(res, 400, v.error, { field: v.field });
  const { name, email, password } = v.value;
  if (await row('SELECT 1 FROM users WHERE lower(email) = $1', [email])) return fail(res, 409, 'email_taken', { field: 'email' });
  let user;
  try {
    user = await row('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name', [email, name, await hashPassword(password)]);
  } catch (err) {
    if (err.code === '23505') return fail(res, 409, 'email_taken', { field: 'email' }); // гонка двух регистраций
    throw err;
  }
  setCustomerCookie(res, createToken(user.id), secure(req));
  return ok(res, publicUser(user), 201);
}));

accountRouter.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  const user = email ? await row('SELECT * FROM users WHERE lower(email) = $1', [email]) : null;
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) return fail(res, 401, 'invalid_credentials');
  setCustomerCookie(res, createToken(user.id), secure(req));
  return ok(res, publicUser(user));
}));

accountRouter.post('/logout', (_req, res) => {
  clearCustomerCookie(res);
  ok(res, {});
});

accountRouter.get('/me', (req, res) => ok(res, req.user ? publicUser(req.user) : null));

accountRouter.use(requireUser);

// ───────── История заказов ─────────
accountRouter.get('/orders', wrap(async (req, res) => {
  const orders = await rows(
    `SELECT id, total_uzs, status, payment_method, payment_status, created_at
     FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50`,
    [req.user.id],
  );
  const ids = orders.map((o) => o.id);
  const items = ids.length ? await rows('SELECT order_id, brand, name, price_uzs, qty FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id', [ids]) : [];
  return ok(res, orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) })));
}));

// ───────── Сохранённые сборки ─────────
const SINGLE_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'psu', 'case', 'cooler'];
const MAX_BUILDS = 30;
const MAX_STORAGE = 6;

const isId = (v) => Number.isInteger(v) && v > 0;

/** Проверяет состав сборки: известные слоты, целые id. Возвращает нормализованный объект или null. */
export function parseBuildIds(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { storage: [] };
  for (const slot of SINGLE_SLOTS) {
    const v = raw[slot];
    if (v === null || v === undefined) out[slot] = null;
    else if (isId(v)) out[slot] = v;
    else return null;
  }
  const storage = raw.storage ?? [];
  if (!Array.isArray(storage) || storage.length > MAX_STORAGE || !storage.every(isId)) return null;
  out.storage = storage;
  return SINGLE_SLOTS.some((s) => out[s]) || out.storage.length ? out : null;
}

accountRouter.get('/builds', wrap(async (req, res) => {
  ok(res, await rows('SELECT id, name, ids, created_at FROM saved_builds WHERE user_id = $1 ORDER BY id DESC', [req.user.id]));
}));

accountRouter.post('/builds', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60);
  const ids = parseBuildIds(req.body?.ids);
  if (!name) return fail(res, 400, 'invalid_name', { field: 'name' });
  if (!ids) return fail(res, 400, 'invalid_build');
  const all = [...SINGLE_SLOTS.map((s) => ids[s]).filter(Boolean), ...ids.storage];
  const known = await row('SELECT COUNT(*) AS n FROM products WHERE active AND id = ANY($1::int[])', [[...new Set(all)]]);
  if (known.n !== new Set(all).size) return fail(res, 400, 'invalid_build');
  if ((await row('SELECT COUNT(*) AS n FROM saved_builds WHERE user_id = $1', [req.user.id])).n >= MAX_BUILDS) return fail(res, 409, 'too_many_builds');
  const saved = await row('INSERT INTO saved_builds (user_id, name, ids) VALUES ($1, $2, $3::jsonb) RETURNING id, name, ids, created_at', [req.user.id, name, JSON.stringify(ids)]);
  return ok(res, saved, 201);
}));

accountRouter.delete('/builds/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!isId(id)) return fail(res, 404, 'not_found');
  const removed = await query('DELETE FROM saved_builds WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  return removed.rowCount ? ok(res, {}) : fail(res, 404, 'not_found');
}));
