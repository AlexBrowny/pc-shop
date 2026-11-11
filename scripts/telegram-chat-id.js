// Показывает Chat ID чатов, которые писали боту. Сначала напишите боту любое сообщение (или /start).
// Запуск: npm run telegram:chat-id   (токен берётся из .env → TELEGRAM_BOT_TOKEN)
import { config } from '../server/config.js';

const { token, apiBase } = config.telegram;
const out = (line) => process.stdout.write(`${line}\n`);

if (!token) {
  out('Не задан TELEGRAM_BOT_TOKEN. Скопируйте .env.example в .env и вставьте токен от @BotFather.');
  process.exit(1);
}

try {
  const res = await fetch(`${apiBase}/bot${token}/getUpdates`, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`);
  const chats = new Map();
  for (const update of data.result) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
    if (chat) chats.set(chat.id, chat);
  }
  if (!chats.size) {
    out('Обновлений нет. Откройте бота в Telegram, нажмите Start (или добавьте в группу и напишите сообщение) и повторите.');
  }
  for (const chat of chats.values()) {
    out(`${chat.id}\t${chat.type}\t${chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ')}${chat.username ? ` (@${chat.username})` : ''}`);
  }
} catch (err) {
  out(`Ошибка: ${String(err.message).split(token).join('***')}`);
  process.exit(1);
}
