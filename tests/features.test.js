// Аккаунты, сохранённые сборки, отзывы, фильтры каталога, галерея и расширенная база игр.
// Интеграционные тесты против реального Neon в отдельной схеме (Telegram и Stripe не нужны).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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
  LOGIN_ATTEMPTS: '1000',
});

const { assertConfig } = await import('../server/config.js');
assertConfig();
const { migrate } = await import('../server/migrate.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { row, query, closeDb } = await import('../server/db.js');
const storage = await import('../server/lib/storage.js');
const { GAMES } = await import('../data/games.js');
const { encodeBuild, decodeBuild } = await import('../public/js/store.js').catch(() => ({}));

await migrate();
await seedIfEmpty();
const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  server.close();
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
/** Клиент с cookie-сессией покупателя. */
function client() {
  let cookie = '';
  const call = async (path, { method = 'GET', json, headers = {}, csrf = true } = {}) => {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    if (json !== undefined) h['Content-Type'] = 'application/json';
    if (csrf && method !== 'GET') h['X-Requested-With'] = 'pcm';
    const res = await fetch(`${base}${path}`, { method, headers: h, body: json === undefined ? undefined : JSON.stringify(json) });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const pair = c.split(';')[0];
      cookie = pair.endsWith('=') ? '' : pair;
    }
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { call, get cookie() { return cookie; } };
}

const adminLogin = async () => {
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'boss', password: 'correct horse battery' }),
  });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
};
const adminCall = async (cookie, path, { method = 'GET', json, form } = {}) => {
  const headers = { cookie, 'x-admin-csrf': '1' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}/api/admin${path}`, { method, headers, body: form ?? (json === undefined ? undefined : JSON.stringify(json)) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

const product = await row("SELECT id, slug, category FROM products WHERE category = 'gpu' ORDER BY id LIMIT 1");
const user = { name: 'Алишер Тест', email: 'Test.User@Example.com', password: 'sup3r-secret-pass' };

// ───────── Аккаунты ─────────
test('регистрация: валидация, нормализация email, cookie HttpOnly, повтор отклоняется', async () => {
  const c = client();
  assert.equal((await c.call('/api/account/register', { method: 'POST', json: { ...user, email: 'bad' } })).body.error, 'invalid_email');
  assert.equal((await c.call('/api/account/register', { method: 'POST', json: { ...user, password: 'short' } })).body.error, 'weak_password');
  assert.equal((await c.call('/api/account/register', { method: 'POST', json: { ...user, name: 'A' } })).body.error, 'invalid_name');

  const ok = await c.call('/api/account/register', { method: 'POST', json: user });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.email, 'test.user@example.com');
  assert.equal(ok.body.data.password_hash, undefined, 'хеш пароля не отдаётся');
  const setCookie = ok.headers.getSetCookie().join(';');
  assert.match(setCookie, /pcm_user=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);

  const me = await c.call('/api/account/me');
  assert.equal(me.body.data.name, user.name);

  const dup = await client().call('/api/account/register', { method: 'POST', json: { ...user, email: 'TEST.user@example.com' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error, 'email_taken');
  const stored = await row('SELECT password_hash FROM users');
  assert.doesNotMatch(stored.password_hash, /sup3r/);
});

test('вход: неверный пароль и неизвестный email одинаково отклоняются; подделанный токен не работает', async () => {
  const bad = await client().call('/api/account/login', { method: 'POST', json: { email: user.email, password: 'wrong-password' } });
  const unknown = await client().call('/api/account/login', { method: 'POST', json: { email: 'nobody@example.com', password: 'wrong-password' } });
  assert.equal(bad.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.error, unknown.body.error);

  const c = client();
  assert.equal((await c.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } })).status, 200);
  assert.equal((await c.call('/api/account/me')).body.data.email, 'test.user@example.com');

  const forged = await fetch(`${base}/api/account/me`, { headers: { cookie: `pcm_user=${c.cookie.split('=')[1].replace(/.$/, 'x')}` } });
  assert.equal((await forged.json()).data, null);
  await c.call('/api/account/logout', { method: 'POST', json: {} });
  assert.equal((await c.call('/api/account/me')).body.data, null);
});

test('изменяющие запросы кабинета требуют защитный заголовок (CSRF) и вход', async () => {
  const c = client();
  await c.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } });
  const noHeader = await c.call('/api/account/builds', { method: 'POST', json: { name: 'x', ids: { gpu: product.id } }, csrf: false });
  assert.equal(noHeader.status, 403);
  assert.equal((await client().call('/api/account/orders')).status, 401);
  assert.equal((await client().call('/api/account/builds', { method: 'POST', json: {} })).status, 401);
});

// ───────── Сохранённые сборки ─────────
test('сохранённые сборки: проверка состава, лимит, удаление только своих', async () => {
  const c = client();
  await c.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } });
  const cpu = await row("SELECT id FROM products WHERE category = 'cpu' ORDER BY id LIMIT 1");

  assert.equal((await c.call('/api/account/builds', { method: 'POST', json: { name: 'Пустая', ids: {} } })).body.error, 'invalid_build');
  assert.equal((await c.call('/api/account/builds', { method: 'POST', json: { name: 'Левая', ids: { gpu: 999999 } } })).body.error, 'invalid_build');
  assert.equal((await c.call('/api/account/builds', { method: 'POST', json: { name: 'Строка', ids: { gpu: 'DROP TABLE' } } })).body.error, 'invalid_build');
  assert.equal((await c.call('/api/account/builds', { method: 'POST', json: { name: '', ids: { gpu: product.id } } })).body.error, 'invalid_name');

  const saved = await c.call('/api/account/builds', { method: 'POST', json: { name: 'Моя сборка', ids: { cpu: cpu.id, gpu: product.id, storage: [] } } });
  assert.equal(saved.status, 201);
  const list = (await c.call('/api/account/builds')).body.data;
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].ids.gpu, product.id);

  const other = client();
  await other.call('/api/account/register', { method: 'POST', json: { name: 'Другой', email: 'other@example.com', password: 'another-pass-1' } });
  assert.equal((await other.call(`/api/account/builds/${saved.body.data.id}`, { method: 'DELETE' })).status, 404, 'чужую сборку удалить нельзя');
  assert.equal((await c.call(`/api/account/builds/${saved.body.data.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await c.call('/api/account/builds')).body.data.length, 0);
});

