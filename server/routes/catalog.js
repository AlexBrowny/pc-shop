import { Router } from 'express';
import { rows, row } from '../db.js';
import { SPEC_FIELDS, FILTER_SPECS } from '../lib/specs.js';

export const catalogRouter = Router();

const SORTS = {
  price_asc: 'p.price_uzs ASC, p.id',
  price_desc: 'p.price_uzs DESC, p.id',
  name: 'p.brand ASC, p.name ASC',
  new: 'p.id DESC',
  rating: 'COALESCE(r.avg, 0) DESC, COALESCE(r.n, 0) DESC, p.id',
};

const ok = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// Средняя оценка и число опубликованных отзывов подмешиваются в каждый товар
const RATING_JOIN = `
  LEFT JOIN (SELECT product_id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE status = 'published' GROUP BY product_id) r
    ON r.product_id = p.id`;
const PRODUCT_COLUMNS = 'p.*, COALESCE(r.avg, 0)::float AS rating_avg, COALESCE(r.n, 0)::int AS rating_count';

catalogRouter.get('/categories', wrap(async (_req, res) => {
  const data = await rows(
    `SELECT c.key, c.name_ru, c.name_uz, c.sort,
            (SELECT COUNT(*) FROM products p WHERE p.category = c.key AND p.active) AS count
     FROM categories c ORDER BY c.sort`,
  );
  res.json(ok(data));
}));

const csv = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30);

/**
 * Фильтры по характеристикам: s.<ключ>=a,b (значение из списка), r.<ключ>=мин-макс (диапазон).
 * Ключи проверяются по белому списку категории, значения всегда уходят параметрами запроса.
 * push(sql, ...values) подставляет $N вместо каждого «?» по порядку.
 */
function specFilters(category, query, push) {
  const allowed = new Set(FILTER_SPECS[category] ?? []);
  const fields = new Map((SPEC_FIELDS[category] ?? []).map((f) => [f.key, f]));
  for (const [name, raw] of Object.entries(query)) {
    const m = /^([sr])\.([a-z_0-9]+)$/.exec(name);
    if (!m || !allowed.has(m[2])) continue;
    const [, kind, key] = m;
    const field = fields.get(key);
    if (kind === 's') {
      const values = csv(raw);
      if (!values.length) continue;
      if (field.type === 'multi') push('(p.specs->?::text) ?| ?::text[]', key, values);
      else push('p.specs->>?::text = ANY(?::text[])', key, values);
    } else {
      const [lo, hi] = String(raw).split('-').map((v) => (v === '' ? NaN : Number(v)));
      if (Number.isFinite(lo)) push('(p.specs->>?::text)::numeric >= ?', key, lo);
      if (Number.isFinite(hi)) push('(p.specs->>?::text)::numeric <= ?', key, hi);
    }
  }
}

catalogRouter.get('/products', wrap(async (req, res) => {
  const where = ['p.active'];
  const params = [];
  const push = (sql, ...values) => {
    let i = 0;
    where.push(sql.replace(/\?/g, (token, offset) => {
      // «?|» — оператор jsonb, а не плейсхолдер
      if (sql[offset + 1] === '|') return token;
      params.push(values[i]);
      i += 1;
      return `$${params.length}`;
    }));
  };
  const {
    category, q, brand, min, max, ids, stock, rating,
  } = req.query;

  if (category) push('p.category = ?', String(category));
  if (brand) push('p.brand = ANY(?::text[])', csv(brand));
  if (q) {
    params.push(`%${String(q).replace(/[%_\\]/g, '\\$&')}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length})`);
  }
  if (min !== undefined && min !== '' && Number.isFinite(Number(min))) push('p.price_uzs >= ?', Number(min));
  if (max !== undefined && max !== '' && Number.isFinite(Number(max))) push('p.price_uzs <= ?', Number(max));
  if (stock === '1') where.push('p.stock > 0');
  if (rating && Number.isFinite(Number(rating))) push('COALESCE(r.avg, 0) >= ?', Number(rating));
  if (ids) {
    const list = String(ids).split(',').map(Number).filter(Number.isInteger);
    if (!list.length) return res.json(ok([]));
    push('p.id = ANY(?::int[])', list);
  }
  if (category) specFilters(String(category), req.query, push);

  const order = SORTS[String(req.query.sort)] ?? SORTS.name;
  const data = await rows(`SELECT ${PRODUCT_COLUMNS} FROM products p ${RATING_JOIN} WHERE ${where.join(' AND ')} ORDER BY ${order}`, params);
  return res.json(ok(data, { total: data.length }));
}));

/** Варианты фильтров категории: бренды, диапазон цен и значения характеристик (с количеством товаров). */
catalogRouter.get('/filters', wrap(async (req, res) => {
  const category = String(req.query.category ?? '');
  const keys = FILTER_SPECS[category];
  if (!keys) return res.json(ok({ price: null, brands: [], specs: [] }));
  const fields = new Map(SPEC_FIELDS[category].map((f) => [f.key, f]));

  const [price, brands] = await Promise.all([
    row('SELECT MIN(price_uzs) AS min, MAX(price_uzs) AS max FROM products WHERE active AND category = $1', [category]),
    rows('SELECT brand AS value, COUNT(*)::int AS count FROM products WHERE active AND category = $1 GROUP BY brand ORDER BY brand', [category]),
  ]);

  const specs = [];
  for (const key of keys) {
    const field = fields.get(key);
    const values = await rows(
      field.type === 'multi'
        ? 'SELECT v AS value, COUNT(*)::int AS count FROM products p, jsonb_array_elements_text(p.specs->$2::text) AS v WHERE p.active AND p.category = $1 GROUP BY v'
        : 'SELECT p.specs->>$2::text AS value, COUNT(*)::int AS count FROM products p WHERE p.active AND p.category = $1 AND p.specs->>$2::text IS NOT NULL GROUP BY 1',
      [category, key],
    );
    const numeric = field.type === 'int' || field.type === 'number';
    values.sort((a, b) => (numeric ? Number(a.value) - Number(b.value) : String(a.value).localeCompare(String(b.value), 'en', { numeric: true })));
    if (values.length > 1) specs.push({ key, type: field.type, numeric, values });
  }
  return res.json(ok({ price, brands, specs }));
}));

catalogRouter.get('/products/:slug', wrap(async (req, res) => {
  const product = await row(`SELECT ${PRODUCT_COLUMNS} FROM products p ${RATING_JOIN} WHERE p.slug = $1 AND p.active`, [req.params.slug]);
  if (!product) return res.status(404).json({ success: false, error: 'not_found' });
  const images = await rows('SELECT id, url FROM product_images WHERE product_id = $1 ORDER BY sort, id', [product.id]);
  return res.json(ok({ ...product, images }));
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
