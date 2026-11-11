// 3D/2D-панель конструктора. three.js подгружается лениво,
// поэтому сбой загрузки или отсутствие WebGL не ломают остальную страницу.
import { html, $ } from '../util.js';
import { t } from '../i18n.js';
import { actions } from '../router.js';
import { icons } from '../icons.js';

const vs = {
  viewer: null,
  status: 'loading', // loading | ready | failed
  mode: '3d',
  glass: true,
  rotate: false,
  result: null, // { defaultCase, ghostBoard } из последнего update()
};

let initPromise = null;
function init() {
  initPromise ??= import('../viewer/viewer.js')
    .then((mod) => {
      const viewer = mod.createViewer();
      if (!viewer) {
        vs.status = 'failed';
        return;
      }
      viewer.setTheme(document.documentElement.dataset.theme);
      viewer.setMode(vs.mode);
      viewer.setGlass(vs.glass);
      viewer.setAutoRotate(vs.rotate);
      vs.viewer = viewer;
      vs.status = 'ready';
    })
    .catch(() => { vs.status = 'failed'; });
  return initPromise;
}

const tool = (action, icon, label, on = false) => html`
  <button class="vp-tool ${on ? 'on' : ''}" data-action="${action}" aria-pressed="${on}" title="${label}">${icon}<span>${label}</span></button>`;

export function viewportHtml() {
  const note = vs.result?.defaultCase ? t('viewer.default_case') : (vs.mode === '3d' ? t('viewer.hint3d') : t('viewer.hint2d'));
  return html`
    <section class="viewport card preview" aria-label="${t('builder.preview')}">
      <div class="vp-top">
        <div class="seg vp-seg" role="group" aria-label="3D / 2D">
          ${['3d', '2d'].map((m) => html`<button data-action="v-mode" data-mode="${m}" class="${vs.mode === m ? 'active' : ''}">${m.toUpperCase()}</button>`)}
        </div>
        <div class="vp-zoom">
          <button class="vp-ico" data-action="v-zoom" data-f="1.25" title="${t('viewer.zoom_in')}" aria-label="${t('viewer.zoom_in')}">${icons.zoomIn}</button>
          <button class="vp-ico" data-action="v-zoom" data-f="0.8" title="${t('viewer.zoom_out')}" aria-label="${t('viewer.zoom_out')}">${icons.zoomOut}</button>
          <button class="vp-ico" data-action="v-reset" title="${t('viewer.reset')}" aria-label="${t('viewer.reset')}">${icons.expand}</button>
        </div>
      </div>
      <div id="viewer-slot" class="viewer-slot"></div>
      <div class="vp-bar">
        ${vs.mode === '3d' ? tool('v-glass', icons.eye, t('viewer.glass'), vs.glass) : ''}
        ${vs.mode === '3d' ? tool('v-rotate', icons.rotate, t('viewer.rotate'), vs.rotate) : ''}
        ${tool('v-fullscreen', icons.expand, t('viewer.fullscreen'))}
      </div>
      <p class="viewer-note">${note} <span class="credits">${t('viewer.credits')}</span></p>
    </section>`;
}

/** Вставляет уже созданный холст в свежеотрисованную панель (дёшево, без пересборки сцены). */
export function attachViewer(root) {
  const slot = $('#viewer-slot', root);
  if (!slot) return;
  if (vs.viewer) {
    slot.replaceChildren(vs.viewer.el);
    vs.viewer.setLabelText((key) => t(`cat.${key}`));
  } else {
    slot.textContent = vs.status === 'failed' ? t('viewer.no_webgl') : t('viewer.loading');
  }
}

/** Пересобирает сцену под новую сборку. */
export async function updateViewer(root, parts) {
  await init();
  attachViewer(root);
  if (!vs.viewer) return;
  const result = await vs.viewer.update(parts);
  if (!result) return; // пришёл более свежий запрос
  const hadDefault = vs.result?.defaultCase;
  vs.result = result;
  const noteEl = $('.viewer-note', root);
  if (noteEl && hadDefault !== result.defaultCase) {
    noteEl.firstChild.textContent = `${result.defaultCase ? t('viewer.default_case') : t(`viewer.hint${vs.mode}`)} `;
  }
}

export function setViewerTheme(theme) {
  vs.viewer?.setTheme(theme);
}

/** `redraw` перерисовывает панель после смены режима/переключателей. */
export function registerViewerActions(redraw) {
  actions['v-mode'] = (el) => {
    vs.mode = el.dataset.mode;
    vs.viewer?.setMode(vs.mode);
    redraw();
  };
  actions['v-glass'] = () => { vs.glass = !vs.glass; vs.viewer?.setGlass(vs.glass); redraw(); };
  actions['v-rotate'] = () => { vs.rotate = !vs.rotate; vs.viewer?.setAutoRotate(vs.rotate); redraw(); };
  actions['v-reset'] = () => vs.viewer?.resetView();
  actions['v-zoom'] = (el) => vs.viewer?.zoomBy(Number(el.dataset.f));
  actions['v-fullscreen'] = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('.viewport')?.requestFullscreen?.();
  };
}

document.addEventListener('themechange', (e) => setViewerTheme(e.detail));
