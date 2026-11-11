async function request(url, options) {
  const res = await fetch(url, options);
  let body = null;
  try { body = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok || !body?.success) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

const post = (url, data) =>
  request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

let categoriesCache;
export const getCategories = async () => (categoriesCache ??= (await request('/api/categories')).data);
export const getProducts = async (params = {}) => (await request(`/api/products${qs(params)}`)).data;
export const getProduct = async (slug) => (await request(`/api/products/${encodeURIComponent(slug)}`)).data;
export const getBrands = async (category) => (await request(`/api/brands${qs({ category })}`)).data;
export const getGames = async () => (await request('/api/games')).data;
export const getOptions = async (category, selection) => (await post('/api/builder/options', { category, selection })).data;
export const evaluateBuild = async (selection, resolution) => (await post('/api/builder/evaluate', { selection, resolution })).data;

export const getConfig = async () => (await request('/api/config')).data;

/** Заказ уходит как multipart (чек — файл). Ошибка содержит код сервера для локализации. */
export async function createOrder(formData) {
  const res = await fetch('/api/orders', { method: 'POST', body: formData });
  let body = null;
  try { body = await res.json(); } catch { /* пусто */ }
  if (!res.ok || !body?.success) {
    const err = new Error(body?.error ?? `HTTP ${res.status}`);
    err.code = body?.error ?? 'generic';
    err.details = body ?? {};
    throw err;
  }
  return body.data;
}

export const getPresets = async () => (await request('/api/presets')).data;

/** Результат оплаты картой после возврата из Stripe (сервер сам сверяется со Stripe). */
export const getStripeSession = async (sessionId) => (await request(`/api/stripe/session/${encodeURIComponent(sessionId)}`)).data;

// ───────── Аккаунт, отзывы, фильтры ─────────
export class ApiError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

/** Запрос с JSON-телом и защитным заголовком (сервер требует его для изменяющих запросов покупателя). */
async function call(url, method, data) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'pcm' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body = null;
  try { body = await res.json(); } catch { /* пустой ответ */ }
  if (!res.ok || !body?.success) throw new ApiError(body?.error ?? `http_${res.status}`, body ?? {});
  return body.data;
}

export const getFilters = async (category) => (await request(`/api/filters${qs({ category })}`)).data;

export const getMe = () => call('/api/account/me', 'GET');
export const registerUser = (data) => call('/api/account/register', 'POST', data);
export const loginUser = (data) => call('/api/account/login', 'POST', data);
export const logoutUser = () => call('/api/account/logout', 'POST', {});
export const getMyOrders = () => call('/api/account/orders', 'GET');
export const getMyBuilds = () => call('/api/account/builds', 'GET');
export const saveMyBuild = (name, ids) => call('/api/account/builds', 'POST', { name, ids });
export const deleteMyBuild = (id) => call(`/api/account/builds/${id}`, 'DELETE');

export const getReviews = (slug) => call(`/api/products/${encodeURIComponent(slug)}/reviews`, 'GET');
export const saveReview = (slug, rating, body) => call(`/api/products/${encodeURIComponent(slug)}/reviews`, 'POST', { rating, body });
export const deleteReview = (slug) => call(`/api/products/${encodeURIComponent(slug)}/reviews`, 'DELETE');
