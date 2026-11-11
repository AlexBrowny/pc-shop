import { Router } from 'express';
import { rows, row } from '../db.js';

export const catalogRouter = Router();

const SORTS = {
  price_asc: 'price_uzs ASC, id',
  price_desc: 'price_uzs DESC, id',
  name: 'brand ASC, name ASC',
  new: 'id DESC',
};

const ok = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

catalogRouter.get('/categories', wrap(async (_req, res) => {
  const data = await rows(
    `SELECT c.key, c.name_ru, c.name_uz, c.sort,
            (SELECT COUNT(*) FROM products p WHERE p.category = c.key AND p.active) AS count
     FROM categories c ORDER BY c.sort`,
  );
  res.json(ok(data));
}));

catalogRouter.get('/products', wrap(async (req, res) => {
  const where = ['active'];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  const {
    category, q, brand, min, max, ids,
  } = req.query;

  if (category) add('category = ?', String(category));
  if (brand) {
    const brands = String(brand).split(',').filter(Boolean);
    add('brand = ANY(?::text[])', brands);
  }
  if (q) {
    params.push(`%${String(q).replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(name ILIKE $${params.length} OR brand ILIKE $${params.length})`);
  }
  if (min !== undefined && min !== '' && Number.isFinite(Number(min))) add('price_uzs >= ?', Number(min));
  if (max !== undefined && max !== '' && Number.isFinite(Number(max))) add('price_uzs <= ?', Number(max));
  if (ids) {
    const list = String(ids).split(',').map(Number).filter(Number.isInteger);
    if (!list.length) return res.json(ok([]));
    add('id = ANY(?::int[])', list);
  }

  const order = SORTS[String(req.query.sort)] ?? SORTS.name;
  const data = await rows(`SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY ${order}`, params);
  return res.json(ok(data, { total: data.length }));
}));

catalogRouter.get('/products/:slug', wrap(async (req, res) => {
  const product = await row('SELECT * FROM products WHERE slug = $1 AND active', [req.params.slug]);
  if (!product) return res.status(404).json({ success: false, error: 'not_found' });
  return res.json(ok(product));
}));

catalogRouter.get('/brands', wrap(async (req, res) => {
  const { category } = req.query;
  const data = category
    ? await rows('SELECT DISTINCT brand FROM products WHERE active AND category = $1 ORDER BY brand', [String(category)])
    : await rows('SELECT DISTINCT brand FROM products WHERE active ORDER BY brand');
  res.json(ok(data.map((r) => r.brand)));
}));

catalogRouter.get('/games', wrap(async (_req, res) => {
  const data = await rows('SELECT * FROM games WHERE active ORDER BY builtin DESC, id');
  res.json(ok(data, { total: data.length }));
}));
