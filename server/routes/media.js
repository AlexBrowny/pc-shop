// Отдаёт изображения из Neon Object Storage (бакет media): /img/products/<имя>, /img/games/<имя>.
// Бакет закрыт; наружу выходят только ключи с безопасным именем в двух известных папках.
import crypto from 'node:crypto';
import { Router } from 'express';
import { getObject, MEDIA } from '../lib/storage.js';

export const mediaRouter = Router();

const KEY_RE = /^(products|games)\/[a-z0-9][a-z0-9._-]{0,120}\.(svg|png|jpg|webp)$/;
const IMMUTABLE_RE = /-[a-f0-9]{8}\.(png|jpg|webp)$/; // загруженные из админки: ключ содержит случайный суффикс
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 300;

/** Небольшой кэш в памяти: страница каталога запрашивает десятки картинок, ходить за каждой в хранилище незачем. */
const cache = new Map();

async function load(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const stored = await getObject(MEDIA, key);
  const value = stored && { ...stored, etag: `"${crypto.createHash('sha1').update(stored.buffer).digest('hex')}"` };
  if (value) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  }
  return value;
}

mediaRouter.get(/^\/(.+)$/, async (req, res, next) => {
  try {
    const key = req.params[0];
    if (!KEY_RE.test(key)) return res.status(404).end();
    const file = await load(key);
    if (!file) return res.status(404).end();

    res.setHeader('ETag', file.etag);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', IMMUTABLE_RE.test(key) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    // SVG открывается как картинка, но на случай прямого перехода запрещаем в нём любые скрипты
    if (key.endsWith('.svg')) res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    if (req.headers['if-none-match'] === file.etag) return res.status(304).end();
    return res.send(file.buffer);
  } catch (err) {
    return next(err);
  }
});
