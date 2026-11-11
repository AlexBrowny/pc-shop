import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { mediaRouter } from './routes/media.js';
import { catalogRouter } from './routes/catalog.js';
import { builderRouter } from './routes/builder.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';
import { presetsRouter } from './routes/presets.js';
import { stripeWebhook, stripeRouter } from './routes/stripe.js';
import { accountRouter } from './routes/account.js';
import { reviewsRouter } from './routes/reviews.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminUiDir = path.join(here, 'admin-ui');

const ADMIN_CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "script-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // За туннелем/прокси клиентский IP приходит в X-Forwarded-For (нужно для ограничения попыток входа)
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  // вебхук Stripe читает сырое тело (проверка подписи), поэтому он стоит до JSON-парсера
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, adminRouter);
  app.use('/api/account', accountRouter);
  app.use('/api', reviewsRouter);
  app.use('/api', catalogRouter);
  app.use('/api/builder', builderRouter);
  app.use('/api', ordersRouter);
  app.use('/api', stripeRouter);
  app.use('/api', presetsRouter);
  app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'not_found' }));

  // Скрытая админка: нигде не отображается в навигации, не индексируется, отдаёт только статику без данных.
  const adminHeaders = (_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', ADMIN_CSP);
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  app.get(['/admin', '/admin/'], adminHeaders, (_req, res) => res.sendFile(path.join(adminUiDir, 'index.html')));
  app.use('/admin', adminHeaders, express.static(adminUiDir, { index: false }));

  // Картинки товаров и игр лежат в Neon Object Storage (бакет media) и отдаются отсюда
  app.use('/img', mediaRouter);

  app.use(express.static(config.publicDir));
  // three.js отдаём из node_modules, чтобы не зависеть от внешних CDN
  app.use('/vendor/three', express.static(path.join(config.root, 'node_modules', 'three'), { maxAge: '7d' }));
  // шрифты (Manrope, Unbounded) отдаём локально — без внешних CDN
  app.use('/vendor/fonts', express.static(path.join(config.root, 'node_modules', '@fontsource-variable'), { maxAge: '30d' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ success: false, error: 'bad_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ success: false, error: 'too_large' });
    process.stderr.write(`${err.stack ?? err}\n`);
    return res.status(500).json({ success: false, error: 'internal_error' });
  });

  return app;
}
