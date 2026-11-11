// Применяет SQL-миграции из server/migrations по порядку. Запуск: `npm run migrate` (а также при старте сервера).
// Миграции идут по прямому (не pooled) соединению — PgBouncer в transaction-режиме не годится для DDL и advisory-блокировок.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const LOCK_ID = 7_272_001;

export async function migrate() {
  const client = new pg.Client({ connectionString: config.db.directUrl });
  await client.connect();
  const applied = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    if (config.db.schema) {
      if (!/^[a-z0-9_]+$/.test(config.db.schema)) throw new Error('DB_SCHEMA: допустимы только a-z, 0-9 и _');
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${config.db.schema}`);
      await client.query(`SET search_path TO ${config.db.schema}, public`);
    }
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      await client.query('BEGIN');
      try {
        await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Миграция ${file} не применена: ${err.message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end();
  }
  return applied;
}

// Запуск напрямую: node server/migrate.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then((applied) => process.stdout.write(applied.length ? `Applied: ${applied.join(', ')}\n` : 'Schema is up to date\n'))
    .catch((err) => { process.stderr.write(`${err.message}\n`); process.exit(1); });
}
