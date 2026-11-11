// Фото товаров: сколько настоящих фото загружено, пакетная загрузка с автосопоставлением по имени файла,
// быстрая замена главного фото и импорт по ссылке.
import {
  html, $, $$, api, toast, CATEGORY_LABEL, errorText, ApiError, esc,
} from '/admin/common.js';
import { suggestProduct, photoRole } from '/admin/match.js';

const isIllustration = (p) => String(p.image).endsWith('.svg');
const errMessage = (err) => (err instanceof ApiError ? errorText(err.code) : 'ошибка соединения');

export async function photosView(main) {
  let products = [];
  const state = { filter: 'missing', rows: [] };

  const optionList = (selectedId) => ['', ...Object.keys(CATEGORY_LABEL)].map((cat) => {
    if (!cat) return html`<option value="">— выберите товар —</option>`;
    return html`<optgroup label="${CATEGORY_LABEL[cat]}">${products.filter((p) => p.category === cat).map((p) => html`<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.brand} ${p.name}</option>`)}</optgroup>`;
  });

  main.innerHTML = html`
    <div class="photos-summary card-lite" id="ph-summary"></div>

    <section class="photos-block">
      <h3>Загрузить пачкой</h3>
      <p class="muted small">Выберите сразу много файлов. Товар подбирается по имени файла (<code>rtx-4070-super.jpg</code> → главное фото, <code>rtx-4070-super-2.jpg</code> → в галерею), неуверенные совпадения выберите вручную. Форматы PNG, JPG, WEBP.</p>
      <label class="dropzone" id="ph-drop"><input id="ph-files" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><span class="btn">Выбрать файлы</span> <span class="muted">или перетащите сюда</span></label>
      <div id="ph-queue"></div>
    </section>

    <section class="photos-block">
      <div class="toolbar">
        <h3 style="margin:0">Товары</h3>
        <select id="ph-filter" aria-label="Фильтр">
          <option value="missing">Без настоящего фото</option>
          <option value="done">С настоящим фото</option>
          <option value="all">Все</option>
        </select>
      </div>
      <div id="ph-grid" class="photo-grid"></div>
    </section>`.toString();

  const drawSummary = () => {
    const real = products.filter((p) => !isIllustration(p)).length;
    const pct = products.length ? Math.round((real / products.length) * 100) : 0;
    $('#ph-summary', main).innerHTML = html`
      <div><b>${real}</b> из ${products.length} товаров с настоящим фото <span class="muted">(остальные показывают иллюстрацию)</span></div>
      <div class="ph-bar"><i style="width:${pct}%"></i></div>`.toString();
  };

  const drawGrid = () => {
    const list = products.filter((p) => (state.filter === 'all' ? true : state.filter === 'missing' ? isIllustration(p) : !isIllustration(p)));
    $('#ph-grid', main).innerHTML = list.length ? list.map((p) => html`
      <figure class="ph-tile" data-id="${p.id}">
        <div class="ph-img ${isIllustration(p) ? '' : 'real'}"><img src="${p.image}" alt="" loading="lazy"><span class="badge ${isIllustration(p) ? 'new' : 'paid'}">${isIllustration(p) ? 'иллюстрация' : 'фото'}</span></div>
        <figcaption><span class="muted small">${CATEGORY_LABEL[p.category]} · ${p.brand}</span><b>${p.name}</b></figcaption>
        <div class="ph-actions">
          <label class="btn small">Загрузить<input type="file" accept="image/png,image/jpeg,image/webp" data-main-file="${p.id}" hidden></label>
          <button class="btn small" data-url="${p.id}">По ссылке</button>
        </div>
      </figure>`).join('') : '<p class="muted">Здесь пусто.</p>';
  };

  const reload = async () => {
    products = await api('/products');
    drawSummary();
    drawGrid();
  };

  // ───────── Пакетная загрузка ─────────
  const drawQueue = () => {
    const box = $('#ph-queue', main);
    if (!state.rows.length) { box.innerHTML = ''; return; }
    box.innerHTML = html`
      <table class="table compact">
        <thead><tr><th></th><th>Файл</th><th>Товар</th><th>Куда</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          ${state.rows.map((r, i) => html`
            <tr data-row="${i}">
              <td><img class="thumb" src="${r.preview}" alt=""></td>
              <td class="small">${r.file.name}<div class="muted">${Math.round(r.file.size / 1024)} КБ</div></td>
              <td><select data-field="product">${optionList(r.productId)}</select></td>
              <td><select data-field="role"><option value="main" ${r.role === 'main' ? 'selected' : ''}>Главное фото</option><option value="gallery" ${r.role === 'gallery' ? 'selected' : ''}>В галерею</option></select></td>
              <td class="small ${r.status === 'ok' ? 'ok-text' : r.status === 'error' ? 'form-error' : 'muted'}">${r.message || (r.productId ? 'готово к загрузке' : 'выберите товар')}</td>
              <td><button class="btn small danger" data-drop="${i}">✕</button></td>
            </tr>`)}
        </tbody>
      </table>
      <div class="form-actions"><button class="btn primary" id="ph-upload">Загрузить всё (${state.rows.filter((r) => r.productId && r.status !== 'ok').length})</button></div>`.toString();
  };

  const addFiles = (files) => {
    for (const file of files) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) continue;
      const match = suggestProduct(file.name, products);
      state.rows.push({
        file, preview: URL.createObjectURL(file), productId: match?.id ?? null, role: photoRole(file.name, match), status: 'idle', message: match ? `подобран: ${match.brand} ${match.name}` : '',
      });
    }
    drawQueue();
  };

  $('#ph-files', main).addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
  const drop = $('#ph-drop', main);
  ['dragover', 'dragenter'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, () => drop.classList.remove('drag')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles([...(e.dataTransfer?.files ?? [])]); });

  const uploadOne = async (row) => {
    const form = new FormData();
    form.set('image', row.file);
    if (row.role === 'gallery') await api(`/products/${row.productId}/images`, { method: 'POST', form });
    else await api(`/products/${row.productId}/main-image`, { method: 'PUT', form });
  };

  main.addEventListener('change', (e) => {
    const rowEl = e.target.closest('tr[data-row]');
    if (rowEl) {
      const row = state.rows[Number(rowEl.dataset.row)];
      if (e.target.dataset.field === 'product') row.productId = Number(e.target.value) || null;
      if (e.target.dataset.field === 'role') row.role = e.target.value;
      row.message = '';
      row.status = 'idle';
      drawQueue();
      return;
    }
    if (e.target.id === 'ph-filter') { state.filter = e.target.value; drawGrid(); return; }
    const single = e.target.dataset?.mainFile;
    if (single && e.target.files[0]) {
      const form = new FormData();
      form.set('image', e.target.files[0]);
      api(`/products/${single}/main-image`, { method: 'PUT', form })
        .then(() => { toast('Фото обновлено'); return reload(); })
        .catch((err) => toast(errMessage(err), 'err'));
    }
  });

  main.addEventListener('click', async (e) => {
    const dropBtn = e.target.closest('[data-drop]');
    if (dropBtn) { state.rows.splice(Number(dropBtn.dataset.drop), 1); drawQueue(); return; }

    if (e.target.id === 'ph-upload') {
      e.target.disabled = true;
      for (const row of state.rows) {
        if (!row.productId || row.status === 'ok') continue;
        row.status = 'busy';
        row.message = 'загружается…';
        drawQueue();
        try {
          // eslint-disable-next-line no-await-in-loop
          await uploadOne(row);
          row.status = 'ok';
          row.message = '✓ загружено';
        } catch (err) {
          row.status = 'error';
          row.message = errMessage(err);
        }
        drawQueue();
      }
      state.rows = state.rows.filter((r) => r.status !== 'ok');
      await reload();
      drawQueue();
      toast('Загрузка завершена');
      return;
    }

    const urlBtn = e.target.closest('[data-url]');
    if (urlBtn) {
      const link = window.prompt('Ссылка на фото (https://…). Используйте только фото, на которые у вас есть права.');
      if (!link) return;
      try {
        await api(`/products/${urlBtn.dataset.url}/images/from-url`, { method: 'POST', json: { url: link.trim(), as: 'main' } });
        toast('Фото загружено по ссылке');
        await reload();
      } catch (err) {
        toast(`${esc(errMessage(err))}`, 'err');
      }
    }
  });

  await reload();
  $$('.photos-block', main);
  return null;
}
