import {
  html, $, $$, api, toast, openModal, fmtUzs, CATEGORY_LABEL, errorText, ApiError, flattenErrors, esc,
} from '/admin/common.js';

/** Поле характеристики по описанию из /api/admin/spec-schema. */
function specInput(field, value) {
  const name = `spec:${field.key}`;
  const label = html`<span>${field.label}${field.nullable || field.optional ? html` <small class="muted">(необязательно)</small>` : ''}</span>`;
  switch (field.type) {
    case 'bool':
      return html`<label class="field check"><input type="checkbox" name="${name}" ${value ? 'checked' : ''}> ${field.label}</label>`;
    case 'enum':
      return html`<label class="field">${label}<select name="${name}">${field.options.map((o) => html`<option ${o === value ? 'selected' : ''}>${o}</option>`)}</select></label>`;
    case 'multi': {
      const current = new Set(value ?? []);
      const options = field.free ? [...new Set([...field.options, ...current])] : field.options;
      return html`<fieldset class="field">${label}<div class="checks">${options.map((o) => html`<label class="check"><input type="checkbox" name="${name}" value="${o}" ${current.has(o) ? 'checked' : ''}> ${o}</label>`)}</div></fieldset>`;
    }
    case 'intlist':
      if (field.single) {
        return html`<label class="field">${label}<select name="${name}"><option value="">—</option>${field.options.map((o) => html`<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`)}</select></label>`;
      }
      return html`<fieldset class="field">${label}<div class="checks">${field.options.map((o) => html`<label class="check"><input type="checkbox" name="${name}" value="${o}" ${(value ?? []).includes(o) ? 'checked' : ''}> ${o} мм</label>`)}</div></fieldset>`;
    case 'string':
      return html`<label class="field">${label}<input name="${name}" value="${value ?? ''}" maxlength="60"></label>`;
    default:
      return html`<label class="field">${label}<input name="${name}" type="number" step="${field.type === 'int' ? 1 : 'any'}" min="${field.min}" max="${field.max}" value="${value ?? ''}"></label>`;
  }
}

/** Собирает значения характеристик из формы в объект. */
function readSpecs(formEl, fields) {
  const specs = {};
  for (const f of fields) {
    const name = `spec:${f.key}`;
    if (f.type === 'bool') specs[f.key] = formEl.elements[name].checked;
    else if (f.type === 'multi' || (f.type === 'intlist' && !f.single)) specs[f.key] = $$(`[name="${name}"]:checked`, formEl).map((i) => i.value);
    else specs[f.key] = formEl.elements[name].value;
  }
  return specs;
}

