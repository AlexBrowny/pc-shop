// Оплата картой через Stripe Checkout: заказ-резерв, вебхуки с подписью, идемпотентность, отмена и возврат остатков.
// Stripe API и Telegram подменены локальными серверами; БД — реальный Neon в отдельной схеме.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';

const WEBHOOK_SECRET = 'whsec_testsecret';

// ───────── Мок Telegram ─────────
const telegram = { requests: [] };
const tgMock = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    telegram.requests.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8') });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, result: {} }));
  });
});
await new Promise((resolve) => tgMock.listen(0, '127.0.0.1', resolve));
const messages = () => telegram.requests.filter((r) => r.url.endsWith('/sendMessage')).map((r) => JSON.parse(r.body).text);

// ───────── Мок Stripe API ─────────
const stripeApi = { sessions: new Map(), created: [], failCreate: false };
const stripeMock = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    const body = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    if (req.method === 'POST' && req.url === '/v1/checkout/sessions') {
      if (stripeApi.failCreate) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: { message: 'boom', type: 'api_error' } }));
      }
      const id = `cs_test_${crypto.randomBytes(8).toString('hex')}`;
      const session = {
        id,
        object: 'checkout.session',
        url: `https://checkout.stripe.test/c/pay/${id}`,
        status: 'open',
        payment_status: 'unpaid',
        currency: 'usd',
        amount_total: 0,
        payment_intent: null,
        client_reference_id: body.get('client_reference_id'),
        metadata: { order_id: body.get('metadata[order_id]') },
      };
      stripeApi.sessions.set(id, session);
      stripeApi.created.push(body);
      return res.end(JSON.stringify(session));
    }
    const m = req.url.match(/^\/v1\/checkout\/sessions\/(cs_test_\w+)$/);
    if (req.method === 'GET' && m && stripeApi.sessions.has(m[1])) return res.end(JSON.stringify(stripeApi.sessions.get(m[1])));
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: { message: 'not found', type: 'invalid_request_error' } }));
  });
});
await new Promise((resolve) => stripeMock.listen(0, '127.0.0.1', resolve));

// ───────── Окружение ─────────
const runId = crypto.randomBytes(4).toString('hex');
const SCHEMA = `pcm_test_${runId}`;
Object.assign(process.env, {
  DB_SCHEMA: SCHEMA,
  STORAGE_PREFIX: `test-${runId}/`,
  ADMIN_USER: 'boss',
  ADMIN_PASSWORD: 'correct horse battery',
  TELEGRAM_BOT_TOKEN: '123456:SECRETTOKEN',
  TELEGRAM_CHAT_ID: '555',
  TELEGRAM_API_BASE: `http://127.0.0.1:${tgMock.address().port}`,
  STRIPE_SECRET_KEY: 'sk_test_mock',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_API_BASE: `http://127.0.0.1:${stripeMock.address().port}`,
  USD_RATE: '12500',
  ORDERS_PER_HOUR: '1000',
});

const { assertConfig } = await import('../server/config.js');
assertConfig();
const { migrate } = await import('../server/migrate.js');
const { seedIfEmpty } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { row, query, closeDb } = await import('../server/db.js');
const { cancelStaleUnpaid } = await import('../server/lib/orders.js');
const { default: Stripe } = await import('stripe');
const storage = await import('../server/lib/storage.js');

