// Перегенерирует SVG-иллюстрации товаров и обложки игр и загружает их в Neon Object Storage (бакет media).
// Запуск: npm run images
import '../server/config.js';
import { uploadIllustrations } from '../server/seed.js';

try {
  const count = await uploadIllustrations();
  process.stdout.write(`Uploaded ${count} images to Neon Object Storage\n`);
} catch (err) {
  process.stderr.write(`${err.stack ?? err}\n`);
  process.exitCode = 1;
}