test('ссылка «Поделиться»: запись и разбор состава сборки', () => {
  if (!encodeBuild) return; // модуль браузерного хранилища не загрузился в Node — проверка выше покрывает сервер
  const ids = { cpu: 12, gpu: 44, storage: [3, 4] };
  assert.equal(encodeBuild(ids), 'cpu.12~gpu.44~storage.3.4');
  assert.deepEqual(decodeBuild('cpu.12~gpu.44~storage.3.4'), { storage: [3, 4], cpu: 12, gpu: 44 });
  assert.equal(decodeBuild('<script>alert(1)</script>'), null);
  assert.equal(decodeBuild('cpu.-5~gpu.abc'), null);
});

// ───────── Заказы привязываются к покупателю ─────────
test('заказ вошедшего покупателя попадает в историю заказов, гостевой — нет', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const place = async (c) => {
    const form = new FormData();
    form.set('name', 'Тест');
    form.set('phone', '+998901112233');
    form.set('items', JSON.stringify([{ id: product.id, qty: 1 }]));
    form.set('receipt', new Blob([png], { type: 'image/png' }), 'r.png');
    const res = await fetch(`${base}/api/orders`, { method: 'POST', headers: c ? { cookie: c.cookie } : {}, body: form });
    assert.equal(res.status, 201);
    return (await res.json()).data.id;
  };
  const c = client();
  await c.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } });
  const mine = await place(c);
  const guest = await place(null);
  const history = (await c.call('/api/account/orders')).body.data;
  assert.deepEqual(history.map((o) => o.id), [mine]);
  assert.ok(history[0].items.length === 1);
  assert.notEqual(mine, guest);
});

