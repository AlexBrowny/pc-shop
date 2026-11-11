// Интеграционные тесты против реального Neon: Postgres (отдельная схема на прогон) и Object Storage (отдельный префикс ключей).
// Telegram подменён локальным сервером. После прогона схема и объекты удаляются.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

// ───────── Мок Telegram Bot API ─────────
const telegram = { requests: [], failNext: false };
const mock = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    telegram.requests.push({ url: req.url, type: req.headers['content-type'] ?? '', body: Buffer.concat(chunks) });
    res.setHeader('Content-Type', 'application/json');
    if (telegram.failNext) {
      telegram.failNext = false;
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, description: 'Unauthorized: bot123456:SECRETTOKEN/sendMessage' }));
    }
    return res.end(JSON.stringify({ ok: true, result: {} }));
  });
});
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));

// ───────── Окружение до импорта приложения ─────────
const runId = crypto.randomBytes(4).toString('hex');
const SCHEMA = `pcm_test_${runId}`;
const PREFIX = `test-${runId}/`;
const TOKEN = '123456:SECRETTOKEN';
Object.assign(process.env, {
  DB_SCHEMA: SCHEMA,
  STORAGE_PREFIX: PREFIX,
  ADMIN_USER: 'boss',
  ADMIN_PASSWORD: 'correct horse battery',
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_CHAT_ID: '555',
  TELEGRAM_API_BASE: `http://127.0.0.1:${mock.address().port}`,
  ORDERS_PER_HOUR: '1000',
  LOGIN_ATTEMPTS: '3',
});

const { assertConfig } = await import('../server/config.js');
assertConfig();
const { migrate } = await import('../server/migrate.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { rows, row, query, pool, closeDb } = await import('../server/db.js');
const storage = await import('../server/lib/storage.js');

await migrate();
await seedIfEmpty();
const app = createApp();
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  server.close();
  mock.close();
  await storage.deletePrefix(storage.RECEIPTS, '');
  await storage.deletePrefix(storage.MEDIA, '');
  await closeDb();
  const { default: pg } = await import('pg');
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED.replace(/sslmode=\w+/, 'sslmode=verify-full') });
  await admin.connect();
  await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
  await admin.end();
});

// ───────── Помощники ─────────
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(64, 1)]);

const product = (name) => row('SELECT * FROM products WHERE name = $1', [name]);

async function orderForm({ name = 'Алишер', phone = '90 123 45 67', items, file = PNG, filename = 'check.png', extra = {} } = {}) {
  const form = new FormData();
  form.set('name', name);
  form.set('phone', phone);
  form.set('address', 'Ташкент, Чиланзар');
  form.set('lang', 'ru');
  form.set('items', JSON.stringify(items ?? [{ id: (await product('Ryzen 5 5600')).id, qty: 2 }]));
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  if (file) form.set('receipt', new Blob([file]), filename);
  return form;
}
const postOrder = async (opts) => fetch(`${base}/api/orders`, { method: 'POST', body: await orderForm(opts) });

let cookie = '';
async function adminFetch(url, { method = 'GET', json, form, csrf = true } = {}) {
  const headers = { cookie };
  if (csrf) headers['x-admin-csrf'] = '1';
  let body;
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  return fetch(`${base}/api/admin${url}`, { method, headers, body });
}

before(async () => {
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse battery' }),
  });
  assert.equal(res.status, 200);
  cookie = res.headers.get('set-cookie').split(';')[0];
});

