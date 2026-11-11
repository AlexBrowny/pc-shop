// 3D/2D-просмотрщик сборки на three.js: сцена, камеры, подписи, смена темы.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { caseDims, boardPlacement, boardLayout, formFactorOf } from './layout.js';
import { buildCase } from './case-model.js';
import { buildParts } from './parts.js';
import { disposeTree } from './primitives.js';
import { clearLeds, tickLeds } from './materials.js';

const LABEL_GAP = 4;
const THEME_LOOK = {
  dark: { envIntensity: 0.75, light: 1.9, hemi: 0.55, shadow: 0.6, bloom: 0.55, bg: ['#1c202b', '#090a0e'], grid: 0.16 },
  light: { envIntensity: 0.85, light: 2.4, hemi: 0.7, shadow: 0.25, bloom: 0.32, bg: ['#f3f5f9', '#c9cfdb'], grid: 0.1 },
};

/** Фон сцены: радиальный градиент в цвет темы (холст непрозрачный, чтобы постобработка не портила альфу). */
function backgroundTexture([inner, outer]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 210, 20, 256, 256, 380);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createViewer() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null; // WebGL недоступен
  }

  const el = document.createElement('div');
  el.className = 'viewer';
  const labelLayer = document.createElement('div');
  labelLayer.className = 'viewer-labels';
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'viewer-lines');
  el.append(renderer.domElement, lines, labelLayer);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.set(40, 70, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 });
  sun.shadow.bias = -0.0004;
  // Заполняющий свет «из камеры»: в режиме 2D иначе внутренности корпуса остаются тёмными
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(10, 15, 100);
  const hemi = new THREE.HemisphereLight('#cfe0ff', '#3a3f4d', 0.3);
  scene.add(sun, fill, hemi);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShadowMaterial({ opacity: 0.4 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(320, 64, '#ff7a2f', '#ff7a2f');
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  grid.material.depthWrite = false;
  scene.add(grid);

  const persp = new THREE.PerspectiveCamera(28, 1, 1, 900);
  const ortho = new THREE.OrthographicCamera(-50, 50, 50, -50, 1, 800);
  let camera = persp;
  let controls = null;

  // Постобработка: рендер в MSAA-буфер, свечение (bloom) для RGB-подсветки, тон-маппинг
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 1.25);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const state = {
    mode: '3d', glass: true, autoRotate: false, theme: 'dark', fitKey: '', dims: caseDims(null),
    group: null, glassMesh: null, userMoved: false, spinners: [], items: [], buildToken: 0, labelText: (key) => key, parts: null,
  };
  let size = { w: 1, h: 1 };

  function makeControls() {
    controls?.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minDistance = 20;
    controls.maxDistance = 260;
    controls.target.set(0, 0, 0);
    controls.autoRotate = state.autoRotate && state.mode === '3d';
    controls.autoRotateSpeed = 1.6;
    if (state.mode === '2d') {
      controls.enableRotate = false;
      controls.screenSpacePanning = true;
    }
    controls.addEventListener('start', () => { state.userMoved = true; });
    controls.update();
  }

  function frame() {
    state.userMoved = false;
    const { L, H } = state.dims;
    // 3D: перспектива спереди-сбоку
    const tanHalf = Math.tan((persp.fov * Math.PI) / 360);
    const aspect0 = size.w / size.h;
    const dist = Math.max(H / (2 * tanHalf), (L * 1.25) / (2 * tanHalf * aspect0)) * 1.3;
    persp.position.set(Math.sin(0.52) * dist, dist * 0.22, Math.cos(0.52) * dist);
    persp.lookAt(0, 0, 0);
    // 2D: ортогональный вид сбоку
    const aspect = aspect0;
    const half = Math.max(H * 0.62, (L * 0.62) / aspect);
    Object.assign(ortho, { left: -half * aspect, right: half * aspect, top: half, bottom: -half, zoom: 1 });
    ortho.position.set(0, 0, 200);
    ortho.lookAt(0, 0, 0);
    ortho.updateProjectionMatrix();
    ground.position.y = -state.dims.H / 2 - 1.2;
    grid.position.y = ground.position.y + 0.02;
    makeControls();
  }

  function applyMode(recreateControls = true) {
    const is3d = state.mode === '3d';
    camera = is3d ? persp : ortho;
    renderPass.camera = camera;
    grid.visible = is3d;
    if (state.glassMesh) state.glassMesh.visible = is3d && state.glass;
    ground.visible = is3d;
    fill.intensity = is3d ? 0.5 : 2.4;
    labelLayer.style.display = is3d ? 'none' : 'block';
    lines.style.display = is3d ? 'none' : 'block';
    el.dataset.mode = state.mode;
    if (recreateControls) makeControls();
  }

  function applyTheme() {
    const look = THEME_LOOK[state.theme];
    scene.environmentIntensity = look.envIntensity;
    sun.intensity = look.light;
    hemi.intensity = look.hemi;
    ground.material.opacity = look.shadow;
    bloom.strength = look.bloom;
    grid.material.opacity = look.grid;
    scene.background?.dispose();
    scene.background = backgroundTexture(look.bg);
  }

  function resize() {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    if (w === size.w && h === size.h) return;
    size = { w, h };
    renderer.setSize(w, h);
    composer.setSize(w, h);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    const half = ortho.top;
    ortho.left = -half * (w / h);
    ortho.right = half * (w / h);
    ortho.updateProjectionMatrix();
    lines.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (!state.userMoved) frame();
  }
  new ResizeObserver(resize).observe(el);

  // ───────── Подписи в режиме 2D ─────────
  const labelNodes = new Map();
  function syncLabelNodes() {
    for (const node of labelNodes.values()) node.remove();
    labelNodes.clear();
    state.items.forEach((item, i) => {
      const node = document.createElement('div');
      node.className = 'viewer-label';
      labelLayer.appendChild(node);
      labelNodes.set(i, node);
    });
    refreshLabelText();
  }
  function refreshLabelText() {
    state.items.forEach((item, i) => {
      const node = labelNodes.get(i);
      if (!node) return;
      node.innerHTML = '';
      const cat = document.createElement('b');
      cat.textContent = state.labelText(item.key);
      const name = document.createElement('span');
      name.textContent = item.text;
      node.append(cat, name);
    });
  }

  const tmp = new THREE.Vector3();
  function layoutLabels() {
    const placed = state.items.map((item, i) => {
      tmp.copy(item.anchor).project(camera);
      return { i, x: (tmp.x * 0.5 + 0.5) * size.w, y: (-tmp.y * 0.5 + 0.5) * size.h };
    });
    const sides = { left: [], right: [] };
    for (const p of placed) (p.x < size.w / 2 ? sides.left : sides.right).push(p);
    let svg = '';
    for (const [side, list] of Object.entries(sides)) {
      list.sort((a, b) => a.y - b.y);
      let bottom = 4;
      for (const p of list) {
        p.h = labelNodes.get(p.i).offsetHeight || 30;
        p.ly = Math.max(p.y, bottom + p.h / 2);
        bottom = p.ly + p.h / 2 + LABEL_GAP;
      }
      const overflow = bottom - LABEL_GAP - (size.h - 4);
      if (overflow > 0) list.forEach((p) => { p.ly -= overflow; });
      for (const p of list) {
        const node = labelNodes.get(p.i);
        node.style.top = `${p.ly - p.h / 2}px`;
        node.style[side] = '6px';
        node.style[side === 'left' ? 'right' : 'left'] = 'auto';
        const edgeX = side === 'left' ? node.offsetWidth + 6 : size.w - node.offsetWidth - 6;
        svg += `<line x1="${edgeX}" y1="${p.ly}" x2="${p.x}" y2="${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="3"/>`;
      }
    }
    lines.innerHTML = svg;
  }

  // ───────── Цикл отрисовки ─────────
  const clock = new THREE.Clock();
  let disposed = false;
  function tick() {
    if (disposed) return;
    requestAnimationFrame(tick);
    if (!el.isConnected || document.hidden) return;
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    for (const rotor of state.spinners) rotor.rotation.z += rotor.userData.spin * dt;
    tickLeds(clock.elapsedTime);
    controls?.update();
    composer.render();
    if (state.mode === '2d') layoutLabels();
  }
  requestAnimationFrame(tick);

  // ───────── Публичный API ─────────
  async function update(parts) {
    const token = ++state.buildToken;
    state.parts = parts;
    clearLeds();
    const caseSpec = parts.case?.specs ?? null;
    const dims = caseDims(caseSpec);
    const ff = formFactorOf(parts.motherboard?.specs, caseSpec);
    const bp = boardPlacement(dims, ff);
    const lay = boardLayout(ff);
    const aio = parts.cooler?.specs.cooler_type === 'AIO';
    const built = buildCase(dims, parts.case, {
      hasFrontRadiator: aio, psuFormFactor: parts.psu?.specs.form_factor ?? (dims.itx ? 'SFX' : 'ATX'), bp, lay,
    });
    const { root, items } = await buildParts(parts, { dims, bp, lay, shroudTop: built.shroudTop });
    if (token !== state.buildToken) { disposeTree(root); disposeTree(built.group); return null; }

    const group = new THREE.Group();
    group.add(built.group, root);
    if (state.group) { scene.remove(state.group); disposeTree(state.group); }
    state.group = group;
    state.glassMesh = built.glass;
    state.items = items;
    state.spinners = [];
    group.traverse((o) => { if (o.userData.spin) state.spinners.push(o); });
    scene.add(group);
    syncLabelNodes();

    const key = `${dims.L}|${dims.H}|${dims.W}`;
    state.dims = dims;
    if (key !== state.fitKey) { state.fitKey = key; frame(); }
    applyMode(false);
    return { defaultCase: !parts.case, ghostBoard: !parts.motherboard };
  }

  applyTheme();
  frame();
  applyMode();

  /** Приблизить/отдалить: factor > 1 приближает. */
  function zoomBy(factor) {
    if (state.mode === '2d') {
      ortho.zoom = Math.max(0.4, Math.min(8, ortho.zoom * factor));
      ortho.updateProjectionMatrix();
      return;
    }
    const offset = persp.position.clone().sub(controls.target);
    const next = Math.max(controls.minDistance, Math.min(controls.maxDistance, offset.length() / factor));
    persp.position.copy(controls.target).add(offset.setLength(next));
    state.userMoved = true;
  }

  function dispose() {
    disposed = true;
    controls?.dispose();
    if (state.group) disposeTree(state.group);
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    el.remove();
  }

  return {
    el,
    update,
    zoomBy,
    dispose,
    setMode(mode) { state.mode = mode === '2d' ? '2d' : '3d'; applyMode(); },
    getMode: () => state.mode,
    setGlass(on) { state.glass = on; if (state.glassMesh) state.glassMesh.visible = state.mode === '3d' && on; },
    setAutoRotate(on) { state.autoRotate = on; if (controls) controls.autoRotate = on && state.mode === '3d'; },
    resetView() { frame(); applyMode(); },
    setTheme(theme) { state.theme = theme === 'light' ? 'light' : 'dark'; applyTheme(); },
    setLabelText(fn) { state.labelText = fn; refreshLabelText(); },
    isGlassOn: () => state.glass,
    isAutoRotating: () => state.autoRotate,
  };
}
