import { row, query } from '../db.js';

export async function getSetting(key, fallback = '') {
  const r = await row('SELECT value FROM settings WHERE key = $1', [key]);
  return r ? r.value : fallback;
}

export async function setSetting(key, value) {
  await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, String(value)]);
}

/** Настройки, редактируемые из админки (токен бота сюда не входит — только из окружения). */
export const EDITABLE_SETTINGS = ['telegram_chat_id', 'payment_card', 'payment_holder', 'payment_note_ru', 'payment_note_uz'];
