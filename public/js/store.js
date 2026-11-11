// Клиентское состояние: корзина, сборка из конструктора, тема. Хранится в localStorage.
// Все обновления иммутабельны — состояние заменяется новым объектом.

const KEYS = { cart: 'pcm_cart', build: 'pcm_build', theme: 'pcm_theme', compare: 'pcm_compare' };
const EMPTY_BUILD = Object.freeze({
  cpu: null, motherboard: null, ram: null, gpu: null, storage: [], psu: null, case: null, cooler: null,
});

const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

// ───────── Корзина: { [productId]: qty } ─────────
let cart = read(KEYS.cart, {});
export const getCart = () => cart;
export const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);

function setCart(next) {
  cart = next;
  write(KEYS.cart, cart);
  emit();
}
export const addToCart = (id, qty = 1) => setCart({ ...cart, [id]: Math.min(99, (cart[id] ?? 0) + qty) });
export const addManyToCart = (ids) => setCart(ids.reduce((acc, id) => ({ ...acc, [id]: Math.min(99, (acc[id] ?? 0) + 1) }), cart));
export function setQty(id, qty) {
  const { [id]: _removed, ...rest } = cart;
  setCart(qty > 0 ? { ...rest, [id]: Math.min(99, qty) } : rest);
}
export const clearCart = () => setCart({});

// ───────── Сборка: { cpu: id|null, ..., storage: [id] } ─────────
let build = { ...EMPTY_BUILD, ...read(KEYS.build, {}) };
export const getBuild = () => build;

function setBuild(next) {
  build = next;
  write(KEYS.build, build);
  emit();
}
export const setPart = (slot, id) => setBuild({ ...build, [slot]: id });
export const addStorage = (id) => setBuild({ ...build, storage: [...build.storage, id] });
export const removeStorage = (index) => setBuild({ ...build, storage: build.storage.filter((_, i) => i !== index) });
/** Полностью заменяет сборку (например, готовым пресетом). */
export const loadBuild = (ids) => setBuild({ ...EMPTY_BUILD, ...ids, storage: [...(ids.storage ?? [])] });
export const resetBuild = () => setBuild({ ...EMPTY_BUILD, storage: [] });
export const buildIds = () => [...Object.entries(build).filter(([k, v]) => k !== 'storage' && v).map(([, v]) => v), ...build.storage];

// ───────── Ссылка на сборку: компактная запись состава в адресе ─────────
const SHARE_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'psu', 'case', 'cooler'];

/** { cpu: 12, gpu: 44, storage: [3, 4] } → «cpu.12~gpu.44~storage.3.4» */
export function encodeBuild(ids) {
  const parts = SHARE_SLOTS.filter((s) => ids[s]).map((s) => `${s}.${ids[s]}`);
  if (ids.storage?.length) parts.push(`storage.${ids.storage.join('.')}`);
  return parts.join('~');
}

/** Обратная запись; всё, что не похоже на список id, отбрасывается. */
export function decodeBuild(text) {
  const out = { storage: [] };
  for (const chunk of String(text ?? '').split('~').slice(0, 12)) {
    const [slot, ...nums] = chunk.split('.');
    const ids = nums.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (slot === 'storage') out.storage = ids.slice(0, 6);
    else if (SHARE_SLOTS.includes(slot) && ids.length === 1) out[slot] = ids[0];
  }
  return SHARE_SLOTS.some((s) => out[s]) || out.storage.length ? out : null;
}

export const shareUrl = (ids) => `${location.origin}${location.pathname}#/builder?b=${encodeBuild(ids)}`;

// ───────── Сравнение товаров (до 4 из одной категории) ─────────
const MAX_COMPARE = 4;
let compare = read(KEYS.compare, []);
export const getCompare = () => compare;
export const inCompare = (id) => compare.some((c) => c.id === id);

/** Добавляет/убирает товар. Возвращает 'added' | 'removed' | 'reset' (начат новый список другой категории) | 'full'. */
export function toggleCompare(id, category) {
  if (inCompare(id)) {
    compare = compare.filter((c) => c.id !== id);
    write(KEYS.compare, compare);
    emit();
    return 'removed';
  }
  let result = 'added';
  let base = compare;
  if (base.length && base[0].category !== category) { base = []; result = 'reset'; }
  if (base.length >= MAX_COMPARE) return 'full';
  compare = [...base, { id, category }];
  write(KEYS.compare, compare);
  emit();
  return result;
}
export const clearCompare = () => { compare = []; write(KEYS.compare, compare); emit(); };

// ───────── Текущий покупатель (кэш ответа /api/account/me) ─────────
let user = null;
export const getUser = () => user;
export function setUser(next) { user = next; emit(); }

// ───────── Тема ─────────
export function getTheme() {
  const saved = read(KEYS.theme, null);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  write(KEYS.theme, theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}