// ───────── Neon Postgres ─────────
test('данные лежат в Postgres Neon: каталог, игры, jsonb-характеристики', async () => {
  const cats = await (await fetch(`${base}/api/categories`)).json();
  assert.equal(cats.data.length, 8);
  assert.equal(typeof cats.data[0].count, 'number');
  const gpus = (await (await fetch(`${base}/api/products?category=gpu&sort=price_desc`)).json()).data;
  assert.equal(gpus.length, 17);
  assert.equal(typeof gpus[0].price_uzs, 'number');
  assert.equal(typeof gpus[0].specs.vram_gb, 'number');
  assert.ok(gpus[0].price_uzs >= gpus[1].price_uzs);
  assert.ok((await (await fetch(`${base}/api/games`)).json()).data.length >= 50);
  const found = (await (await fetch(`${base}/api/products?q=ryzen%207`)).json()).data;
  assert.ok(found.length >= 2, 'регистронезависимый поиск ILIKE');
  const { rows: [v] } = await pool.query('SELECT version() AS v, current_schema() AS s');
  assert.match(v.v, /PostgreSQL/);
  assert.equal(v.s, SCHEMA);
});

test('SQL-инъекция в поиске и фильтрах не ломает запрос и не находит лишнего', async () => {
  const inj = encodeURIComponent("' OR 1=1; DROP TABLE products; --");
  const res = await fetch(`${base}/api/products?q=${inj}&brand=${inj}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.length, 0);
  assert.ok((await row('SELECT COUNT(*) AS n FROM products')).n >= 78);
});

// ───────── Neon Object Storage: картинки ─────────
test('картинки каталога отдаются из бакета media, есть ETag/304, чужие пути закрыты', async () => {
  const p = await product('Ryzen 7 7800X3D');
  assert.match(p.image, /^\/img\/products\/.+\.svg$/);
  const res = await fetch(`${base}${p.image}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
  assert.match(res.headers.get('content-security-policy'), /sandbox/);
  assert.match(await res.text(), /^<svg/);

  const etag = res.headers.get('etag');
  const cached = await fetch(`${base}${p.image}`, { headers: { 'if-none-match': etag } });
  assert.equal(cached.status, 304);

  assert.equal((await fetch(`${base}/img/products/nope-nope.svg`)).status, 404);
  assert.equal((await fetch(`${base}/img/..%2F..%2Fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/img/receipts/anything.png`)).status, 404);
  const game = (await (await fetch(`${base}/api/games`)).json()).data[0];
  assert.equal((await fetch(`${base}${game.cover}`)).status, 200);
});

// ───────── Заказы + Neon Object Storage: чеки ─────────
test('заказ с чеком: цена с сервера, остаток списан, чек лежит в бакете receipts, менеджеру уходят сообщение и фото', async () => {
  const p = await product('Ryzen 5 5600');
  const stockBefore = p.stock;
  telegram.requests.length = 0;
  const res = await postOrder({ extra: { price: '1' } }); // «цена» от клиента игнорируется
  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.equal(data.total_uzs, p.price_uzs * 2);
  assert.equal((await product('Ryzen 5 5600')).stock, stockBefore - 2);

  const saved = await row('SELECT receipt_file, receipt_mime, telegram_status FROM orders WHERE id = $1', [data.id]);
  assert.match(saved.receipt_file, /^receipts\/[a-f0-9]{32}\.png$/);
  const stored = await storage.getObject(storage.RECEIPTS, saved.receipt_file);
  assert.ok(stored, 'объект чека есть в Neon Object Storage');
  assert.ok(stored.buffer.equals(PNG), 'содержимое в хранилище совпадает с загруженным файлом');
  assert.equal(stored.contentType, 'image/png');
  assert.equal(saved.telegram_status, 'sent');

  const urls = telegram.requests.map((r) => r.url);
  assert.ok(urls.some((u) => u.endsWith('/sendMessage')));
  assert.ok(urls.some((u) => u.endsWith('/sendPhoto')));
  const msg = JSON.parse(telegram.requests.find((r) => r.url.endsWith('/sendMessage')).body.toString());
  assert.match(msg.text, new RegExp(`Новый заказ №${data.id}`));
  assert.match(msg.text, /\+998901234567/);
  assert.ok(telegram.requests.find((r) => r.url.endsWith('/sendPhoto')).body.includes(PNG), 'в Telegram ушёл файл из хранилища');
  assert.ok(!JSON.stringify(data).includes(TOKEN));
});

test('PDF-чек уходит как документ, имя клиента экранируется в HTML-сообщении', async () => {
  telegram.requests.length = 0;
  const res = await postOrder({ name: '<b>Хакер</b>', file: PDF, filename: 'check.pdf' });
  assert.equal(res.status, 201);
  assert.ok(telegram.requests.some((r) => r.url.endsWith('/sendDocument')));
  const msg = JSON.parse(telegram.requests.find((r) => r.url.endsWith('/sendMessage')).body.toString());
  assert.ok(msg.text.includes('&lt;b&gt;Хакер&lt;/b&gt;'));
  assert.ok(!msg.text.includes('<b>Хакер</b>'));
});

test('файл не картинка и не PDF отклоняется и в хранилище не попадает', async () => {
  const before = (await row('SELECT COUNT(*) AS n FROM orders')).n;
  const res = await postOrder({ file: Buffer.from('<script>alert(1)</script> this is not an image'), filename: 'check.png' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'receipt_invalid_type');
  assert.equal((await row('SELECT COUNT(*) AS n FROM orders')).n, before);
});

test('без чека, с неверным телефоном и с пустой корзиной — 400', async () => {
  assert.equal((await (await postOrder({ file: null })).json()).error, 'receipt_required');
  assert.equal((await (await postOrder({ phone: '12345' })).json()).error, 'invalid_phone');
  assert.equal((await (await postOrder({ items: [] })).json()).error, 'invalid_items');
  assert.equal((await (await postOrder({ items: [{ id: 999999, qty: 1 }] })).json()).error, 'unknown_product');
});

test('превышение остатка — 409, остаток не меняется', async () => {
  const p = await product('Core i3-12100F');
  const res = await postOrder({ items: [{ id: p.id, qty: 99 }] });
  assert.equal(res.status, 409);
  assert.equal((await product('Core i3-12100F')).stock, p.stock);
});

test('два одновременных заказа на последний экземпляр: один проходит, второй получает 409, остаток не уходит в минус', async () => {
  const p = await product('Ryzen 9 9950X');
  await query('UPDATE products SET stock = 1 WHERE id = $1', [p.id]);
  const items = [{ id: p.id, qty: 1 }];
  const [a, b] = await Promise.all([postOrder({ items }), postOrder({ items })]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal((await product('Ryzen 9 9950X')).stock, 0);
  // чек проигравшего заказа не должен остаться в хранилище «сиротой»
  const orphan = (await rows('SELECT receipt_file FROM orders')).map((r) => r.receipt_file);
  const stored = await storage.deletePrefix(storage.RECEIPTS, 'receipts/');
  assert.equal(stored, orphan.length, 'в бакете ровно столько чеков, сколько заказов в БД');
});

test('сбой Telegram не отменяет заказ, токен не попадает в ошибку, повторная отправка работает', async () => {
  // предыдущий тест очистил бакет, поэтому сначала оформляем новый заказ
  telegram.failNext = true;
  const res = await postOrder();
  assert.equal(res.status, 201);
  const { id } = (await res.json()).data;
  const detail = await (await adminFetch(`/orders/${id}`)).json();
  assert.equal(detail.data.telegram_status, 'failed');
  assert.ok(!detail.data.telegram_error.includes('SECRETTOKEN'));

  const resend = await (await adminFetch(`/orders/${id}/resend-telegram`, { method: 'POST' })).json();
  assert.equal(resend.data.status, 'sent');
});

test('отмена заказа возвращает товар на склад, отменённый заказ нельзя оживить', async () => {
  const p = await product('Ryzen 5 5600');
  const res = await postOrder({ items: [{ id: p.id, qty: 3 }] });
  const { id } = (await res.json()).data;
  assert.equal((await product('Ryzen 5 5600')).stock, p.stock - 3);

  assert.equal((await adminFetch(`/orders/${id}`, { method: 'PATCH', json: { status: 'cancelled' } })).status, 200);
  assert.equal((await product('Ryzen 5 5600')).stock, p.stock);
  assert.equal((await adminFetch(`/orders/${id}`, { method: 'PATCH', json: { status: 'paid' } })).status, 409);
  assert.equal((await adminFetch(`/orders/${id}`, { method: 'PATCH', json: { status: 'bogus' } })).status, 400);
});

// ───────── Админка: доступ ─────────
test('без сессии админский API закрыт (401), с неверным паролем вход невозможен', async () => {
  assert.equal((await fetch(`${base}/api/admin/orders`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/products`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/orders/1/receipt`)).status, 401);
  const bad = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'wrong' }) });
  assert.equal(bad.status, 401);
});

