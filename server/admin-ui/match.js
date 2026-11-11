// Автосопоставление файлов с товарами по имени файла (чистая логика без DOM — её проверяют тесты).
// Правило: «rtx-4070-super.jpg» → главное фото, «rtx-4070-super-2.jpg» → дополнительное в галерею.

const tokenize = (text) => String(text)
  .toLowerCase()
  .replace(/\.[a-z0-9]{2,5}$/i, '')
  .replace(/[_\-./()+,[\]]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean);

/** Роль файла: номер 2–9 в конце имени означает дополнительное фото. */
export function photoRole(filename, product) {
  const tokens = tokenize(filename);
  const last = tokens.at(-1);
  const own = new Set(tokenize(`${product?.brand ?? ''} ${product?.name ?? ''}`));
  return /^[2-9]$/.test(last ?? '') && !own.has(last) ? 'gallery' : 'main';
}

/** Доля слов названия товара, найденных в имени файла (0–1). */
export function matchScore(filename, product) {
  const file = new Set(tokenize(filename));
  const words = tokenize(`${product.brand} ${product.name}`);
  if (!words.length) return 0;
  return words.filter((w) => file.has(w)).length / words.length;
}

/**
 * Предлагает товар для файла. Возвращает null, если уверенного совпадения нет
 * (слишком мало общих слов или два товара подходят одинаково хорошо) — тогда выбирает человек.
 */
export function suggestProduct(filename, products) {
  const scored = products.map((p) => ({ product: p, score: matchScore(filename, p) })).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 0.75) return null;
  if (second && best.score - second.score < 0.15) return null;
  return best.product;
}
