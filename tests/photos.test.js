// Фото товаров: сопоставление файлов с товарами, безопасная загрузка по ссылке (SSRF), замена главного фото, второе фото в списках.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

import { suggestProduct, photoRole, matchScore } from '../server/admin-ui/match.js';
import { isPrivateAddress, fetchRemoteImage } from '../server/lib/remote-image.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// ───────── Чистая логика (без БД) ─────────
const catalog = [
  { id: 1, brand: 'NVIDIA', name: 'GeForce RTX 4070 SUPER 12GB' },
  { id: 2, brand: 'NVIDIA', name: 'GeForce RTX 4070 Ti SUPER 16GB' },
  { id: 3, brand: 'AMD', name: 'Ryzen 5 5600' },
  { id: 4, brand: 'AMD', name: 'Ryzen 5 7600' },
  { id: 5, brand: 'Kingston', name: 'NV2 500GB' },
  { id: 6, brand: 'Kingston', name: 'NV2 1TB' },
];

test('автосопоставление: уверенные совпадения находятся, неоднозначные — нет', () => {
  assert.equal(suggestProduct('nvidia-geforce-rtx-4070-super-12gb.jpg', catalog)?.id, 1);
  assert.equal(suggestProduct('NVIDIA_GeForce_RTX_4070_Ti_SUPER_16GB.PNG', catalog)?.id, 2);
  assert.equal(suggestProduct('amd ryzen 5 5600.webp', catalog)?.id, 3);
  assert.equal(suggestProduct('amd-ryzen-5-7600-box.jpg', catalog)?.id, 4);
  assert.equal(suggestProduct('kingston-nv2-1tb.jpg', catalog)?.id, 6);
  assert.equal(suggestProduct('kingston-nv2.jpg', catalog), null, 'две ёмкости подходят одинаково — выбирает человек');
  assert.equal(suggestProduct('IMG_20240101_1234.jpg', catalog), null);
  assert.equal(suggestProduct('random-cat.png', catalog), null);
  assert.ok(matchScore('amd ryzen 5 5600.jpg', catalog[2]) > matchScore('amd ryzen 5 5600.jpg', catalog[3]));
});

test('роль файла: номер 2–9 в конце — дополнительное фото; цифры из названия модели не мешают', () => {
  assert.equal(photoRole('amd-ryzen-5-5600.jpg', catalog[2]), 'main');
  assert.equal(photoRole('amd-ryzen-5-5600-2.jpg', catalog[2]), 'gallery');
  assert.equal(photoRole('amd_ryzen_5_5600_3.png', catalog[2]), 'gallery');
  assert.equal(photoRole('amd ryzen 5.jpg', { brand: 'AMD', name: 'Ryzen 5' }), 'main', '«5» — часть названия');
});

test('запрещённые адреса распознаются: локальные, частные, link-local, IPv6, IPv4-mapped', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '151.101.1.69', '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

const expectCode = async (promise, code) => {
  await assert.rejects(promise, (err) => err.code === code, code);
};

test('загрузка по ссылке отклоняет опасные адреса до обращения к сети', async () => {
  const opts = { maxBytes: 1024 * 1024 };
  await expectCode(fetchRemoteImage('not a url', opts), 'invalid_url');
  await expectCode(fetchRemoteImage('ftp://example.com/a.png', opts), 'invalid_url');
  await expectCode(fetchRemoteImage('http://example.com/a.png', opts), 'invalid_url');
  await expectCode(fetchRemoteImage('https://user:pass@example.com/a.png', opts), 'invalid_url');
  await expectCode(fetchRemoteImage('https://127.0.0.1/a.png', opts), 'blocked_host');
  await expectCode(fetchRemoteImage('https://169.254.169.254/latest/meta-data', opts), 'blocked_host');
  await expectCode(fetchRemoteImage('https://[::1]/a.png', opts), 'blocked_host');
  await expectCode(fetchRemoteImage('https://localhost/a.png', opts), 'blocked_host');
});

// ───────── Локальный «внешний» сервер для проверки скачивания ─────────
const remote = http.createServer((req, res) => {
  if (req.url === '/ok.png') { res.setHeader('Content-Type', 'image/png'); return res.end(PNG); }
  if (req.url === '/big.png') { res.setHeader('Content-Type', 'image/png'); return res.end(Buffer.alloc(300_000, 1)); }
  if (req.url === '/redirect') { res.statusCode = 302; res.setHeader('Location', '/ok.png'); return res.end(); }
  if (req.url === '/loop') { res.statusCode = 302; res.setHeader('Location', '/loop'); return res.end(); }
  if (req.url === '/text.png') { res.setHeader('Content-Type', 'image/png'); return res.end('<html>not an image</html>'); }
  if (req.url === '/svg.png') { res.setHeader('Content-Type', 'image/png'); return res.end('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'); }
  res.statusCode = 404;
  return res.end();
});
await new Promise((resolve) => remote.listen(0, '127.0.0.1', resolve));
const remoteBase = `http://127.0.0.1:${remote.address().port}`;

test('загрузка по ссылке: успех, редирект, лимит размера, петля редиректов, 404', async () => {
  const opts = { maxBytes: 100_000, allowPrivate: true };
  assert.ok((await fetchRemoteImage(`${remoteBase}/ok.png`, opts)).equals(PNG));
  assert.ok((await fetchRemoteImage(`${remoteBase}/redirect`, opts)).equals(PNG));
  await expectCode(fetchRemoteImage(`${remoteBase}/big.png`, opts), 'too_large');
  await expectCode(fetchRemoteImage(`${remoteBase}/loop`, opts), 'too_many_redirects');
  await expectCode(fetchRemoteImage(`${remoteBase}/missing.png`, opts), 'fetch_failed');
});

// ───────── Интеграция с БД и админкой ─────────
const runId = crypto.randomBytes(4).toString('hex');
const SCHEMA = `pcm_test_${runId}`;
Object.assign(process.env, {
  DB_SCHEMA: SCHEMA,
  STORAGE_PREFIX: `test-${runId}/`,
  ADMIN_USER: 'boss',
  ADMIN_PASSWORD: 'correct horse battery',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  STRIPE_SECRET_KEY: '',
  ORDERS_PER_HOUR: '1000',
});

const { assertConfig } = await import('../server/config.js');
assertConfig();
const { migrate } = await import('../server/migrate.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { row, closeDb } = await import('../server/db.js');
const storage = await import('../server/lib/storage.js');

await migrate();
await seedIfEmpty();
const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  server.close();
  remote.close();
  delete process.env.IMAGE_IMPORT_ALLOW_PRIVATE;
  await storage.deletePrefix(storage.RECEIPTS, '');
  await storage.deletePrefix(storage.MEDIA, '');
  await closeDb();
  const { default: pg } = await import('pg');
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED.replace(/sslmode=\w+/, 'sslmode=verify-full') });
  await admin.connect();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await admin.end();
});

