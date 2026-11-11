// Загружает .env / .env.local (их заполняет `neon deploy`) и собирает настройки из переменных окружения.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['.env', '.env.local']) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

const env = process.env;

// Neon выдаёт sslmode=require; node-postgres предупреждает, что в будущем это станет verify-full.
// У Neon публичный сертификат, поэтому verify-full работает уже сейчас и убирает предупреждение.
const withVerifiedTls = (url) => (url ? url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full') : url);

export const config = {
  root,
  port: Number(env.PORT || 3000),
  publicDir: path.join(root, 'public'),
  isProduction: env.NODE_ENV === 'production',
  db: {
    // Пул приложения идёт через pooled-строку (PgBouncer). Для изолированной схемы (тесты) нужна прямая строка:
    // pooler не поддерживает параметр search_path при подключении.
    schema: env.DB_SCHEMA || '',
    url: withVerifiedTls(env.DB_SCHEMA ? (env.DATABASE_URL_UNPOOLED || env.DATABASE_URL) : env.DATABASE_URL),
    directUrl: withVerifiedTls(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL),
  },
  storage: {
    // Префикс ключей позволяет тестам работать в своей «папке» и убирать за собой.
    prefix: env.STORAGE_PREFIX || '',
    receiptsBucket: env.RECEIPTS_BUCKET || 'receipts',
    mediaBucket: env.MEDIA_BUCKET || 'media',
  },
  admin: {
    user: env.ADMIN_USER || 'admin',
    password: env.ADMIN_PASSWORD || '',
  },
  telegram: {
    token: env.TELEGRAM_BOT_TOKEN || '',
    chatId: env.TELEGRAM_CHAT_ID || '',
    apiBase: (env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, ''),
  },
  payment: {
    card: env.PAYMENT_CARD || '',
    holder: env.PAYMENT_HOLDER || '',
  },
  limits: {
    // на Vercel тело запроса функции ограничено 4,5 МБ
    receiptBytes: (process.env.VERCEL ? 4 : 10) * 1024 * 1024,
    imageBytes: 5 * 1024 * 1024,
    ordersPerHour: Number(env.ORDERS_PER_HOUR || 10),
    loginAttempts: Number(env.LOGIN_ATTEMPTS || 5),
  },
};

/** Приложение не запускается без Neon: говорим, чего именно не хватает. */
export function assertConfig() {
  const missing = ['DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_ENDPOINT_URL_S3', 'AWS_REGION'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Не заданы переменные окружения Neon: ${missing.join(', ')}. Выполните \`neon deploy\` (или \`neon env pull\`) в корне проекта.`);
  }
}
