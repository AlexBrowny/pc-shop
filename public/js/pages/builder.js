import { html, $, toast } from '../util.js';
import {
  t, fmtPrice, keySpecs, issueText,
} from '../i18n.js';
import { getOptions, evaluateBuild } from '../api.js';
import { actions, go } from '../router.js';
import { icons, catIcon } from '../icons.js';
import { animateNumber } from '../motion.js';
import {
  viewportHtml, attachViewer, updateViewer, registerViewerActions,
} from './builder-viewer.js';
import {
  getBuild, setPart, addStorage, removeStorage, resetBuild, buildIds, addManyToCart,
} from '../store.js';

// Порядок в списке: как собирают руками — от корпуса к блоку питания
const SLOTS = ['case', 'cpu', 'cooler', 'motherboard', 'ram', 'gpu', 'storage', 'psu'];
const PRESETS = ['low', 'medium', 'high', 'ultra'];
const RESOLUTIONS = ['1080p', '1440p', '2160p'];
const MAX_DRIVES = 6;
const STATUS_RANK = { ok: 0, warn: 1, blocked: 2 };

const ui = {
  root: null,
  evaluation: null,
  resolution: '1080p',
  tab: 'parts',
  picker: null,
  requestId: 0,
  prevTotal: 0,
  flash: null, // слот, который только что изменили (для подсветки)
};

const fpsTier = (fps) => (fps < 30 ? 'bad' : fps < 60 ? 'ok' : fps < 144 ? 'good' : 'great');

/** Для каждого слота — наивысший уровень проблемы, в которой он участвует. */
function slotLevels(issues) {
  const levels = {};
  for (const issue of issues) {
    for (const slot of issue.involves) if (levels[slot] !== 'error') levels[slot] = issue.level;
  }
  return levels;
}

async function refresh() {
  const id = ++ui.requestId;
  try {
    const data = await evaluateBuild(getBuild(), ui.resolution);
    if (id !== ui.requestId) return; // пришёл более свежий запрос
    ui.evaluation = data;
  } catch {
    ui.evaluation = null;
  }
  draw();
  if (ui.evaluation) updateViewer(ui.root, ui.evaluation.parts);
  if (ui.picker) renderPicker();
}

// ───────── Основная страница ─────────
function avgFps(ev) {
  if (!ev.fps) return null;
  return Math.round(ev.fps.reduce((s, g) => s + g.presets.high.fps, 0) / ev.fps.length);
}

function pillsHtml(ev) {
  const hasParts = buildIds().length > 0;
  const errors = ev.issues.filter((i) => i.level === 'error').length;
  const warns = ev.issues.filter((i) => i.level === 'warn').length;
  const psu = ev.parts.psu?.specs.wattage_w;
  const base = psu ?? Math.max(ev.power.recommended, 1);
  const ratio = Math.min(100, Math.round((ev.power.estimated / base) * 100));
  const compat = !hasParts ? ['', icons.layers, t('bld.status_empty')]
    : errors ? ['bad', icons.alert, t('bld.status_issues', { n: errors + warns })]
      : warns ? ['warn', icons.alert, t('bld.status_issues', { n: warns })]
        : ['ok', icons.shield, t('bld.status_ok')];
  const fps = avgFps(ev);
  return html`
    <div class="pills">
      <div class="pill green">${icons.coin}<b id="total-val">${fmtPrice(ev.total)}</b></div>
      <div class="pill ${compat[0]}">${compat[1]}<b>${compat[2]}</b></div>
      <div class="pill amber">${icons.bolt}<b>${ev.power.estimated} ${t('unit.w')}${psu ? html` <em>/ ${psu} ${t('unit.w')}</em>` : ''}</b><span class="pill-meter ${ratio > 90 ? 'hot' : ''}"><i style="width:${ratio}%"></i></span></div>
      ${fps ? html`<div class="pill cyan">${icons.gauge}<b>${t('bld.fps_avg', { n: fps })}</b></div>` : ''}
    </div>`;
}

function issuesHtml(ev) {
  const hasParts = buildIds().length > 0;
  const list = [...ev.issues.filter((i) => i.level === 'error'), ...ev.issues.filter((i) => i.level === 'warn')];
  const missing = ev.missing.map((s) => t(`catpl.${s}`)).join(', ');
  if (!list.length && !(hasParts && ev.missing.length)) return '';
  return html`
    <ul class="issues bld-issues">
      ${list.map((i) => html`<li class="issue ${i.level}">${issueText(i)}</li>`)}
      ${hasParts && ev.missing.length ? html`<li class="issue info">${t('builder.missing', { list: missing })}</li>` : ''}
    </ul>`;
}

