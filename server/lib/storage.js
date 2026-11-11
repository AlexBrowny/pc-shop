// Файлы в Neon Object Storage (S3-совместимое хранилище, ветвится вместе с БД).
// Используем Files SDK с адаптером `neon`: endpoint, регион и ключи берутся из AWS_* переменных, которые вносит `neon deploy`.
import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';
import { config } from '../config.js';

const clients = new Map();
const client = (bucket) => {
  if (!clients.has(bucket)) clients.set(bucket, new Files({ adapter: neon({ bucket }) }));
  return clients.get(bucket);
};

const withPrefix = (key) => `${config.storage.prefix}${key}`;
const isNotFound = (err) => err?.code === 'NotFound' || err?.status === 404 || /NoSuchKey|NotFound|not found/i.test(String(err?.message ?? ''));

export const RECEIPTS = config.storage.receiptsBucket;
export const MEDIA = config.storage.mediaBucket;

export async function putObject(bucket, key, body, contentType, { cacheControl } = {}) {
  await client(bucket).upload(withPrefix(key), body, { contentType, ...(cacheControl ? { cacheControl } : {}) });
}

/** Возвращает { buffer, contentType } или null, если объекта нет. */
export async function getObject(bucket, key) {
  try {
    const file = await client(bucket).download(withPrefix(key));
    return { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type || 'application/octet-stream' };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function deleteObject(bucket, key) {
  try {
    await client(bucket).delete(withPrefix(key));
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
}

/** Удаляет все объекты с префиксом (нужно тестам, чтобы убрать за собой). */
export async function deletePrefix(bucket, prefix) {
  let cursor;
  let removed = 0;
  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await client(bucket).list({ prefix: withPrefix(prefix), limit: 100, ...(cursor ? { cursor } : {}) });
    for (const item of page.items) {
      // eslint-disable-next-line no-await-in-loop
      await client(bucket).delete(item.key);
      removed += 1;
    }
    cursor = page.cursor;
  } while (cursor);
  return removed;
}

export async function objectExists(bucket, key) {
  return client(bucket).exists(withPrefix(key));
}
