// Отзывы и оценки товаров. Читать могут все, писать — только вошедшие покупатели (один отзыв на товар).
import { Router } from 'express';
import { rows, row, query } from '../db.js';
import { rateLimiter } from '../lib/ratelimit.js';
import { loadUser, requireUser } from '../lib/customers.js';

export const reviewsRouter = Router();

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const fail = (res, status, error, extra = {}) => res.status(status).json({ success: false, error, ...extra });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

const MAX_BODY = 1500;
const writeLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 30 });

const productBySlug = (slug) => row('SELECT id FROM products WHERE slug = $1 AND active', [slug]);

reviewsRouter.get('/products/:slug/reviews', loadUser, wrap(async (req, res) => {
  const product = await productBySlug(req.params.slug);
  if (!product) return fail(res, 404, 'not_found');

  const items = await rows(
    `SELECT r.id, r.rating, r.body, r.created_at, r.status,
            split_part(u.name, ' ', 1) AS author,
            (r.user_id = $2) AS mine,
            EXISTS (SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
                    WHERE o.user_id = r.user_id AND i.product_id = r.product_id AND o.status IN ('paid', 'shipped', 'done')) AS verified
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1 AND (r.status = 'published' OR r.user_id = $2)
     ORDER BY r.created_at DESC LIMIT 100`,
    [product.id, req.user?.id ?? 0],
  );

  const published = items.filter((r) => r.status === 'published');
  const dist = [0, 0, 0, 0, 0];
  for (const r of published) dist[r.rating - 1] += 1;
  const count = published.length;
  const avg = count ? published.reduce((s, r) => s + r.rating, 0) / count : 0;

  return ok(res, {
    summary: { avg: Math.round(avg * 10) / 10, count, dist },
    items: items.map(({ status, ...r }) => ({ ...r, hidden: status === 'hidden' })),
    canReview: !!req.user,
  });
}));

reviewsRouter.post('/products/:slug/reviews', loadUser, requireUser, writeLimiter, wrap(async (req, res) => {
  const product = await productBySlug(req.params.slug);
  if (!product) return fail(res, 404, 'not_found');
  const rating = Number(req.body?.rating);
  const body = String(req.body?.body ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(res, 400, 'invalid_rating', { field: 'rating' });
  if (body.length > MAX_BODY) return fail(res, 400, 'review_too_long', { field: 'body' });

  // повторная отправка обновляет свой отзыв; статус (в том числе скрытие модератором) не меняется
  const saved = await row(
    `INSERT INTO reviews (product_id, user_id, rating, body) VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = now()
     RETURNING id`,
    [product.id, req.user.id, rating, body],
  );
  return ok(res, saved, 201);
}));

reviewsRouter.delete('/products/:slug/reviews', loadUser, requireUser, wrap(async (req, res) => {
  const product = await productBySlug(req.params.slug);
  if (!product) return fail(res, 404, 'not_found');
  await query('DELETE FROM reviews WHERE product_id = $1 AND user_id = $2', [product.id, req.user.id]);
  return ok(res, {});
}));