test('изменяющие запросы без заголовка CSRF отклоняются', async () => {
  const res = await adminFetch('/orders/1', { method: 'PATCH', json: { admin_note: 'x' }, csrf: false });
  assert.equal(res.status, 403);
});

test('чек доступен только админу: отдаётся из хранилища с nosniff, публичного доступа к бакету нет', async () => {
  const created = await (await postOrder()).json();
  const { id } = created.data;
  const res = await adminFetch(`/orders/${id}/receipt`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(PNG));
  const { receipt_file: key } = await row('SELECT receipt_file FROM orders WHERE id = $1', [id]);
  assert.equal((await fetch(`${base}/${key}`)).status, 404);
  assert.equal((await fetch(`${base}/img/${key}`)).status, 404);
  assert.equal((await fetch(`${base}/api/admin/orders/${id}/receipt`)).status, 401);
});

test('страница /admin не раскрывает данных и закрыта от индексации', async () => {
  const res = await fetch(`${base}/admin`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
});

// ───────── Админка: товары и игры ─────────
test('товар с некорректными характеристиками не создаётся, с корректными — появляется в каталоге, картинка уходит в бакет media', async () => {
  const bad = new FormData();
  Object.entries({ category: 'gpu', brand: 'Test', name: 'Broken GPU', price_uzs: '1000000', stock: '5', specs: JSON.stringify({ chip: 'X' }) }).forEach(([k, v]) => bad.set(k, v));
  const badRes = await adminFetch('/products', { method: 'POST', form: bad });
  assert.equal(badRes.status, 400);
  assert.ok((await badRes.json()).fields.specs.vram_gb);

  const good = new FormData();
  const specs = { chip: 'TestChip', vram_gb: 16, length_mm: 280, power_w: 250, rec_psu_w: 650, connector: '1×8-pin', score: 180 };
  Object.entries({ category: 'gpu', brand: 'Test', name: 'Super GPU 9000', price_uzs: '9000000', stock: '4', specs: JSON.stringify(specs) }).forEach(([k, v]) => good.set(k, v));
  const res = await adminFetch('/products', { method: 'POST', form: good });
  assert.equal(res.status, 201);
  const created = (await res.json()).data;
  assert.equal(created.image, '/img/products/test-super-gpu-9000.svg');
  assert.ok(await storage.objectExists(storage.MEDIA, 'products/test-super-gpu-9000.svg'), 'иллюстрация загружена в Neon Object Storage');
  assert.equal((await fetch(`${base}${created.image}`)).status, 200);

  const list = await (await fetch(`${base}/api/products?category=gpu&q=Super GPU 9000`)).json();
  assert.equal(list.data.length, 1);
  const opts = await (await fetch(`${base}/api/builder/options`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: 'gpu', selection: {} }) })).json();
  assert.ok(opts.data.some((o) => o.product.name === 'Super GPU 9000'));

  assert.equal((await adminFetch(`/products/${created.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await (await fetch(`${base}/api/products?q=Super GPU 9000`)).json()).data.length, 0);
});

test('загруженная картинка товара сохраняется в бакете с неизменяемым кэшем; SVG от пользователя отклоняется', async () => {
  const specs = { chip: 'X', vram_gb: 8, length_mm: 250, power_w: 200, rec_psu_w: 600, connector: '8-pin', score: 100 };
  const make = (img, name) => {
    const form = new FormData();
    Object.entries({ category: 'gpu', brand: 'Test', name, price_uzs: '1', stock: '1', specs: JSON.stringify(specs) }).forEach(([k, v]) => form.set(k, v));
    form.set('image', new Blob([img]), 'x.bin');
    return form;
  };
  const svg = await adminFetch('/products', { method: 'POST', form: make('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'Svg GPU') });
  assert.equal(svg.status, 400);
  assert.equal((await svg.json()).error, 'image_invalid_type');

  const png = await adminFetch('/products', { method: 'POST', form: make(PNG, 'Png GPU') });
  assert.equal(png.status, 201);
  const { image } = (await png.json()).data;
  assert.match(image, /^\/img\/products\/test-png-gpu-[a-f0-9]{8}\.png$/);
  const served = await fetch(`${base}${image}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.match(served.headers.get('cache-control'), /immutable/);
  assert.ok(Buffer.from(await served.arrayBuffer()).equals(PNG));
});

test('новая игра попадает в расчёт FPS', async () => {
  const form = new FormData();
  Object.entries({ title: 'Test Game 2077', year: '2025', ram_gb: '16', hue: '120', gpu_fps: '[100,80,60,40]', cpu_fps: '[120,110,100,90]', vram: '[4,6,8,10]' }).forEach(([k, v]) => form.set(k, v));
  const res = await adminFetch('/games', { method: 'POST', form });
  assert.equal(res.status, 201);
  const game = (await res.json()).data;
  assert.deepEqual(game.gpu_fps, [100, 80, 60, 40]);
  assert.ok(await storage.objectExists(storage.MEDIA, 'games/test-game-2077.svg'));
  const games = (await (await fetch(`${base}/api/games`)).json()).data;
  assert.equal(games.length, (await import('../data/games.js')).GAMES.length + 1);

  const cpu = await product('Ryzen 7 7800X3D');
  const gpu = await product('GeForce RTX 4070 SUPER 12GB');
  const ev = await (await fetch(`${base}/api/builder/evaluate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ selection: { cpu: cpu.id, gpu: gpu.id } }) })).json();
  assert.ok(ev.data.fps.some((g) => g.title === 'Test Game 2077'));

  const bad = new FormData();
  bad.set('title', 'Bad'); bad.set('gpu_fps', '[1,2,3]'); bad.set('cpu_fps', '[1,2,3,4]'); bad.set('vram', '[1,2,3,4]');
  assert.equal((await adminFetch('/games', { method: 'POST', form: bad })).status, 400);
});

test('настройки хранятся в Postgres: chat id валидируется, токен наружу не отдаётся', async () => {
  const bad = await adminFetch('/settings', { method: 'PUT', json: { telegram_chat_id: 'not a chat id' } });
  assert.equal(bad.status, 400);
  const good = await (await adminFetch('/settings', { method: 'PUT', json: { telegram_chat_id: '-100123', payment_card: '8600 1111 2222 3333' } })).json();
  assert.equal(good.data.telegram.chatId, '-100123');
  assert.ok(!JSON.stringify(good).includes('SECRETTOKEN'));
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.data.payment.card, '8600 1111 2222 3333');
  assert.equal((await row("SELECT value FROM settings WHERE key = 'payment_card'")).value, '8600 1111 2222 3333');
});

test('после трёх неверных паролей вход блокируется (429)', async () => {
  const attempt = () => fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'nope' }) });
  const statuses = [];
  for (let i = 0; i < 5; i += 1) statuses.push((await attempt()).status);
  assert.ok(statuses.includes(429), `статусы: ${statuses}`);
});
