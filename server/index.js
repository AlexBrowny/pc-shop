import { config, assertConfig } from './config.js';
import { migrate } from './migrate.js';
import { seedIfEmpty, syncBuiltinGames } from './seed.js';
import { createApp } from './app.js';
import { ensureAdminPassword } from './lib/auth.js';
import { isTelegramConfigured } from './lib/telegram.js';

const out = (line) => process.stdout.write(`${line}\n`);

try {
  assertConfig();
  const applied = await migrate();
  if (applied.length) out(`Миграции применены: ${applied.join(', ')}`);
  const seed = await seedIfEmpty();
  const newGames = await syncBuiltinGames();
  if (newGames) out(`Добавлено новых игр в базу FPS: ${newGames}`);
  if (seed.seeded) out('База пуста — загружены каталог, игры и иллюстрации в Neon.');
  const generated = await ensureAdminPassword();
  const app = createApp();

  app.listen(config.port, async () => {
    out(`PC Market: http://localhost:${config.port}`);
    out(`Админка:   http://localhost:${config.port}/admin  (логин: ${config.admin.user})`);
    out(`Neon:      Postgres + Object Storage (ветка ${process.env.NEON_BRANCH ?? 'unknown'})`);
    if (generated) {
      out('');
      out('  Сгенерирован пароль администратора (показывается один раз, в БД хранится только хеш):');
      out(`  ${generated}`);
      out('  Задайте свой через ADMIN_PASSWORD в .env.');
      out('');
    }
    out(`Telegram: ${(await isTelegramConfigured()) ? 'настроен' : 'не настроен (заказы сохраняются, уведомления отключены; см. .env.example)'}`);
  });
} catch (err) {
  process.stderr.write(`Не удалось запустить сервер: ${err.message}\n`);
  process.exit(1);
}