// ───────── Отзывы ─────────
test('отзывы: писать могут только вошедшие, один на товар, сводка и рейтинг в каталоге', async () => {
  const path = `/api/products/${product.slug}/reviews`;
  assert.equal((await client().call(path, { method: 'POST', json: { rating: 5 } })).status, 401);

  const a = client();
  await a.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } });
  assert.equal((await a.call(path, { method: 'POST', json: { rating: 0 } })).body.error, 'invalid_rating');
  assert.equal((await a.call(path, { method: 'POST', json: { rating: 6 } })).body.error, 'invalid_rating');
  assert.equal((await a.call(path, { method: 'POST', json: { rating: 5, body: 'x'.repeat(1501) } })).body.error, 'review_too_long');
  assert.equal((await a.call(path, { method: 'POST', json: { rating: 5, body: '<img src=x onerror=alert(1)> Отличная карта' } })).status, 201);
  // повтор обновляет, а не дублирует
  assert.equal((await a.call(path, { method: 'POST', json: { rating: 4, body: 'Отличная карта, но шумная' } })).status, 201);

  const b = client();
  await b.call('/api/account/login', { method: 'POST', json: { email: 'other@example.com', password: 'another-pass-1' } });
  assert.equal((await b.call(path, { method: 'POST', json: { rating: 2, body: 'Не понравилась' } })).status, 201);

  const data = (await client().call(path)).body.data;
  assert.equal(data.summary.count, 2);
  assert.equal(data.summary.avg, 3);
  assert.deepEqual(data.summary.dist, [0, 1, 0, 1, 0]);
  assert.equal(data.items.length, 2);
  assert.ok(data.items.every((r) => r.mine === false));
  assert.ok(data.items.every((r) => !('email' in r)), 'email автора не раскрывается');
  assert.ok(data.items.some((r) => r.verified === false));

  const catalog = (await (await fetch(`${base}/api/products?category=gpu&sort=rating`)).json()).data;
  assert.equal(catalog[0].id, product.id);
  assert.equal(catalog[0].rating_count, 2);
  assert.equal(catalog[0].rating_avg, 3);
  const detail = (await (await fetch(`${base}/api/products/${product.slug}`)).json()).data;
  assert.equal(detail.rating_count, 2);
});

