import {
  html, $, api, toast, fmtDate, errorText, ApiError,
} from '/admin/common.js';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Модерация отзывов: скрыть/показать/удалить. Скрытый отзыв виден только его автору. */
export async function reviewsView(main) {
  const state = { status: '' };
  main.innerHTML = html`
    <div class="toolbar">
      <select id="r-status" aria-label="Статус"><option value="">Все отзывы</option><option value="published">Опубликованные</option><option value="hidden">Скрытые</option></select>
    </div>
    <div class="table-wrap"><table class="table" id="reviews-table"></table></div>`.toString();

  const load = async () => {
    const list = await api(`/reviews${state.status ? `?status=${state.status}` : ''}`);
    $('#reviews-table', main).innerHTML = html`
      <thead><tr><th>Дата</th><th>Товар</th><th>Автор</th><th>Оценка</th><th>Отзыв</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${list.map((r) => html`
          <tr class="${r.status === 'hidden' ? 'dim' : ''}">
            <td>${fmtDate(r.created_at)}</td>
            <td><div class="muted small">${r.brand}</div>${r.product}</td>
            <td>${r.author}<div class="muted small">${r.email}</div></td>
            <td class="stars-admin">${stars(r.rating)}</td>
            <td class="review-body">${r.body || '—'}</td>
            <td>${r.status === 'hidden' ? html`<span class="badge cancelled">Скрыт</span>` : html`<span class="badge paid">Опубликован</span>`}</td>
            <td class="actions">
              <button class="btn small" data-toggle="${r.id}" data-to="${r.status === 'hidden' ? 'published' : 'hidden'}">${r.status === 'hidden' ? 'Показать' : 'Скрыть'}</button>
              <button class="btn small danger" data-remove="${r.id}">Удалить</button>
            </td>
          </tr>`)}
        ${list.length ? '' : html`<tr><td colspan="7" class="muted center">Отзывов пока нет</td></tr>`}
      </tbody>`.toString();
  };

  $('#r-status', main).addEventListener('change', (e) => { state.status = e.target.value; load(); });
  main.addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-toggle]');
    const remove = e.target.closest('[data-remove]');
    try {
      if (toggle) {
        await api(`/reviews/${toggle.dataset.toggle}`, { method: 'PATCH', json: { status: toggle.dataset.to } });
        toast('Готово');
        await load();
      } else if (remove && confirm('Удалить отзыв навсегда?')) {
        await api(`/reviews/${remove.dataset.remove}`, { method: 'DELETE' });
        toast('Отзыв удалён');
        await load();
      }
    } catch (err) {
      toast(err instanceof ApiError ? errorText(err.code) : 'Ошибка соединения', 'err');
    }
  });
  await load();
  return null;
}