await migrate();
await seedIfEmpty();
const server = await new Promise((resolve) => { const s = createApp().listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;

after(async () => {
  server.close();
  tgMock.close();
  stripeMock.close();
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
const signer = new Stripe('sk_test_mock');

async function webhook(event, { secret = WEBHOOK_SECRET, sign = true } = {}) {
  const payload = JSON.stringify(event);
  const headers = { 'Content-Type': 'application/json' };
  if (sign) headers['Stripe-Signature'] = signer.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers, body: payload });
}

const eventFor = (type, session) => ({ id: `evt_${crypto.randomBytes(6).toString('hex')}`, object: 'event', type, data: { object: session } });

async function buyWithCard(productId, qty = 1) {
  const body = new FormData();
  body.set('name', 'Тест Карта');
  body.set('phone', '+998901234567');
  body.set('lang', 'ru');
  body.set('payment_method', 'stripe');
  body.set('items', JSON.stringify([{ id: productId, qty }]));
  const res = await fetch(`${base}/api/orders`, { method: 'POST', body });
  return { res, json: await res.json() };
}

const sessionOf = async (orderId) => {
  const { stripe_session_id: id } = await row('SELECT stripe_session_id FROM orders WHERE id = $1', [orderId]);
  return stripeApi.sessions.get(id);
};
const stockOf = async (id) => (await row('SELECT stock FROM products WHERE id = $1', [id])).stock;
const orderRow = (id) => row('SELECT * FROM orders WHERE id = $1', [id]);

const product = await row('SELECT id, price_uzs, brand, name FROM products WHERE stock >= 5 ORDER BY id LIMIT 1');

// ───────── Тесты ─────────
test('конфиг сообщает, что оплата картой включена', async () => {
  const { data } = await (await fetch(`${base}/api/config`)).json();
  assert.equal(data.stripe.enabled, true);
  assert.equal(data.stripe.currency, 'usd');
  assert.equal(data.stripe.usdRate, 12500);
});

test('заказ картой: резерв товара, сессия Stripe с верной суммой, менеджер пока не уведомлён', async () => {
  const before = await stockOf(product.id);
  const { res, json } = await buyWithCard(product.id, 2);
  assert.equal(res.status, 201);
  assert.match(json.data.checkout_url, /^https:\/\/checkout\.stripe\.test\/c\/pay\/cs_test_/);

  const order = await orderRow(json.data.id);
  assert.equal(order.status, 'pending');
  assert.equal(order.payment_method, 'stripe');
  assert.equal(order.payment_status, 'awaiting');
  assert.equal(order.receipt_file, null);
  assert.equal(await stockOf(product.id), before - 2);

  const sent = stripeApi.created.at(-1);
  assert.equal(sent.get('mode'), 'payment');
  assert.equal(sent.get('line_items[0][quantity]'), '2');
  assert.equal(sent.get('line_items[0][price_data][currency]'), 'usd');
  assert.equal(Number(sent.get('line_items[0][price_data][unit_amount]')), Math.round((Number(product.price_uzs) / 12500) * 100));
  assert.equal(sent.get('metadata[order_id]'), String(order.id));
  assert.match(sent.get('success_url'), /\/#\/paid\/\{CHECKOUT_SESSION_ID\}$/);
  assert.equal(messages().filter((m) => m.includes(`№${order.id}`)).length, 0, 'до оплаты менеджеру ничего не уходит');
});

test('вебхук без подписи или с чужой подписью отклоняется', async () => {
  const { json } = await buyWithCard(product.id);
  const session = await sessionOf(json.data.id);
  const event = eventFor('checkout.session.completed', { ...session, payment_status: 'paid' });
  assert.equal((await webhook(event, { sign: false })).status, 400);
  assert.equal((await webhook(event, { secret: 'whsec_wrong' })).status, 400);
  assert.equal((await orderRow(json.data.id)).status, 'pending');
});

test('оплата: вебхук переводит заказ в paid, менеджер получает ровно одно уведомление, повтор безопасен', async () => {
  const { json } = await buyWithCard(product.id);
  const id = json.data.id;
  const session = { ...(await sessionOf(id)), status: 'complete', payment_status: 'paid', amount_total: 1234, payment_intent: 'pi_test_123' };
  const event = eventFor('checkout.session.completed', session);

  assert.equal((await webhook(event)).status, 200);
  assert.equal((await webhook(event)).status, 200); // Stripe может прислать событие повторно

  const order = await orderRow(id);
  assert.equal(order.status, 'paid');
  assert.equal(order.payment_status, 'paid');
  assert.equal(order.stripe_payment_intent, 'pi_test_123');
  assert.equal(Number(order.paid_amount), 1234);
  assert.equal(order.telegram_status, 'sent');

  const mine = messages().filter((m) => m.includes(`№${id}`));
  assert.equal(mine.length, 1);
  assert.match(mine[0], /оплаченный заказ/);
  assert.match(mine[0], /\$12\.34/);
  assert.equal(telegram.requests.some((r) => /send(Photo|Document)$/.test(r.url)), false, 'чек не отправляется: платёж подтверждён Stripe');
});

test('сессия истекла: заказ отменяется, товар возвращается; поздняя оплата даёт предупреждение', async () => {
  const before = await stockOf(product.id);
  const { json } = await buyWithCard(product.id, 3);
  const id = json.data.id;
  assert.equal(await stockOf(product.id), before - 3);

  const session = await sessionOf(id);
  assert.equal((await webhook(eventFor('checkout.session.expired', { ...session, status: 'expired' }))).status, 200);
  const order = await orderRow(id);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.payment_status, 'expired');
  assert.equal(await stockOf(product.id), before);

  // деньги пришли уже за отменённый заказ
  await webhook(eventFor('checkout.session.completed', { ...session, status: 'complete', payment_status: 'paid', amount_total: 500, payment_intent: 'pi_late' }));
  const late = await orderRow(id);
  assert.equal(late.status, 'cancelled');
  assert.equal(late.payment_status, 'paid');
  assert.equal(await stockOf(product.id), before, 'остаток не списывается повторно');
  assert.ok(messages().some((m) => m.includes('Оплата за отменённый заказ') && m.includes(`№${id}`)));
});

test('сбой Stripe при создании сессии: 502, заказ отменён, товар возвращён', async () => {
  const before = await stockOf(product.id);
  stripeApi.failCreate = true;
  try {
    const { res, json } = await buyWithCard(product.id);
    assert.equal(res.status, 502);
    assert.equal(json.error, 'payment_unavailable');
  } finally {
    stripeApi.failCreate = false;
  }
  assert.equal(await stockOf(product.id), before);
  const last = await row("SELECT status, payment_status FROM orders WHERE payment_method = 'stripe' ORDER BY id DESC LIMIT 1");
  assert.equal(last.status, 'cancelled');
  assert.equal(last.payment_status, 'failed');
});

test('страница возврата: сервер сверяет сессию со Stripe и подтверждает оплату, даже если вебхук ещё не дошёл', async () => {
  const { json } = await buyWithCard(product.id);
  const id = json.data.id;
  const session = await sessionOf(id);

  const waiting = await (await fetch(`${base}/api/stripe/session/${session.id}`)).json();
  assert.equal(waiting.data.payment_status, 'awaiting');

  Object.assign(session, { status: 'complete', payment_status: 'paid', amount_total: 999, payment_intent: 'pi_sync' });
  const done = await (await fetch(`${base}/api/stripe/session/${session.id}`)).json();
  assert.equal(done.data.payment_status, 'paid');
  assert.equal(done.data.status, 'paid');
  assert.equal(messages().filter((m) => m.includes(`№${id}`)).length, 1);

  // последующий вебхук не дублирует уведомление
  await webhook(eventFor('checkout.session.completed', session));
  assert.equal(messages().filter((m) => m.includes(`№${id}`)).length, 1);
});

test('страница возврата не раскрывает чужие и несуществующие сессии', async () => {
  assert.equal((await fetch(`${base}/api/stripe/session/cs_test_unknown123`)).status, 404);
  assert.equal((await fetch(`${base}/api/stripe/session/not-a-session`)).status, 404);
});

test('брошенные неоплаченные заказы отменяются по таймеру, даже без вебхука expired', async () => {
  const before = await stockOf(product.id);
  const { json } = await buyWithCard(product.id, 2);
  await query("UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = $1", [json.data.id]);
  assert.ok((await cancelStaleUnpaid(40)) >= 1);
  assert.equal((await orderRow(json.data.id)).status, 'cancelled');
  assert.equal(await stockOf(product.id), before);
});

test('заказ по чеку работает как раньше', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const body = new FormData();
  body.set('name', 'Тест Чек');
  body.set('phone', '+998901234568');
  body.set('items', JSON.stringify([{ id: product.id, qty: 1 }]));
  body.set('receipt', new Blob([png], { type: 'image/png' }), 'r.png');
  const res = await fetch(`${base}/api/orders`, { method: 'POST', body });
  assert.equal(res.status, 201);
  const order = await orderRow((await res.json()).data.id);
  assert.equal(order.status, 'new');
  assert.equal(order.payment_method, 'receipt');
  assert.ok(order.receipt_file);
});
