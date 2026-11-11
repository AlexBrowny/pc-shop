import {
  html, $, api, toast, UnauthorizedError, errorText, ApiError,
} from '/admin/common.js';
import { ordersView } from '/admin/orders.js';
import { productsView } from '/admin/products.js';
import { gamesView } from '/admin/games.js';
import { reviewsView } from '/admin/reviews.js';
import { photosView } from '/admin/photos.js';
import { settingsView } from '/admin/settings.js';

const root = $('#root');

const VIEWS = {
  orders: { title: 'Заказы', view: ordersView },
  products: { title: 'Товары', view: productsView },
  photos: { title: 'Фото', view: photosView },
  reviews: { title: 'Отзывы', view: reviewsView },
  games: { title: 'Игры', view: gamesView },
  settings: { title: 'Настройки', view: settingsView },
};

let current = null; // { stop?: () => void }

function currentTab() {
  const tab = location.hash.slice(1);
  return VIEWS[tab] ? tab : 'orders';
}

function renderLogin(message = '') {
  current?.stop?.();
  current = null;
  root.innerHTML = html`
    <main class="login">
      <form id="login-form" class="card login-card">
        <h1>Вход</h1>
        <label class="field"><span>Логин</span><input name="username" autocomplete="username" required autofocus></label>
        <label class="field"><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required></label>
        <p id="login-error" class="form-error" role="alert" ${message ? '' : 'hidden'}>${message}</p>
        <button class="btn primary" type="submit">Войти</button>
      </form>
    </main>`.toString();
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      await api('/login', { method: 'POST', json: { username: data.get('username'), password: data.get('password') } });
      renderShell();
    } catch (err) {
      const el = $('#login-error');
      el.textContent = err instanceof ApiError ? errorText(err.code) : 'ошибка соединения';
      el.hidden = false;
    }
  });
}

async function renderTab() {
  const tab = currentTab();
  current?.stop?.();
  current = null;
  for (const link of document.querySelectorAll('.tabs a')) link.classList.toggle('active', link.dataset.tab === tab);
  const main = $('#view');
  main.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    current = (await VIEWS[tab].view(main)) ?? null;
  } catch (err) {
    if (err instanceof UnauthorizedError) return renderLogin('Сессия истекла, войдите снова.');
    main.innerHTML = html`<p class="form-error">Ошибка: ${err instanceof ApiError ? errorText(err.code) : err.message}</p>`.toString();
  }
  return undefined;
}

function renderShell() {
  root.innerHTML = html`
    <header class="topbar">
      <div class="topbar-in">
        <strong class="brand">PC Market · управление</strong>
        <nav class="tabs" aria-label="Разделы">
          ${Object.entries(VIEWS).map(([key, v]) => html`<a href="#${key}" data-tab="${key}">${v.title}</a>`)}
        </nav>
        <button class="btn ghost" id="logout">Выйти</button>
      </div>
    </header>
    <main id="view" class="container"></main>`.toString();
  $('#logout').addEventListener('click', async () => {
    try { await api('/logout', { method: 'POST', json: {} }); } catch { /* уже вышли */ }
    renderLogin();
  });
  renderTab();
}

window.addEventListener('hashchange', () => { if ($('#view')) renderTab(); });

(async () => {
  try {
    await api('/me');
    renderShell();
  } catch (err) {
    if (err instanceof UnauthorizedError) renderLogin();
    else toast('Не удалось связаться с сервером', 'err');
  }
})();
