import { html, $, $$, debounce } from '../util.js';
import { t, categoryName, formatSpec, fmtNumber } from '../i18n.js';
import {
  getCategories, getProducts, getFilters, getBrands,
} from '../api.js';
import { productCard, emptyState, errorState } from '../components.js';
import { parseHash, replaceQuery, actions } from '../router.js';

const SORT_OPTIONS = ['name', 'price_asc', 'price_desc', 'rating', 'new'];

/** Значение фильтра, пришедшее строкой из JSON-запроса (->>), в типизированный вид для подписи. */
const typed = (spec, value) => {
  if (spec.type === 'bool') return value === 'true';
  return spec.numeric ? Number(value) : value;
};

function readFilters(root) {
  const params = new URLSearchParams();
  const cat = $('#f-cat', root)?.value;
  if (cat) params.set('cat', cat);
  const q = $('#f-q', root).value.trim();
  if (q) params.set('q', q);
  const brands = $$('input[name=brand]:checked', root).map((i) => i.value);
  if (brands.length) params.set('brand', brands.join(','));
  const min = $('#f-min', root).value;
  const max = $('#f-max', root).value;
  if (min) params.set('min', min);
  if (max) params.set('max', max);
  if ($('#f-stock', root).checked) params.set('stock', '1');
  const rating = $('#f-rating', root).value;
  if (rating) params.set('rating', rating);
  // характеристики: spec:<ключ> → s.<ключ>=значение1,значение2
  const bySpec = new Map();
  for (const input of $$('input[data-spec]:checked', root)) {
    bySpec.set(input.dataset.spec, [...(bySpec.get(input.dataset.spec) ?? []), input.value]);
  }
  for (const [key, values] of bySpec) params.set(`s.${key}`, values.join(','));
  const sort = $('#f-sort', root).value;
  if (sort !== 'name') params.set('sort', sort);
  return params;
}

async function loadGrid(root) {
  const params = readFilters(root);
  replaceQuery('/catalog', params);
  const grid = $('#grid', root);
  const counter = $('#count', root);
  const query = Object.fromEntries(params.entries());
  query.category = query.cat;
  delete query.cat;
  query.sort ??= 'name';
  try {
    const products = await getProducts(query);
    counter.textContent = `${products.length} ${t('common.products')}`;
    grid.innerHTML = products.length ? products.map(productCard).join('') : emptyState(t('common.nothing')).toString();
  } catch {
    grid.innerHTML = errorState().toString();
  }
}

function specGroup(spec, selected) {
  return html`
    <fieldset class="field">
      <legend>${t(`spec.${spec.key}`)}</legend>
      ${spec.values.map((v) => html`
        <label class="check"><input type="checkbox" data-spec="${spec.key}" value="${v.value}" data-change="catalog-filter" ${selected.has(v.value) ? 'checked' : ''}>
          ${formatSpec(spec.key, typed(spec, v.value))} <small class="muted">${v.count}</small></label>`)}
    </fieldset>`;
}

export const catalogPage = {
  async render() {
    const { params } = parseHash();
    const cat = params.get('cat') ?? '';
    const selectedBrands = new Set((params.get('brand') ?? '').split(',').filter(Boolean));
    const [categories, filters] = await Promise.all([getCategories(), getFilters(cat || undefined)]);
    const current = categories.find((c) => c.key === cat);
    // без выбранной категории вариантов характеристик нет — показываем все бренды магазина
    const brands = cat ? (filters.brands ?? []) : (await getBrands()).map((value) => ({ value }));
    const rating = params.get('rating') ?? '';

    return html`
      <h1>${current ? categoryName(current) : t('catalog.title')}</h1>
      <input type="hidden" id="f-cat" value="${cat}">
      <div class="catalog">
        <aside class="filters card">
          <div class="filters-head">
            <h3>${t('catalog.filters')}</h3>
            <a class="btn btn-ghost btn-sm" href="#/catalog${cat ? `?cat=${cat}` : ''}">${t('filter.reset')}</a>
          </div>
          <a class="btn btn-sm ${cat ? '' : 'btn-outline'}" href="#/catalog">${t('common.all')}</a>
          <label class="field"><span>${t('common.search')}</span>
            <input type="search" id="f-q" data-input="catalog-filter" placeholder="${t('catalog.search_ph')}" value="${params.get('q') ?? ''}"></label>
          <label class="check"><input type="checkbox" id="f-stock" data-change="catalog-filter" ${params.get('stock') === '1' ? 'checked' : ''}> ${t('filter.in_stock')}</label>
          <label class="field"><span>${t('filter.rating')}</span>
            <select id="f-rating" data-change="catalog-filter">
              <option value="">${t('filter.any')}</option>
              ${[4.5, 4, 3].map((r) => html`<option value="${r}" ${rating === String(r) ? 'selected' : ''}>★ ${r}+</option>`)}
            </select></label>
          <fieldset class="field"><legend>${t('common.brand')}</legend>
            ${brands.map((b) => html`<label class="check"><input type="checkbox" name="brand" value="${b.value}" data-change="catalog-filter" ${selectedBrands.has(b.value) ? 'checked' : ''}> ${b.value} ${b.count ? html`<small class="muted">${b.count}</small>` : ''}</label>`)}
          </fieldset>
          <div class="field"><span>${t('common.price')}${filters.price ? html` <small class="muted">${fmtNumber(filters.price.min)} – ${fmtNumber(filters.price.max)}</small>` : ''}</span>
            <div class="range">
              <input type="number" id="f-min" min="0" step="100000" data-change="catalog-filter" placeholder="${t('common.from')}" value="${params.get('min') ?? ''}">
              <input type="number" id="f-max" min="0" step="100000" data-change="catalog-filter" placeholder="${t('common.to')}" value="${params.get('max') ?? ''}">
            </div>
          </div>
          ${(filters.specs ?? []).map((spec) => specGroup(spec, new Set((params.get(`s.${spec.key}`) ?? '').split(',').filter(Boolean))))}
        </aside>
        <section>
          <div class="toolbar">
            <span id="count" class="muted"></span>
            <label class="inline">${t('common.sort')}
              <select id="f-sort" data-change="catalog-filter">
                ${SORT_OPTIONS.map((s) => html`<option value="${s}" ${(params.get('sort') ?? 'name') === s ? 'selected' : ''}>${t(`sort.${s}`)}</option>`)}
              </select>
            </label>
          </div>
          <div id="grid" class="grid"></div>
        </section>
      </div>`;
  },

  mount(root) {
    const reload = () => loadGrid(root);
    this.reload = reload;
    reload();
  },
};

// Фильтры обновляют только сетку, без перерисовки страницы (чтобы не терять фокус поля поиска).
const debounced = debounce(() => catalogPage.reload?.(), 250);
actions['catalog-filter'] = (el) => {
  if (el.type === 'search' || el.type === 'number') debounced();
  else catalogPage.reload?.();
};