const partRow = (product, slot, level, actionsHtml) => html`
  <div class="prow ${level ? `has-${level}` : ''} ${ui.flash === slot ? 'flash' : ''}">
    <span class="pcat">${catIcon(slot, 16)}${t(`cat.${slot}`)}</span>
    <div class="pmain">
      <img src="${product.image}" alt="" loading="lazy">
      <div><a class="pname" href="#/product/${product.slug}">${product.brand} ${product.name}</a><small>${keySpecs(product).join(' · ')}</small></div>
    </div>
    <div class="pprice">${fmtPrice(product.price_uzs)}</div>
    <div class="pact">${actionsHtml}</div>
  </div>`;

const emptyRow = (slot) => html`
  <div class="prow empty">
    <span class="pcat">${catIcon(slot, 16)}${t(`cat.${slot}`)}</span>
    <div class="pmain muted">${t('builder.empty_slot')}</div>
    <div class="pprice"></div>
    <div class="pact"><button class="btn btn-sm btn-outline" data-action="b-pick" data-slot="${slot}">${icons.plus} ${t('builder.choose')}</button></div>
  </div>`;

function partsHtml(ev) {
  const levels = slotLevels(ev.issues);
  const hasParts = buildIds().length > 0;
  const rows = SLOTS.map((slot) => {
    if (slot === 'storage') {
      const drives = ev.parts.storage;
      return html`
        ${drives.map((d, i) => partRow(d, slot, levels.storage,
    html`<button class="btn btn-sm btn-ghost" data-action="b-remove-drive" data-index="${i}" aria-label="${t('common.remove')}">${icons.close}</button>`))}
        ${drives.length === 0 ? emptyRow(slot) : ''}
        ${drives.length > 0 && drives.length < MAX_DRIVES
    ? html`<div class="prow add-row"><span></span><div class="pmain"><button class="btn btn-sm btn-ghost" data-action="b-pick" data-slot="storage">${icons.plus} ${t('builder.add_drive')}</button></div></div>` : ''}`;
    }
    const product = ev.parts[slot];
    return product
      ? partRow(product, slot, levels[slot], html`
          <button class="btn btn-sm" data-action="b-pick" data-slot="${slot}">${t('builder.change')}</button>
          <button class="btn btn-sm btn-ghost" data-action="b-clear" data-slot="${slot}" aria-label="${t('common.remove')}">${icons.close}</button>`)
      : emptyRow(slot);
  });
  return html`
    <section class="card parts-card">
      <div class="pg-title"><span>${t('bld.section')}</span><small class="muted">${buildIds().length} / ${SLOTS.length}</small></div>
      <div class="prows">${rows}</div>
      <div class="parts-foot">
        <div class="total-line"><span class="muted">${t('common.total')}</span><strong>${fmtPrice(ev.total)}</strong></div>
        <div class="parts-actions">
          <button class="btn btn-ghost" data-action="b-reset" ${hasParts ? '' : 'disabled'}>${icons.trash} ${t('builder.reset')}</button>
          <button class="btn" data-action="b-add-all" ${hasParts ? '' : 'disabled'}>${icons.cart} ${t('builder.add_all')}</button>
          <button class="btn btn-primary" data-action="b-checkout" ${hasParts ? '' : 'disabled'}>${t('bld.checkout')} ${icons.arrow}</button>
        </div>
      </div>
    </section>`;
}

