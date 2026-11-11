// Начальное наполнение: каталог, игры (Postgres) и иллюстрации (Neon Object Storage, бакет media).
// Запуск: `npm run seed` (добавляет, если БД пуста) или `npm run seed -- --reset` (стереть и заполнить заново).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, row, tx, closeDb } from './db.js';
import { migrate } from './migrate.js';
import { CATEGORIES, PRODUCTS, USD_RATE } from '../data/products.js';
import { GAMES } from '../data/games.js';
import { productSvg, gameSvg, slugify } from './lib/illustrations.js';
import { putObject, MEDIA } from './lib/storage.js';

const roundPrice = (usd) => Math.round((usd * USD_RATE) / 10000) * 10000;
// Детерминированный остаток на складе (чтобы сид был воспроизводимым)
const stockFor = (index) => 3 + ((index * 7) % 18);
const UPLOAD_CONCURRENCY = 8;

/** Выполняет задачи пачками, чтобы не открывать сотню соединений к хранилищу сразу. */
async function runBatched(tasks, size) {
  for (let i = 0; i < tasks.length; i += size) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(tasks.slice(i, i + size).map((t) => t()));
  }
}

export async function uploadIllustrations() {
  const tasks = [
    ...PRODUCTS.map((p) => () => putObject(MEDIA, `products/${slugify(`${p.brand} ${p.name}`)}.svg`, Buffer.from(productSvg(p), 'utf8'), 'image/svg+xml', { cacheControl: 'public, max-age=3600' })),
    ...GAMES.map((g) => () => putObject(MEDIA, `games/${g.slug}.svg`, Buffer.from(gameSvg(g), 'utf8'), 'image/svg+xml', { cacheControl: 'public, max-age=3600' })),
  ];
  await runBatched(tasks, UPLOAD_CONCURRENCY);
  return tasks.length;
}

/**
 * Добавляет в БД встроенные игры, которых там ещё нет (по slug), и загружает их обложки.
 * Существующие игры и правки админа не трогает — безопасно вызывать при каждом запуске.
 */
export async function syncBuiltinGames() {
  const existing = new Set((await query('SELECT slug FROM games')).rows.map((r) => r.slug));
  const missing = GAMES.filter((g) => !existing.has(g.slug));
  if (!missing.length) return 0;
  await runBatched(
    missing.map((g) => () => putObject(MEDIA, `games/${g.slug}.svg`, Buffer.from(gameSvg(g), 'utf8'), 'image/svg+xml', { cacheControl: 'public, max-age=3600' })),
    UPLOAD_CONCURRENCY,
  );
  for (const g of missing) {
    // eslint-disable-next-line no-await-in-loop
    await query(
      `INSERT INTO games (slug, title, year, cover, gpu_fps, cpu_fps, vram, ram_gb, builtin)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, true) ON CONFLICT (slug) DO NOTHING`,
      [g.slug, g.title, g.year, `/img/games/${g.slug}.svg`, JSON.stringify(g.gpu_fps), JSON.stringify(g.cpu_fps), JSON.stringify(g.vram), g.ram_gb],
    );
  }
  return missing.length;
}

export async function seedIfEmpty({ reset = false } = {}) {
  if (reset) await query('TRUNCATE order_items, orders, products, games, categories RESTART IDENTITY CASCADE');

  const { n } = await row('SELECT COUNT(*) AS n FROM products');
  if (n > 0) return { seeded: false };

  await uploadIllustrations();

  await tx(async (db) => {
    for (const c of CATEGORIES) {
      await db.query('INSERT INTO categories (key, name_ru, name_uz, sort) VALUES ($1, $2, $3, $4)', [c.key, c.name_ru, c.name_uz, c.sort]);
    }
    for (const [i, p] of PRODUCTS.entries()) {
      const slug = slugify(`${p.brand} ${p.name}`);
      await db.query(
        `INSERT INTO products (category, slug, brand, name, price_uzs, stock, image, specs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [p.category, slug, p.brand, p.name, roundPrice(p.usd), stockFor(i), `/img/products/${slug}.svg`, JSON.stringify(p.specs)],
      );
    }
    for (const g of GAMES) {
      await db.query(
        `INSERT INTO games (slug, title, year, cover, gpu_fps, cpu_fps, vram, ram_gb, builtin)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, true)`,
        [g.slug, g.title, g.year, `/img/games/${g.slug}.svg`, JSON.stringify(g.gpu_fps), JSON.stringify(g.cpu_fps), JSON.stringify(g.vram), g.ram_gb],
      );
    }
  });
  return { seeded: true };
}

// Запуск напрямую: node server/seed.js [--reset]
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await migrate();
    const result = await seedIfEmpty({ reset: process.argv.includes('--reset') });
    const added = await syncBuiltinGames();
    if (added) process.stdout.write(`Добавлено новых игр: ${added}\n`);
    const counts = {
      products: (await row('SELECT COUNT(*) AS n FROM products')).n,
      games: (await row('SELECT COUNT(*) AS n FROM games')).n,
    };
    process.stdout.write(`${result.seeded ? 'Seeded' : 'Already seeded'}: ${JSON.stringify(counts)}\n`);
  } catch (err) {
    process.stderr.write(`${err.stack ?? err}\n`);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
