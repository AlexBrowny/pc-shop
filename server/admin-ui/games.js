import {
  html, $, api, toast, openModal, errorText, ApiError, flattenErrors, esc,
} from '/admin/common.js';

const PRESETS = ['Низкие', 'Средние', 'Высокие', 'Ультра'];

const fourInputs = (name, values, step = 1) => html`
  <div class="four">${PRESETS.map((label, i) => html`
    <label class="field"><span>${label}</span><input name="${name}${i}" type="number" min="1" step="${step}" value="${values?.[i] ?? ''}" required></label>`)}
  </div>`;

export async function gamesView(main) {
  main.innerHTML = html`
    <div class="toolbar"><span class="muted" id="count"></span><button class="btn primary" id="add">＋ Добавить игру</button></div>
    <div class="table-wrap"><table class="table" id="games-table"></table></div>`.toString();

  let games = [];
  const load = async () => {
    games = await api('/games');
    $('#count', main).textContent = `Игр в базе: ${games.filter((g) => g.active).length}`;
    $('#games-table', main).innerHTML = html`
      <thead><tr><th></th><th>Игра</th><th>Год</th><th>GPU: ультра, FPS</th><th>CPU: ультра, FPS</th><th>Тип</th><th></th></tr></thead>
      <tbody>${games.map((g) => html`
        <tr class="${g.active ? '' : 'dim'}">
          <td><img class="thumb tall" src="${g.cover}" alt="" loading="lazy"></td>
          <td>${g.title}</td><td>${g.year ?? '—'}</td><td>${g.gpu_fps[3]}</td><td>${g.cpu_fps[3]}</td>
          <td>${g.builtin ? 'Встроенная' : 'Добавлена вручную'}${g.active ? '' : html` <span class="badge cancelled">Скрыта</span>`}</td>
          <td class="actions"><button class="btn small" data-edit="${g.id}">Изменить</button></td>
        </tr>`)}</tbody>`.toString();
  };

  $('#add', main).addEventListener('click', () => openForm(null));
  main.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) openForm(games.find((g) => g.id === Number(edit.dataset.edit)));
  });

  function openForm(game) {
    const isNew = !game;
    const modal = openModal(isNew ? 'Новая игра' : `Изменить: ${game.title}`, html`
      <form id="g-form" class="form" novalidate>
        <div class="grid2">
          <label class="field span2"><span>Название</span><input name="title" value="${game?.title ?? ''}" maxlength="80" required></label>
          <label class="field"><span>Год выхода</span><input name="year" type="number" min="1990" max="2100" value="${game?.year ?? ''}"></label>
          <label class="field"><span>Рекомендуемая ОЗУ, ГБ</span><input name="ram_gb" type="number" min="4" max="128" value="${game?.ram_gb ?? 16}" required></label>
          <label class="field span2"><span>Обложка (PNG, JPG, WEBP)${isNew ? ' — без файла будет сгенерирована' : ''}</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
          ${isNew ? html`<label class="field"><span>Оттенок генерируемой обложки (0–359)</span><input name="hue" type="number" min="0" max="359" value="220"></label>` : ''}
          ${game ? html`<label class="field check"><input type="checkbox" name="active" ${game.active ? 'checked' : ''}> Участвует в расчёте FPS</label>` : ''}
        </div>
        <h3>Требовательность к видеокарте</h3>
        <p class="muted small">FPS в 1080p на эталонной видеокарте (индекс 100, примерно RTX 4060) без ограничения процессором.</p>
        ${fourInputs('gpu_fps', game?.gpu_fps)}
        <h3>Требовательность к процессору</h3>
        <p class="muted small">FPS, который даёт эталонный процессор (индекс 100, примерно Core i5-13400F), если видеокарта не ограничивает.</p>
        ${fourInputs('cpu_fps', game?.cpu_fps)}
        <h3>Видеопамять, ГБ</h3>
        <p class="muted small">Сколько VRAM нужно в 1080p; для 1440p и 4K модель масштабирует значение сама.</p>
        ${fourInputs('vram', game?.vram, 0.5)}
        <ul id="g-errors" class="form-error" hidden></ul>
        <div class="form-actions">
          ${game && game.active ? html`<button type="button" class="btn danger" id="g-hide">Скрыть игру</button>` : ''}
          <button class="btn primary" type="submit">Сохранить</button>
        </div>
      </form>`, { wide: true });
    const formEl = $('#g-form', modal.el);

    $('#g-hide', formEl)?.addEventListener('click', async () => {
      if (!confirm('Скрыть игру из расчёта FPS?')) return;
      await api(`/games/${game.id}`, { method: 'DELETE' });
      toast('Игра скрыта');
      modal.close();
      load();
    });

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const arr = (name) => [0, 1, 2, 3].map((i) => Number(formEl.elements[`${name}${i}`].value));
      const body = new FormData();
      body.set('title', formEl.elements.title.value);
      body.set('year', formEl.elements.year.value);
      body.set('ram_gb', formEl.elements.ram_gb.value);
      body.set('hue', formEl.elements.hue?.value ?? '220');
      for (const name of ['gpu_fps', 'cpu_fps', 'vram']) body.set(name, JSON.stringify(arr(name)));
      if (game) body.set('active', formEl.elements.active.checked ? 'true' : 'false');
      const file = formEl.elements.image.files[0];
      if (file) body.set('image', file);
      const box = $('#g-errors', formEl);
      box.hidden = true;
      try {
        await api(isNew ? '/games' : `/games/${game.id}`, { method: isNew ? 'POST' : 'PUT', form: body });
        toast('Сохранено');
        modal.close();
        load();
      } catch (err) {
        const lines = err instanceof ApiError ? (Object.keys(err.fields).length ? flattenErrors(err.fields) : [errorText(err.code)]) : ['Ошибка соединения'];
        box.innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join('');
        box.hidden = false;
      }
    });
  }

  await load();
  return null;
}
