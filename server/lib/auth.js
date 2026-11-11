// Аутентификация админки: пароль (scrypt или из окружения), серверные сессии, cookie HttpOnly + SameSite=Strict.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { getSetting, setSetting } from './settings.js';

export const SESSION_COOKIE = 'pcm_admin';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map(); // token -> expiresAt

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyHash(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Гарантирует, что пароль админа определён. Если он не задан в окружении и ещё не создан —
 * генерирует случайный, сохраняет только хеш и возвращает пароль, чтобы показать его один раз.
 */
export async function ensureAdminPassword() {
  if (config.admin.password) return null;
  if (await getSetting('admin_password_hash')) return null;
  const generated = crypto.randomBytes(12).toString('base64url');
  await setSetting('admin_password_hash', hashPassword(generated));
  return generated;
}

export async function checkCredentials(username, password) {
  const userOk = safeEqual(username ?? '', config.admin.user);
  let passOk = false;
  if (config.admin.password) {
    passOk = safeEqual(password ?? '', config.admin.password);
  } else {
    const stored = await getSetting('admin_password_hash');
    passOk = !!stored && verifyHash(String(password ?? ''), stored);
  }
  return userOk && passOk;
}

export function createSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function destroySession(token) {
  sessions.delete(token);
}

export function isValidSession(token) {
  if (!token) return false;
  const expires = sessions.get(token);
  if (!expires) return false;
  if (expires < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export const sessionTokenOf = (req) => parseCookies(req.headers.cookie)[SESSION_COOKIE];

export function setSessionCookie(res, token, secure) {
  const flags = [`${SESSION_COOKIE}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${SESSION_TTL_MS / 1000}`];
  if (secure) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

/** Middleware: требует действующую сессию; для изменяющих запросов — ещё и заголовок X-Admin-CSRF. */
export function requireAdmin(req, res, next) {
  if (!isValidSession(sessionTokenOf(req))) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (mutating && req.get('x-admin-csrf') !== '1') {
    return res.status(403).json({ success: false, error: 'csrf' });
  }
  return next();
}