export async function productsView(main) {
  const schema = await api('/spec-schema');
  const state = { category: '', q: '' };

  main.innerHTML = html`
    <div class="toolbar">
      <select id="f-cat" aria-label="Категория"><option value="">Все категории</option>${Object.entries(CATEGORY_LABEL).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
      <input id="f-q" type="search" placeholder="Название или бренд" aria-label="Поиск">
      <button class="btn primary" id="add">＋ Добавить товар</button>
    </div>
    <div class="table-wrap"><table class="table" id="products-table"></table></div>`.toString();

  const load = async () => {
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.q) params.set('q', state.q);
    const rows = await api(`/products?${params}`);
    $('#products-table', main).innerHTML = html`
      <thead><tr><th></th><th>Товар</th><th>Категория</th><th>Цена</th><th>Остаток</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${rows.map((p) => html`
          <tr class="${p.active ? '' : 'dim'}">
            <td><img class="thumb" src="${p.image}" alt="" loading="lazy"></td>
            <td><div class="muted small">${p.brand}</div>${p.name}</td>
            <td>${CATEGORY_LABEL[p.category]}</td>
            <td class="num">${fmtUzs(p.price_uzs)}</td>
            <td>${p.stock}</td>
            <td>${p.active ? html`<span class="badge paid">На витрине</span>` : html`<span class="badge cancelled">Скрыт</span>`}</td>
            <td class="actions"><button class="btn small" data-edit="${p.id}">Изменить</button></td>
          </tr>`)}
        ${rows.length ? '' : html`<tr><td colspan="7" class="muted center">Ничего не найдено</td></tr>`}
      </tbody>`.toString();
    main.productsById = new Map(rows.map((p) => [p.id, p]));
  };

  $('#f-cat', main).addEventListener('change', (e) => { state.category = e.target.value; load(); });
  let timer;
  $('#f-q', main).addEventListener('input', (e) => { clearTimeout(timer); timer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 250); });
  $('#add', main).addEventListener('click', () => openForm(null));
  main.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) openForm(main.productsById.get(Number(edit.dataset.edit)));
  });

  function openForm(product) {
    const isNew = !product;
    const modal = openModal(isNew ? 'Новый товар' : `Изменить: ${product.name}`, html`<form id="p-form" class="form" novalidate></form>`, { wide: true });
    const formEl = $('#p-form', modal.el);

    const draw = (category, specValues) => {
      const fields = schema[category];
      formEl.innerHTML = html`
        <div class="grid2">
          <label class="field"><span>Категория</span>
            <select name="category">${Object.entries(CATEGORY_LABEL).map(([k, v]) => html`<option value="${k}" ${k === category ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="field"><span>Бренд</span><input name="brand" value="${product?.brand ?? ''}" maxlength="40" required></label>
          <label class="field span2"><span>Название модели</span><input name="name" value="${product?.name ?? ''}" maxlength="90" required></label>
          <label class="field"><span>Цена, сум</span><input name="price_uzs" type="number" min="0" step="1000" value="${product?.price_uzs ?? ''}" required></label>
          <label class="field"><span>Остаток, шт.</span><input name="stock" type="number" min="0" step="1" value="${product?.stock ?? 10}" required></label>
          <label class="field span2"><span>Картинка (PNG, JPG, WEBP, до 5 МБ)${isNew ? ' — без файла будет создана иллюстрация' : ''}</span><input name="image" type="file" accept="image/png,image/jpeg,image/webp"></label>
          ${product ? html`<label class="field check"><input type="checkbox" name="active" ${product.active ? 'checked' : ''}> Показывать на витрине</label>` : ''}
        </div>
        <h3>Характеристики</h3>
        <p class="muted small">По ним работают проверка совместимости, расчёт FPS и 3D-модель.</p>
        <div class="grid2">${fields.map((f) => specInput(f, specValues?.[f.key]))}</div>
        <ul id="p-errors" class="form-error" hidden></ul>
        <div class="form-actions">
          ${product && product.active ? html`<button type="button" class="btn danger" id="p-hide">Скрыть с витрины</button>` : ''}
          <button class="btn primary" type="submit">Сохранить</button>
        </div>`.toString();
      $('[name=category]', formEl).addEventListener('change', (e) => draw(e.target.value, undefined));
      $('#p-hide', formEl)?.addEventListener('click', async () => {
        if (!confirm('Скрыть товар с витрины? Старые заказы с ним сохранятся.')) return;
        await api(`/products/${product.id}`, { method: 'DELETE' });
        toast('Товар скрыт');
        modal.close();
        load();
      });
    };
    draw(product?.category ?? 'cpu', product?.specs);

    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      const category = formEl.elements.category.value;
      const body = new FormData();
      for (const key of ['category', 'brand', 'name', 'price_uzs', 'stock']) body.set(key, formEl.elements[key].value);
      body.set('specs', JSON.stringify(readSpecs(formEl, schema[category])));
      if (product) body.set('active', formEl.elements.active.checked ? 'true' : 'false');
      const file = formEl.elements.image.files[0];
      if (file) body.set('image', file);
      const errBox = $('#p-errors', formEl);
      errBox.hidden = true;
      try {
        await api(isNew ? '/products' : `/products/${product.id}`, { method: isNew ? 'POST' : 'PUT', form: body });
        toast('Сохранено');
        modal.close();
        load();
      } catch (err) {
        const lines = err instanceof ApiError ? (Object.keys(err.fields).length ? flattenErrors(err.fields) : [errorText(err.code)]) : ['Ошибка соединения'];
        errBox.innerHTML = lines.map((l) => `<li>${esc(l)}</li>`).join('');
        errBox.hidden = false;
      }
    });
  }

  await load();
  return null;
}