function fpsHtml(ev) {
  const resSelect = html`
    <label class="inline">${t('fps.resolution')}
      <select data-change="b-resolution">
        ${RESOLUTIONS.map((r) => html`<option value="${r}" ${r === ui.resolution ? 'selected' : ''}>${t(`res.${r}`)}</option>`)}
      </select>
    </label>`;

  if (!ev.fps) {
    return html`<section class="card fps"><div class="fps-head"><h2>${t('fps.title')}</h2>${resSelect}</div><p class="muted">${t('fps.need_parts')}</p></section>`;
  }

  const avg = PRESETS.map((p) => Math.round(ev.fps.reduce((s, g) => s + g.presets[p].fps, 0) / ev.fps.length));
  const bn = { gpu: t('fps.bn_gpu'), cpu: t('fps.bn_cpu'), vram: t('fps.bn_vram') };
  return html`
    <section class="card fps">
      <div class="fps-head"><h2>${t('fps.title')}</h2>${resSelect}</div>
      ${ev.fpsAssumesDefaultRam ? html`<p class="muted small">${t('fps.assume_ram')}</p>` : ''}
      <div class="table-wrap">
        <table class="fps-table">
          <thead><tr><th>${t('fps.game')}</th>${PRESETS.map((p) => html`<th>${t(`preset.${p}`)}</th>`)}</tr></thead>
          <tbody>
            ${ev.fps.map((g) => html`
              <tr>
                <th scope="row"><img src="${g.cover}" alt="" loading="lazy"><span>${g.title}</span></th>
                ${PRESETS.map((p) => {
    const cell = g.presets[p];
    return html`<td><span class="fps-cell ${fpsTier(cell.fps)}" title="${t('fps.bottleneck')}: ${bn[cell.bottleneck]}">${cell.fps}<sup>${cell.bottleneck[0].toUpperCase()}</sup><i style="--w:${Math.min(100, Math.round((cell.fps / 144) * 100))}%"></i></span></td>`;
  })}
              </tr>`)}
          </tbody>
          <tfoot><tr><th>${t('fps.avg')}</th>${avg.map((v) => html`<td><span class="fps-badge ${fpsTier(v)}">${v}</span></td>`)}</tr></tfoot>
        </table>
      </div>
      <div class="legend">
        <span class="fps-badge bad">${t('fps.legend_bad')}</span><span class="fps-badge ok">${t('fps.legend_ok')}</span>
        <span class="fps-badge good">${t('fps.legend_good')}</span><span class="fps-badge great">${t('fps.legend_great')}</span>
        <span class="muted small">G — ${bn.gpu}, C — ${bn.cpu}, V — ${bn.vram}</span>
      </div>
      <p class="muted small">${t('fps.disclaimer')}</p>
    </section>`;
}

function draw() {
  const root = ui.root;
  if (!root?.isConnected) return;
  const ev = ui.evaluation;
  if (!ev) {
    root.innerHTML = html`<div class="empty error">${t('common.error')}</div>`.toString();
    return;
  }
  root.innerHTML = html`
    <div class="bld-head"><div><h1>${t('bld.title')}</h1><p class="muted">${t('builder.sub')}</p></div></div>
    ${pillsHtml(ev)}
    ${issuesHtml(ev)}
    ${viewportHtml()}
    <div class="tabs" role="tablist">
      <button role="tab" class="tab ${ui.tab === 'parts' ? 'active' : ''}" data-action="b-tab" data-tab="parts">${icons.layers} ${t('bld.parts')}</button>
      <button role="tab" class="tab ${ui.tab === 'fps' ? 'active' : ''}" data-action="b-tab" data-tab="fps">${icons.gauge} ${t('bld.fps_tab')}</button>
    </div>
    ${ui.tab === 'parts' ? partsHtml(ev) : fpsHtml(ev)}`.toString();
  attachViewer(root);
  const totalEl = $('#total-val', root);
  if (totalEl) {
    animateNumber(totalEl, ev.total, { from: ui.prevTotal, duration: 700, format: (v) => fmtPrice(Math.round(v)) });
    ui.prevTotal = ev.total;
  }
  ui.flash = null;
}

// ───────── Окно выбора детали ─────────
function pickerRoot() {
  let el = document.getElementById('picker-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'picker-root';
    document.body.appendChild(el);
  }
  return el;
}

function filteredOptions(pk) {
  const q = pk.search.trim().toLowerCase();
  const list = pk.options.filter((o) => {
    const p = o.product;
    if (pk.compatOnly && o.status === 'blocked') return false;
    if (pk.inStock && p.stock <= 0) return false;
    if (pk.brands.size && !pk.brands.has(p.brand)) return false;
    if (pk.min !== '' && p.price_uzs < Number(pk.min)) return false;
    if (pk.max !== '' && p.price_uzs > Number(pk.max)) return false;
    return !q || `${p.brand} ${p.name}`.toLowerCase().includes(q);
  });
  const by = {
    compat: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.product.price_uzs - b.product.price_uzs,
    price_asc: (a, b) => a.product.price_uzs - b.product.price_uzs,
    price_desc: (a, b) => b.product.price_uzs - a.product.price_uzs,
    name: (a, b) => `${a.product.brand} ${a.product.name}`.localeCompare(`${b.product.brand} ${b.product.name}`),
  }[pk.sort];
  return list.sort(by);
}

