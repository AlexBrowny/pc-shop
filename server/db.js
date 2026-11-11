// Подключение к Postgres (Neon) через node-postgres. Сервер — долгоживущий процесс, поэтому пул переиспользуется.
import pg from 'pg';
import { config } from './config.js';

// bigint/numeric приходят строками — все наши значения (суммы, счётчики) укладываются в Number
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// timestamptz → ISO-строка (так её ждёт фронтенд и JSON)
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());

export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ...(config.db.schema ? { options: `-c search_path=${config.db.schema},public` } : {}),
});
pool.on('error', (err) => process.stderr.write(`pg pool error: ${err.message}\n`));

const helpers = (runner) => ({
  query: (text, params) => runner.query(text, params),
  rows: async (text, params) => (await runner.query(text, params)).rows,
  row: async (text, params) => (await runner.query(text, params)).rows[0] ?? null,
});

export const { query, rows, row } = helpers(pool);

/** Транзакция: fn получает те же query/rows/row, привязанные к одному соединению. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(helpers(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export const closeDb = () => pool.end();

export const productFromRow = (r) => r;
export const gameFromRow = (r) => r;