const loginRes = await fetch(`${base}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse battery' }),
});
const cookie = loginRes.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const admin = async (path, { method = 'GET', json, form } = {}) => {
  const headers = { cookie, 'x-admin-csrf': '1' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/admin${path}`, { method, headers, body: form ?? (json === undefined ? undefined : JSON.stringify(json)) });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const file = (buffer, name = 'photo.png', type = 'image/png') => {
  const form = new FormData();
  form.set('image', new Blob([buffer], { type }), name);
  return form;
};

const product = await row("SELECT id, slug, image FROM products WHERE category = 'cpu' ORDER BY id LIMIT 1");

test('главное фото заменяет иллюстрацию; без входа и с не-картинкой — отказ', async () => {
  assert.ok(product.image.endsWith('.svg'), 'до загрузки — иллюстрация');
  assert.equal((await fetch(`${base}/api/admin/products/${product.id}/main-image`, { method: 'PUT', body: file(PNG) })).status, 401);
  assert.equal((await admin(`/products/${product.id}/main-image`, { method: 'PUT', form: file(Buffer.from('plain text'), 'a.png') })).status, 400);
  assert.equal((await admin(`/products/${product.id}/main-image`, { method: 'PUT', form: file(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg', 'image/svg+xml') })).status, 400);
  assert.equal((await admin('/products/999999/main-image', { method: 'PUT', form: file(PNG) })).status, 404);

  const res = await admin(`/products/${product.id}/main-image`, { method: 'PUT', form: file(PNG) });
  assert.equal(res.status, 200);
  assert.match(res.body.data.image, /^\/img\/products\/.+\.png$/);
  const stored = await row('SELECT image FROM products WHERE id = $1', [product.id]);
  assert.equal(stored.image, res.body.data.image);
  assert.equal((await fetch(`${base}${stored.image}`)).status, 200);
});

test('импорт по ссылке: внутренние адреса запрещены, а разрешённый сервер работает; подмена типа не проходит', async () => {
  const other = await row("SELECT id FROM products WHERE category = 'gpu' ORDER BY id LIMIT 1");
  const post = (url, as) => admin(`/products/${other.id}/images/from-url`, { method: 'POST', json: { url, as } });

  // по умолчанию локальные адреса недоступны
  assert.equal((await post(`${remoteBase}/ok.png`, 'main')).body.error, 'invalid_url', 'http запрещён');
  assert.equal((await post('https://127.0.0.1/x.png', 'main')).body.error, 'blocked_host');
  assert.equal((await post('https://localhost/x.png', 'main')).body.error, 'blocked_host');
  assert.equal((await post('javascript:alert(1)', 'main')).body.error, 'invalid_url');
  assert.equal((await fetch(`${base}/api/admin/products/${other.id}/images/from-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);

  process.env.IMAGE_IMPORT_ALLOW_PRIVATE = '1';
  try {
    assert.equal((await post(`${remoteBase}/text.png`, 'main')).body.error, 'image_invalid_type', 'тип проверяется по содержимому');
    assert.equal((await post(`${remoteBase}/svg.png`, 'main')).body.error, 'image_invalid_type', 'SVG под видом PNG отклоняется');
    const main = await post(`${remoteBase}/ok.png`, 'main');
    assert.equal(main.status, 201);
    assert.match(main.body.data.image, /\.png$/);
    const gallery = await post(`${remoteBase}/redirect`, 'gallery');
    assert.equal(gallery.status, 201);
    assert.match(gallery.body.data.url, /^\/img\/products\//);
  } finally {
    delete process.env.IMAGE_IMPORT_ALLOW_PRIVATE;
  }
});

test('в списке товаров приходит второе фото (для смены при наведении), на странице — вся галерея', async () => {
  const list = (await (await fetch(`${base}/api/products?category=gpu`)).json()).data;
  const withPhoto = list.find((p) => p.image2);
  assert.ok(withPhoto, 'у товара с галереей есть image2');
  assert.match(withPhoto.image2, /^\/img\/products\//);
  assert.ok(list.filter((p) => !p.image2).length > 0, 'у остальных image2 пустой');

  const detail = (await (await fetch(`${base}/api/products/${withPhoto.slug}`)).json()).data;
  assert.equal(detail.images.length, 1);
  assert.equal(detail.images[0].url, withPhoto.image2);
});