const STATUS_LABEL = { ok: 'builder.compatible', warn: 'builder.warn', blocked: 'builder.blocked' };

function renderPicker() {
  const pk = ui.picker;
  const host = pickerRoot();
  if (!pk) {
    host.innerHTML = '';
    document.body.classList.remove('modal-open');
    return;
  }
  const scrollTop = $('.pk-grid', host)?.scrollTop ?? 0;
  const focusedId = document.activeElement?.closest?.('#picker-root') ? document.activeElement.id : '';
  const focusedInput = focusedId ? document.activeElement : null;
  const caret = focusedInput?.selectionStart;
  const ev = ui.evaluation;
  const selectedIds = new Set(buildIds());
  const shown = filteredOptions(pk);
  const brands = [...new Set(pk.options.map((o) => o.product.brand))].sort();
  const catName = t(`cat.${pk.slot}`);

  host.innerHTML = html`
    <div class="modal-backdrop" data-action="b-close-picker">
      <div class="modal picker" role="dialog" aria-modal="true" aria-label="${t('builder.picker_title', { cat: catName })}" data-stop>
        <aside class="pk-side">
          <div class="pk-summary">
            <div class="pk-sum-title">${icons.layers} ${t('pk.summary')}</div>
            <dl>
              <div><dt>${t('pk.parts')}</dt><dd>${buildIds().length}</dd></div>
              <div><dt>${t('pk.price')}</dt><dd class="green">${fmtPrice(ev?.total ?? 0)}</dd></div>
              <div><dt>${t('pk.watts')}</dt><dd class="amber">${ev?.power.estimated ?? 0} ${t('unit.w')}</dd></div>
            </dl>
          </div>
          <label class="switch"><input type="checkbox" data-change="b-pk-compat" ${pk.compatOnly ? 'checked' : ''}><span class="knob"></span><span>${t('pk.compat_filter')}</span></label>
          <label class="switch"><input type="checkbox" data-change="b-pk-stock" ${pk.inStock ? 'checked' : ''}><span class="knob"></span><span>${t('pk.in_stock')}</span></label>
          <div class="pk-block">
            <h4>${t('pk.price_range')}</h4>
            <div class="range">
              <input id="pk-min" type="number" min="0" step="100000" data-input="b-pk-min" placeholder="${t('common.from')}" value="${pk.min}">
              <input id="pk-max" type="number" min="0" step="100000" data-input="b-pk-max" placeholder="${t('common.to')}" value="${pk.max}">
            </div>
          </div>
          <div class="pk-block">
            <h4>${t('pk.brand')}</h4>
            ${brands.map((b) => html`<label class="check"><input type="checkbox" data-change="b-pk-brand" value="${b}" ${pk.brands.has(b) ? 'checked' : ''}> ${b}</label>`)}
          </div>
        </aside>
        <div class="pk-main">
          <div class="pk-head">
            <div><h2>${t('builder.picker_title', { cat: catName })}</h2><small class="muted">${t('pk.showing', { n: shown.length, total: pk.options.length })}</small></div>
            <div class="pk-tools">
              <label class="pk-search">${icons.search}<input id="pk-q" type="search" data-input="b-pk-search" placeholder="${t('common.search')}" value="${pk.search}"></label>
              <select data-change="b-pk-sort" aria-label="${t('common.sort')}">
                ${['compat', 'price_asc', 'price_desc', 'name'].map((s) => html`<option value="${s}" ${pk.sort === s ? 'selected' : ''}>${t(`pk.sort_${s}`)}</option>`)}
              </select>
              <button class="btn btn-ghost btn-sm" data-action="b-close-picker" aria-label="${t('common.close')}">${icons.close}</button>
            </div>
          </div>
          <div class="pk-grid">
            ${pk.loading ? html`<div class="empty">${t('common.loading')}</div>` : ''}
            ${shown.map((o) => html`
              <article class="pk-card ${o.status} ${selectedIds.has(o.product.id) ? 'selected' : ''}">
                <div class="pk-img"><img src="${o.product.image}" alt="" loading="lazy"><span class="tag ${o.status}">${t(STATUS_LABEL[o.status])}</span></div>
                <div class="pk-body">
                  <div class="brand">${o.product.brand}</div>
                  <b class="pk-name">${o.product.name}</b>
                  <div class="pk-price">${fmtPrice(o.product.price_uzs)}</div>
                  <ul class="pk-specs">${keySpecs(o.product).map((s) => html`<li>${s}</li>`)}</ul>
                  ${o.reasons.map((r) => html`<div class="reason ${r.level}">${issueText(r)}</div>`)}
                </div>
                <button class="btn ${o.status === 'blocked' ? '' : 'btn-primary'} btn-sm" data-action="b-select" data-id="${o.product.id}" ${o.status === 'blocked' ? 'disabled' : ''}>
                  ${selectedIds.has(o.product.id) ? html`${icons.check} ${t('pk.selected')}` : o.status === 'blocked' ? t('pk.incompatible') : html`${icons.plus} ${t('pk.add')}`}</button>
              </article>`)}
            ${!pk.loading && shown.length === 0 ? html`<div class="empty">${t('common.nothing')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>`.toString();
  document.body.classList.add('modal-open');
  const grid = $('.pk-grid', host);
  if (grid) grid.scrollTop = scrollTop;
  if (focusedId) {
    const input = document.getElementById(focusedId);
    input?.focus();
    if (caret !== undefined && caret !== null) { try { input.setSelectionRange(caret, caret); } catch { /* number input */ } }
  }
}

async function openPicker(slot) {
  ui.picker = {
    slot, options: [], loading: true, search: '', compatOnly: true, inStock: false, brands: new Set(), min: '', max: '', sort: 'compat',
  };
  renderPicker();
  try {
    ui.picker.options = await getOptions(slot, getBuild());
    ui.picker.loading = false;
  } catch {
    ui.picker = null;
    toast(t('common.error'));
  }
  renderPicker();
}

const closePicker = () => { ui.picker = null; renderPicker(); };

// ───────── Страница ─────────
export const builderPage = {
  render() {
    return html`<div id="builder"><div class="empty">${t('common.loading')}</div></div>`;
  },
  mount(root) {
    ui.root = $('#builder', root);
    ui.picker = null;
    ui.prevTotal = 0;
    refresh();
  },
  unmount() {
    ui.picker = null;
    renderPicker();
  },
};

// ───────── Действия ─────────
actions['b-pick'] = (el) => openPicker(el.dataset.slot);
actions['b-close-picker'] = (el, e) => {
  if (el.classList.contains('modal-backdrop') && e.target.closest('[data-stop]')) return;
  closePicker();
};
actions['b-select'] = (el) => {
  const { slot } = ui.picker;
  const id = Number(el.dataset.id);
  if (slot === 'storage') addStorage(id);
  else setPart(slot, id);
  ui.flash = slot;
  ui.picker = null;
  renderPicker();
  refresh();
};
actions['b-clear'] = (el) => { setPart(el.dataset.slot, null); refresh(); };
actions['b-remove-drive'] = (el) => { removeStorage(Number(el.dataset.index)); refresh(); };
actions['b-reset'] = () => { resetBuild(); ui.prevTotal = 0; refresh(); };
actions['b-add-all'] = () => { addManyToCart(buildIds()); toast(t('builder.added')); };
actions['b-checkout'] = () => { addManyToCart(buildIds()); go('/cart'); };
actions['b-resolution'] = (el) => { ui.resolution = el.value; refresh(); };
actions['b-tab'] = (el) => { ui.tab = el.dataset.tab; draw(); if (ui.evaluation) updateViewer(ui.root, ui.evaluation.parts); };
actions['b-pk-search'] = (el) => { if (ui.picker) { ui.picker.search = el.value; renderPicker(); } };
actions['b-pk-compat'] = (el) => { if (ui.picker) { ui.picker.compatOnly = el.checked; renderPicker(); } };
actions['b-pk-stock'] = (el) => { if (ui.picker) { ui.picker.inStock = el.checked; renderPicker(); } };
actions['b-pk-sort'] = (el) => { if (ui.picker) { ui.picker.sort = el.value; renderPicker(); } };
actions['b-pk-min'] = (el) => { if (ui.picker) { ui.picker.min = el.value; renderPicker(); } };
actions['b-pk-max'] = (el) => { if (ui.picker) { ui.picker.max = el.value; renderPicker(); } };
actions['b-pk-brand'] = (el) => {
  if (!ui.picker) return;
  const next = new Set(ui.picker.brands);
  if (el.checked) next.add(el.value); else next.delete(el.value);
  ui.picker.brands = next;
  renderPicker();
};

registerViewerActions(draw);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.picker) closePicker();
});
