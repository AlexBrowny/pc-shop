import { html, $, $$, debounce } from '../util.js';
import { t, categoryName } from '../i18n.js';
import { getCategories, getProducts, getBrands } from '../api.js';
import { productCard, emptyState, errorState } from '../components.js';
import { parseHash, replaceQuery, actions } from '../router.js';

const SORT_OPTIONS = ['name', 'price_asc', 'price_desc', 'new'];

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
  const sort = $('#f-sort', root).value;
  if (sort !== 'name') params.set('sort', sort);
  return params;
}

async function loadGrid(root) {
  const params = readFilters(root);
  replaceQuery('/catalog', params);
  const grid = $('#grid', root);
  const counter = $('#count', root);
  try {
    const products = await getProducts({
      category: params.get('cat'), q: params.get('q'), brand: params.get('brand'),
      min: params.get('min'), max: params.get('max'), sort: params.get('sort') ?? 'name',
    });
    counter.textContent = `${products.length} ${t('common.products')}`;
    grid.innerHTML = products.length ? products.map(productCard).join('') : emptyState(t('common.nothing')).toString();
  } catch {
    grid.innerHTML = errorState().toString();
  }
}

export const catalogPage = {
  async render() {
    const { params } = parseHash();
    const cat = params.get('cat') ?? '';
    const selectedBrands = new Set((params.get('brand') ?? '').split(',').filter(Boolean));
    const [categories, brands] = await Promise.all([getCategories(), getBrands(cat || undefined)]);
    const current = categories.find((c) => c.key === cat);

    return html`
      <h1>${current ? categoryName(current) : t('catalog.title')}</h1>
      <input type="hidden" id="f-cat" value="${cat}">
      <div class="catalog">
        <aside class="filters card">
          <h3>${t('catalog.filters')}</h3>
          <a class="btn btn-sm ${cat ? '' : 'btn-outline'}" href="#/catalog">${t('common.all')}</a>
          <label class="field"><span>${t('common.search')}</span>
            <input type="search" id="f-q" data-input="catalog-filter" placeholder="${t('catalog.search_ph')}" value="${params.get('q') ?? ''}"></label>
          <fieldset class="field"><legend>${t('common.brand')}</legend>
            ${brands.map((b) => html`<label class="check"><input type="checkbox" name="brand" value="${b}" data-change="catalog-filter" ${selectedBrands.has(b) ? 'checked' : ''}> ${b}</label>`)}
          </fieldset>
          <div class="field"><span>${t('common.price')}</span>
            <div class="range">
              <input type="number" id="f-min" min="0" step="100000" data-change="catalog-filter" placeholder="${t('common.from')}" value="${params.get('min') ?? ''}">
              <input type="number" id="f-max" min="0" step="100000" data-change="catalog-filter" placeholder="${t('common.to')}" value="${params.get('max') ?? ''}">
            </div>
          </div>
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