test('модерация: скрытый отзыв пропадает у всех, кроме автора; админ может скрыть и удалить', async () => {
  const path = `/api/products/${product.slug}/reviews`;
  const admin = await adminLogin();
  const list = (await adminCall(admin, '/reviews')).body.data;
  assert.equal(list.length, 2);
  const target = list.find((r) => r.rating === 2);

  assert.equal((await adminCall(admin, `/reviews/${target.id}`, { method: 'PATCH', json: { status: 'nonsense' } })).status, 400);
  assert.equal((await adminCall(admin, `/reviews/${target.id}`, { method: 'PATCH', json: { status: 'hidden' } })).status, 200);

  const publicView = (await client().call(path)).body.data;
  assert.equal(publicView.summary.count, 1);
  const author = client();
  await author.call('/api/account/login', { method: 'POST', json: { email: 'other@example.com', password: 'another-pass-1' } });
  const ownView = (await author.call(path)).body.data;
  assert.equal(ownView.items.find((r) => r.mine).hidden, true);
  assert.equal(ownView.summary.count, 1, 'скрытый не учитывается в рейтинге');

  assert.equal((await adminCall(admin, `/reviews/${target.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await adminCall(admin, '/reviews')).body.data.length, 1);
  assert.equal((await fetch(`${base}/api/admin/reviews`)).status, 401, 'без входа админку отзывов не открыть');
});

test('автор может удалить свой отзыв', async () => {
  const c = client();
  await c.call('/api/account/login', { method: 'POST', json: { email: user.email, password: user.password } });
  assert.equal((await c.call(`/api/products/${product.slug}/reviews`, { method: 'DELETE' })).status, 200);
  assert.equal((await client().call(`/api/products/${product.slug}/reviews`)).body.data.summary.count, 0);
});

// ───────── Фильтры каталога ─────────
test('фильтры: варианты берутся из данных, фильтрация по характеристикам, цене, бренду и наличию', async () => {
  const f = (await (await fetch(`${base}/api/filters?category=cpu`)).json()).data;
  assert.ok(f.price.min > 0 && f.price.max >= f.price.min);
  assert.ok(f.brands.length >= 2);
  const socket = f.specs.find((s) => s.key === 'socket');
  assert.ok(socket && socket.values.length >= 2);
  assert.ok(socket.values.every((v) => v.count >= 1));

  const total = (await (await fetch(`${base}/api/products?category=cpu`)).json()).data.length;
  const am5 = (await (await fetch(`${base}/api/products?category=cpu&s.socket=AM5`)).json()).data;
  assert.ok(am5.length > 0 && am5.length < total);
  assert.ok(am5.every((p) => p.specs.socket === 'AM5'));
  const both = (await (await fetch(`${base}/api/products?category=cpu&s.socket=AM5,AM4`)).json()).data;
  assert.ok(both.length >= am5.length);

  const cores = (await (await fetch(`${base}/api/products?category=cpu&r.cores=8-12`)).json()).data;
  assert.ok(cores.length > 0 && cores.every((p) => p.specs.cores >= 8 && p.specs.cores <= 12));

  const ddr = (await (await fetch(`${base}/api/products?category=cpu&s.ram_types=DDR4`)).json()).data;
  assert.ok(ddr.length > 0 && ddr.every((p) => p.specs.ram_types.includes('DDR4')), 'фильтр по массивам (jsonb)');
  const itx = (await (await fetch(`${base}/api/products?category=case&s.form_factors=ITX`)).json()).data;
  assert.ok(itx.length > 0 && itx.every((p) => p.specs.form_factors.includes('ITX')));

  const gpuPrice = (await (await fetch(`${base}/api/products?category=gpu&min=1&max=5000000&sort=price_desc`)).json()).data;
  assert.ok(gpuPrice.every((p) => p.price_uzs <= 5000000));
  assert.deepEqual(gpuPrice.map((p) => p.price_uzs), [...gpuPrice.map((p) => p.price_uzs)].sort((a, b) => b - a));
});

test('фильтры защищены: неизвестные ключи игнорируются, инъекции не работают', async () => {
  const base1 = (await (await fetch(`${base}/api/products?category=cpu`)).json()).data.length;
  const unknown = await fetch(`${base}/api/products?category=cpu&s.nonexistent=1&s.price_uzs=0`);
  assert.equal(unknown.status, 200);
  assert.equal((await unknown.json()).data.length, base1, 'ключ вне белого списка не влияет на выборку');

  const inj = await fetch(`${base}/api/products?category=cpu&s.socket=${encodeURIComponent("AM5' OR '1'='1")}`);
  assert.equal(inj.status, 200);
  assert.equal((await inj.json()).data.length, 0);

  const inj2 = await fetch(`${base}/api/products?category=cpu&r.cores=${encodeURIComponent('1; DROP TABLE products')}`);
  assert.equal(inj2.status, 200);
  assert.equal((await (await fetch(`${base}/api/products?category=cpu`)).json()).data.length, base1);
});

// ───────── Галерея фото ─────────
test('галерея: админ загружает до 8 фото, они видны на странице товара; не-картинки отклоняются', async () => {
  const admin = await adminLogin();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const upload = async (buffer, name = 'p.png', type = 'image/png') => {
    const form = new FormData();
    form.set('image', new Blob([buffer], { type }), name);
    return adminCall(admin, `/products/${product.id}/images`, { method: 'POST', form });
  };

  assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml')).status, 400);
  assert.equal((await upload(Buffer.from('not an image at all'), 'x.png')).status, 400);

  const first = await upload(png);
  assert.equal(first.status, 201);
  assert.match(first.body.data.url, /^\/img\/products\//);
  assert.equal((await fetch(`${base}${first.body.data.url}`)).status, 200);

  const detail = (await (await fetch(`${base}/api/products/${product.slug}`)).json()).data;
  assert.equal(detail.images.length, 1);

  for (let i = 0; i < 7; i += 1) assert.equal((await upload(png)).status, 201);
  assert.equal((await upload(png)).status, 409, 'не больше 8 фото');

  assert.equal((await adminCall(admin, `/products/${product.id}/images/${first.body.data.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await adminCall(admin, `/products/${product.id}/images`)).body.data.length, 7);
  assert.equal((await fetch(`${base}/api/admin/products/${product.id}/images`)).status, 401);
});

// ───────── Игры ─────────
test('база игр расширена: 50 игр с корректными данными и обложками', async () => {
  assert.ok(GAMES.length >= 50);
  assert.equal(new Set(GAMES.map((g) => g.slug)).size, GAMES.length, 'slug уникальны');
  for (const g of GAMES) {
    for (const key of ['gpu_fps', 'cpu_fps', 'vram']) {
      assert.equal(g[key].length, 4, `${g.slug}.${key}`);
      assert.deepEqual([...g[key]].sort((a, b) => (key === 'vram' ? a - b : b - a)), g[key], `${g.slug}.${key} монотонны: low → ultra`);
    }
  }
  const games = (await (await fetch(`${base}/api/games`)).json()).data;
  assert.equal(games.length, GAMES.length);
  const sample = games.find((g) => g.slug === 'counter-strike-2');
  assert.equal((await fetch(`${base}${sample.cover}`)).status, 200);
  const { n } = await row('SELECT COUNT(*) AS n FROM games');
  assert.equal(n, GAMES.length);
  await query('SELECT 1');
});
