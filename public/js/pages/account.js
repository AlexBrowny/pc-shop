// Личный кабинет: профиль, история заказов, сохранённые сборки.
import { html, $, toast } from '../util.js';
import { t, fmtPrice, getLang } from '../i18n.js';
import {
  getMyOrders, getMyBuilds, deleteMyBuild, logoutUser,
} from '../api.js';
import {
  getUser, setUser, loadBuild, shareUrl,
} from '../store.js';
import { actions, go } from '../router.js';
import { icons } from '../icons.js';

const fmtDate = (iso) => new Date(iso).toLocaleString(getLang() === 'uz' ? 'uz-UZ' : 'ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

const buildPartCount = (ids) => Object.entries(ids).reduce((n, [k, v]) => n + (k === 'storage' ? v.length : (v ? 1 : 0)), 0);

function ordersBlock(orders) {
  if (!orders.length) return html`<p class="muted">${t('account.no_orders')}</p>`;
  return html`
    <ul class="acc-list">
      ${orders.map((o) => html`
        <li class="card acc-order">
          <div class="acc-head">
            <strong>${t('account.order_n', { id: o.id })}</strong>
            <span class="status-pill st-${o.status}">${t(`order.status.${o.status}`)}</span>
            <span class="muted small">${fmtDate(o.created_at)}</span>
            <b class="acc-total">${fmtPrice(o.total_uzs)}</b>
          </div>
          <ul class="acc-items">${o.items.map((i) => html`<li>${i.brand} ${i.name} <span class="muted">× ${i.qty}</span></li>`)}</ul>
        </li>`)}
    </ul>`;
}

function buildsBlock(builds) {
  if (!builds.length) return html`<p class="muted">${t('account.no_builds')}</p>`;
  return html`
    <ul class="acc-list">
      ${builds.map((b) => html`
        <li class="card acc-build">
          <div class="acc-head">
            <strong>${b.name}</strong>
            <span class="muted small">${t('account.parts', { n: buildPartCount(b.ids) })} · ${fmtDate(b.created_at)}</span>
          </div>
          <div class="acc-actions">
            <button class="btn btn-primary btn-sm" data-action="acc-open-build" data-id="${b.id}">${icons.cube} ${t('account.open')}</button>
            <button class="btn btn-sm" data-action="acc-share-build" data-id="${b.id}">${icons.share} ${t('bld.share')}</button>
            <button class="btn btn-ghost btn-sm" data-action="acc-delete-build" data-id="${b.id}">${icons.trash} ${t('account.delete')}</button>
          </div>
        </li>`)}
    </ul>`;
}

let builds = [];

export const accountPage = {
  async render() {
    const user = getUser();
    if (!user) {
      go('/login?next=/account');
      return html``;
    }
    const [orders, myBuilds] = await Promise.all([getMyOrders(), getMyBuilds()]);
    builds = myBuilds;
    return html`
      <div class="acc-top">
        <div>
          <h1>${t('account.title')}</h1>
          <p class="muted">${t('account.hello', { name: user.name })} · ${user.email}</p>
        </div>
        <button class="btn btn-ghost" data-action="logout">${t('auth.logout')}</button>
      </div>
      <section class="acc-section">
        <h2>${t('account.builds')}</h2>
        <div id="acc-builds">${buildsBlock(builds)}</div>
      </section>
      <section class="acc-section">
        <h2>${t('account.orders')}</h2>
        ${ordersBlock(orders)}
      </section>`;
  },
};

actions.logout = async () => {
  try { await logoutUser(); } catch { /* уже вышли */ }
  setUser(null);
  go('/');
};

actions['acc-open-build'] = (el) => {
  const found = builds.find((b) => b.id === Number(el.dataset.id));
  if (!found) return;
  loadBuild(found.ids);
  go('/builder');
};

actions['acc-share-build'] = async (el) => {
  const found = builds.find((b) => b.id === Number(el.dataset.id));
  if (!found) return;
  try {
    await navigator.clipboard.writeText(shareUrl(found.ids));
    toast(t('bld.link_copied'));
  } catch { /* буфер недоступен */ }
};

actions['acc-delete-build'] = async (el) => {
  const id = Number(el.dataset.id);
  try {
    await deleteMyBuild(id);
    builds = builds.filter((b) => b.id !== id);
    $('#acc-builds').innerHTML = buildsBlock(builds).toString();
  } catch { toast(t('common.error')); }
};
