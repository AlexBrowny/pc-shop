// Приём файлов: размер ограничивает multer, а тип определяется по «магическим байтам» (расширению и MIME клиента не верим).
// Сами файлы лежат в Neon Object Storage: чеки — в бакете receipts, картинки — в media.
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import {
  putObject, deleteObject, RECEIPTS, MEDIA,
} from './storage.js';

export const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

export function detectMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

export const isImageMime = (mime) => IMAGE_MIMES.includes(mime);

/** Допустимый ключ чека: receipts/<32 hex>.<ext> — произвольные ключи из БД наружу не уходят. */
export const isReceiptKey = (key) => /^receipts\/[a-f0-9]{32}\.(png|jpg|webp|pdf)$/.test(key ?? '');

export async function saveReceipt(buffer, mime) {
  const key = `receipts/${crypto.randomBytes(16).toString('hex')}.${MIME_EXT[mime]}`;
  await putObject(RECEIPTS, key, buffer, mime);
  return key;
}

export async function deleteReceipt(key) {
  if (isReceiptKey(key)) await deleteObject(RECEIPTS, key);
}

/** Сохраняет изображение товара/игры в бакет media (только растровые форматы — SVG от пользователя не принимаем). */
export async function saveImage(buffer, mime, folder, baseName) {
  const safeBase = baseName.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  const key = `${folder}/${safeBase}-${crypto.randomBytes(4).toString('hex')}.${MIME_EXT[mime]}`;
  await putObject(MEDIA, key, buffer, mime, { cacheControl: 'public, max-age=31536000, immutable' });
  return `/img/${key}`;
}

/** Генерируемые иллюстрации (SVG) — наш собственный код, не пользовательский ввод. */
export async function saveGeneratedSvg(folder, slug, svg) {
  const key = `${folder}/${slug}.svg`;
  await putObject(MEDIA, key, Buffer.from(svg, 'utf8'), 'image/svg+xml', { cacheControl: 'public, max-age=3600' });
  return `/img/${key}`;
}

const memory = multer.memoryStorage();
export const receiptUpload = multer({ storage: memory, limits: { fileSize: config.limits.receiptBytes, files: 1, fields: 20, fieldSize: 100_000 } }).single('receipt');
export const imageUpload = multer({ storage: memory, limits: { fileSize: config.limits.imageBytes, files: 1, fields: 40, fieldSize: 100_000 } }).single('image');

/** Оборачивает multer, чтобы ошибки лимитов превращались в JSON-ответы 400/413. */
export const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : 400).json({ success: false, error: tooBig ? 'file_too_large' : 'bad_upload' });
    }
    return next(err);
  });
};
