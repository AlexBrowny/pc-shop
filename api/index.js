// Точка входа для Vercel: Express-приложение как serverless-функция.
// Миграции и сидирование выполняются отдельно (npm run migrate / npm run seed), при холодном старте — только подключение.
import { assertConfig } from '../server/config.js';
import { createApp } from '../server/app.js';

assertConfig();

export default createApp();
