// Аккаунты покупателей: регистрация по email + пароль (scrypt), подписанные stateless-сессии, cookie HttpOnly.
// Работает и на serverless: сервер ничего не хранит между запросами, подлинность токена проверяется подписью.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { row } from '../db.js';
import { parseCookies } from './auth.js';

const scrypt = promisify(crypto.scrypt);

export const CUSTOMER_COOKIE = 'pcm_user';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const KEY = crypto.createHash('sha256')
  .update(`pcm-customer:${process.env.SESSION_SECRET || config.admin.password || config.db.url || 'dev'}`)
  .digest();

const sign = (payload) => crypto.createHmac('sha256', KEY).update(payload).digest('base64url');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ───────── Пароли ─────────
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored ?? '').split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ───────── Валидация ─────────
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export const normalizeEmail = (raw) => {
  const email = String(raw ?? '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
};

export function validateRegistration(body) {
  const name = String(body?.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const email = normalizeEmail(body?.email);
  const password = String(body?.password ?? '');
  if (name.length < 2 || name.length > 60) return { error: 'invalid_name', field: 'name' };
  if (!email) return { error: 'invalid_email', field: 'email' };
  if (password.length < 8) return { error: 'weak_password', field: 'password' };
  if (password.length > 128) return { error: 'invalid_password', field: 'password' };
  return { value: { name, email, password } };
}

// ───────── Сессия ─────────
export function createToken(userId) {
  const payload = `${userId}.${Date.now() + TTL_MS}.${crypto.randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

/** Возвращает id пользователя из токена или null. */
export function userIdFromToken(token) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 4) return null;
  const payload = parts.slice(0, 3).join('.');
  if (!safeEqual(parts[3], sign(payload))) return null;
  const id = Number(parts[0]);
  return Number.isInteger(id) && id > 0 && Number(parts[1]) > Date.now() ? id : null;
}

export function setCustomerCookie(res, token, secure) {
  const flags = [`${CUSTOMER_COOKIE}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${TTL_MS / 1000}`];
  if (secure) flags.push('Secure');
  res.append('Set-Cookie', flags.join('; '));
}

export const clearCustomerCookie = (res) => res.append('Set-Cookie', `${CUSTOMER_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

/** Подгружает покупателя в req.user (если есть валидная cookie и пользователь существует). */
export async function loadUser(req, _res, next) {
  try {
    const id = userIdFromToken(parseCookies(req.headers.cookie)[CUSTOMER_COOKIE]);
    req.user = id ? await row('SELECT id, email, name FROM users WHERE id = $1', [id]) : null;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Защита от CSRF для изменяющих запросов: SameSite=Lax + обязательный нестандартный заголовок
 * (чужой сайт не может отправить его без CORS-предзапроса, который сервер не разрешает).
 */
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'unauthorized' });
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (mutating && req.get('x-requested-with') !== 'pcm') return res.status(403).json({ success: false, error: 'csrf' });
  return next();
}
