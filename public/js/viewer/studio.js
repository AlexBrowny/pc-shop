// Студия для рендеров товаров: белый фон, мягкий свет, контактная тень. Из моделей конструктора собирает «предметную съёмку»
// каждого товара (видеокарта, процессор, плата, память, накопитель, блок питания, корпус, охлаждение) и отдаёт JPEG.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  caseDims, boardPlacement, boardLayout, psuDims, RADIATOR_LENGTH_CM,
} from './layout.js';
import { buildCase } from './case-model.js';
import { buildBoard } from './board.js';
import { buildGpu } from './gpu.js';
import { buildAirCooler } from './cooling.js';
import {
  buildCpu, buildRamStick, buildSataSsd, buildHdd,
} from './parts.js';
import {
  box, roundedBox, cylinder, fan, labelPlane, accentOf, disposeTree,
} from './primitives.js';
import {
  mat, led, finsMap, clearLeds,
} from './materials.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const capText = (gb) => (gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

// ───────── Сцены по категориям: возвращают { object, az, el } ─────────
function gpuScene(p) {
  const dims = caseDims(null);
  const bp = boardPlacement(dims, 'ATX');
  const { object } = buildGpu({ parts: { gpu: p }, dims, bp, lay: boardLayout('ATX') });
  object.position.set(0, 0, 0);
  const g = new THREE.Group();
  object.rotation.x = -Math.PI / 2; // вентиляторы смотрят на камеру
  g.add(object);
  return { object: g, az: 24, el: 16 };
}

function cpuScene(p) {
  const g = new THREE.Group();
  const accent = accentOf(p.brand);
  const chip = new THREE.Group();
  chip.add(roundedBox(3.9, 3.9, 0.2, mat.plastic('#1d5a43'), 0.12));
  chip.add(roundedBox(3.2, 3.2, 0.34, mat.steel('#d3d8e1'), 0.2, [0, 0, 0.27]));
  const model = p.name.toUpperCase();
  const text = labelPlane(model, 2.8, 0.5, { fg: '#2a2e37', weight: 700 });
  text.position.set(0, -0.2, 0.45);
  chip.add(text);
  const brandText = labelPlane(p.brand.toUpperCase(), 2.2, 0.5, { fg: '#566070', weight: 800, spacing: 4 });
  brandText.position.set(0, 0.55, 0.45);
  chip.add(brandText);
  chip.add(box(0.9, 0.08, 0.04, led(accent, { intensity: 1 }), [0, -0.95, 0.45]));
  chip.rotation.set(-1.0, 0, 0.35);
  chip.position.set(-1.6, 0, 0);
  g.add(chip);

  // обратная сторона: контакты (площадки LGA или штырьки PGA для AM4)
  const back = new THREE.Group();
  back.add(roundedBox(3.9, 3.9, 0.2, mat.plastic('#1d5a43'), 0.12));
  const gold = mat.gold();
  if (p.specs.socket === 'AM4') {
    const pins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 6), gold, 39 * 39);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = 0; x < 39; x += 1) {
      for (let y = 0; y < 39; y += 1) {
        const skip = x > 11 && x < 27 && y > 11 && y < 27;
        if (skip) m.makeScale(0, 0, 0);
        else m.makeRotationX(Math.PI / 2).setPosition(-1.7 + x * 0.0895, -1.7 + y * 0.0895, -0.2);
        pins.setMatrixAt(i, m);
        i += 1;
      }
    }
    back.add(pins);
  } else {
    const lands = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.075, 0.03), gold, 40 * 40);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = 0; x < 40; x += 1) {
      for (let y = 0; y < 40; y += 1) {
        const skip = x > 13 && x < 26 && y > 13 && y < 26;
        if (skip) m.makeScale(0, 0, 0);
        else m.makeTranslation(-1.75 + x * 0.0895, -1.75 + y * 0.0895, -0.115);
        lands.setMatrixAt(i, m);
        i += 1;
      }
    }
    back.add(lands);
  }
  back.rotation.set(-1.0, 0, -0.3);
  back.rotateY(Math.PI); // повёрнут контактами к камере
  back.position.set(2.7, 0.05, -0.8);
  g.add(back);
  g.scale.setScalar(1.6);
  return { object: g, az: 0, el: 14 };
}

function boardScene(p) {
  const ff = p.specs.form_factor;
  const dims = ff === 'ITX' ? caseDims({ form_factors: ['ITX'], max_gpu_mm: 330, max_cooler_mm: 130 }) : caseDims(null);
  const { object } = buildBoard({ bp: boardPlacement(dims, ff), lay: boardLayout(ff), parts: { motherboard: p } });
  const g = new THREE.Group();
  object.rotation.x = -1.05;
  g.add(object);
  return { object: g, az: 10, el: 14 };
}

function ramScene(p) {
  const g = new THREE.Group();
  const count = Math.min(p.specs.modules, 2);
  for (let i = 0; i < count; i += 1) {
    const stick = buildRamStick(p);
    // длинная сторона — по горизонтали, широкая грань к камере, RGB-диффузор сверху
    stick.applyMatrix4(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0)));
    stick.position.set(0, 0, -i * 2.1);
    stick.rotation.y = 0;
    g.add(stick);
  }
  // в тёмном корпусе радиатор выглядит тёмным, на белом фоне студии нужен светлее
  g.traverse((o) => {
    if (o.isMesh && o.material?.color && o.material.color.getHexString() === '6a717f') o.material.color.set('#c3cad6');
  });
  return { object: g, az: 26, el: 30 };
}

function m2Scene(p) {
  const g = new THREE.Group();
  const accent = accentOf(p.brand);
  const heatsink = /990 PRO|SN850X/i.test(p.name);
  g.add(roundedBox(8.0, 2.25, 0.14, mat.plastic('#14171c'), 0.05));
  // золотые контакты
  g.add(box(0.9, 1.9, 0.02, mat.gold(), [-3.7, 0, 0.08]));
  g.add(box(0.9, 1.9, 0.02, mat.gold(), [-3.7, 0, -0.08]));
  if (heatsink) {
    const sinkMat = new THREE.MeshStandardMaterial({ color: '#3b414d', metalness: 0.9, roughness: 0.36, bumpMap: finsMap(12), bumpScale: 0.4 });
    g.add(roundedBox(6.6, 2.1, 0.5, sinkMat, 0.12, [0.5, 0, 0.32]));
    g.add(box(5.4, 0.08, 0.04, led(accent, { intensity: 2 }), [0.5, 0.8, 0.6]));
    const label = labelPlane(`${p.brand.toUpperCase()} ${p.name.replace(/^WD /, '').replace(/ \d+(GB|TB)$/, '').toUpperCase()}`, 5.2, 0.9, { fg: '#eef1f6', italic: true, spacing: 2 });
    label.position.set(0.5, -0.1, 0.6);
    g.add(label);
  } else {
    g.add(roundedBox(2.0, 1.7, 0.1, mat.plastic('#0b0c0f'), 0.05, [2.2, 0, 0.12]));
    g.add(roundedBox(1.7, 1.5, 0.1, mat.plastic('#0b0c0f'), 0.05, [0.2, 0, 0.12]));
    g.add(roundedBox(1.0, 0.9, 0.1, mat.darkMetal('#2a2e36'), 0.04, [-1.8, 0, 0.12]));
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.9), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }));
    sticker.position.set(-2.1, 0, 0.075);
    g.add(sticker);
    const text = labelPlane(`${p.brand.toUpperCase()} ${p.name.replace(`${p.brand} `, '')}`.slice(0, 18), 2.7, 0.55, { fg: '#ffffff', spacing: 1 });
    text.position.set(-2.1, 0.1, 0.09);
    g.add(text);
    const cap = labelPlane(capText(p.specs.capacity_gb), 1.4, 0.45, { fg: '#ffffff', spacing: 2 });
    cap.position.set(-2.1, -0.55, 0.09);
    g.add(cap);
  }
  g.rotation.set(-0.95, 0, 0.0);
  g.scale.setScalar(1.5);
  return { object: g, az: -14, el: 18 };
}

function sataScene(p) {
  const object = p.specs.storage_type === 'HDD' ? buildHdd(p) : buildSataSsd(p);
  const g = new THREE.Group();
  g.add(object);
  g.rotation.set(0, 0.45, 0);
  return { object: g, az: 0, el: 30 };
}

function psuScene(p) {
  const d = psuDims(p.specs.form_factor);
  const accent = accentOf(p.brand);
  const g = new THREE.Group();
  g.add(roundedBox(d.x, d.y, d.z, mat.darkMetal('#1a1d24'), 0.45));
  // решётка вентилятора на передней грани
  const fx = -d.x * 0.17;
  g.add(cylinder(d.y * 0.44, 0.14, mat.plastic('#0a0b0e'), 'z', [fx, 0, d.z / 2 + 0.05], 48));
  const f = fan(d.y * 0.78, '#9aa3b4', { frameColor: '#0d0f14' });
  f.scale.set(1, 1, 0.14);
  f.position.set(fx, 0, d.z / 2 + 0.2);
  g.add(f);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(d.y * 0.44, 0.07, 10, 64), mat.steel('#c9cfda'));
  ring.position.set(fx, 0, d.z / 2 + 0.12);
  g.add(ring);
  const spokes = new THREE.Mesh(new THREE.TorusGeometry(d.y * 0.3, 0.035, 8, 48), mat.steel('#c9cfda'));
  spokes.position.set(fx, 0, d.z / 2 + 0.62);
  g.add(spokes);
  // этикетка на верхней грани
  const top = labelPlane(`${p.brand.toUpperCase()}  ${p.specs.wattage_w} W`, d.x * 0.7, d.z * 0.16, { fg: '#e9edf3', spacing: 3 });
  top.rotation.x = -Math.PI / 2;
  top.position.set(0, d.y / 2 + 0.03, d.z * 0.12);
  g.add(top);
  const cert = labelPlane(String(p.specs.efficiency).toUpperCase(), d.x * 0.5, d.z * 0.1, { fg: accent, spacing: 3 });
  cert.rotation.x = -Math.PI / 2;
  cert.position.set(0, d.y / 2 + 0.03, -d.z * 0.1);
  g.add(cert);
  g.add(box(d.x * 0.3, 0.12, 0.08, led(accent, { intensity: 1.6 }), [d.x * 0.3, -d.y * 0.38, d.z / 2 + 0.05]));
  // пучок кабелей сзади (виден под углом)
  g.rotation.y = 0.0;
  return { object: g, az: 34, el: 22 };
}

function caseScene(p) {
  const dims = caseDims(p.specs);
  const ff = dims.itx ? 'ITX' : 'ATX';
  const built = buildCase(dims, p, {
    hasFrontRadiator: false, psuFormFactor: dims.itx ? 'SFX' : 'ATX', bp: boardPlacement(dims, ff), lay: boardLayout(ff),
  });
  return { object: built.group, az: 40, el: 11 };
}

function airCoolerScene(p) {
  const { object } = buildAirCooler({ parts: { cooler: p }, lay: { socket: [0, 0] }, bp: { cx: 0, cy: 0, z: 0 } });
  object.position.set(0, 0, 0);
  const g = new THREE.Group();
  object.rotation.x = -Math.PI / 2; // башня стоит вертикально
  g.add(object);
  return { object: g, az: 38, el: 14 };
}

function aioScene(p) {
  const accent = accentOf(p.brand);
  const size = p.specs.radiator_mm;
  const len = RADIATOR_LENGTH_CM[size] ?? 27.5;
  const g = new THREE.Group();
  const radMat = new THREE.MeshStandardMaterial({ color: '#17191f', metalness: 0.7, roughness: 0.5, bumpMap: finsMap(24), bumpScale: 0.2 });
  g.add(roundedBox(len, 12.4, 2.7, radMat, 0.35));
  const count = Math.round(size / (size === 280 ? 140 : 120));
  const fanSize = size === 280 ? 14 : 12;
  for (let i = 0; i < count; i += 1) {
    const f = fan(fanSize, '#a7afbf', { rgb: accent });
    f.position.set(-len / 2 + (len / count) * (i + 0.5), 0, 1.35 + 1.1);
    g.add(f);
  }
  // помпа с зеркалом и светящимся кольцом
  const pump = new THREE.Group();
  pump.add(cylinder(3.9, 3.4, mat.darkMetal('#13151b'), 'z', [0, 0, 0], 48));
  pump.add(cylinder(3.3, 0.1, new THREE.MeshStandardMaterial({ color: '#06070a', metalness: 1, roughness: 0.12 }), 'z', [0, 0, 1.75], 48));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.14, 12, 64), led(accent, { intensity: 2.6 }));
  ring.position.z = 1.78;
  pump.add(ring);
  const logo = labelPlane(p.brand.toUpperCase().slice(0, 9), 4.8, 0.9, { fg: '#f2f4f8', spacing: 3, glow: true });
  logo.position.z = 1.83;
  pump.add(logo);
  pump.position.set(len / 2 + 9.5, -1.5, 0);
  g.add(pump);
  // две оплётные трубки от помпы к торцу радиатора
  const braid = new THREE.MeshStandardMaterial({ color: '#16181e', roughness: 0.75, metalness: 0.15, bumpMap: finsMap(40), bumpScale: 0.6 });
  for (const dy of [-1, 1]) {
    const start = V(len / 2 + 6.2, -1.5 + dy * 1.4, -0.4 + dy * 0.2);
    const end = V(len / 2 + 0.3, dy * 3.6, 0);
    const curve = new THREE.CatmullRomCurve3([start, V(len / 2 + 4.6, start.y + dy * 1.6, 0.2), V(len / 2 + 2.2, end.y + dy * 0.2, 0.1), end]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.52, 10), braid));
  }
  return { object: g, az: 18, el: 24 };
}

const SCENES = {
  gpu: gpuScene,
  cpu: cpuScene,
  motherboard: boardScene,
  ram: ramScene,
  psu: psuScene,
  case: caseScene,
  cooler: (p) => (p.specs.cooler_type === 'AIO' ? aioScene(p) : airCoolerScene(p)),
  storage: (p) => (p.specs.interface === 'M.2' ? m2Scene(p) : sataScene(p)),
};

// ───────── Съёмка ─────────
const SS = 2; // рендерим в 2× и уменьшаем — гладкие края без «лесенки»

export function createStudio({ width = 1200, height = 900 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width * SS, height * SS, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const camera = new THREE.PerspectiveCamera(26, width / height, 0.5, 2000);

  /** Подбирает расстояние до камеры так, чтобы предмет занимал ~80% кадра. */
  function fit(box3, az, el) {
    const center = box3.getCenter(new THREE.Vector3());
    const dir = V(Math.sin((az * Math.PI) / 180) * Math.cos((el * Math.PI) / 180), Math.sin((el * Math.PI) / 180), Math.cos((az * Math.PI) / 180) * Math.cos((el * Math.PI) / 180));
    const corners = [];
    for (const x of [box3.min.x, box3.max.x]) for (const y of [box3.min.y, box3.max.y]) for (const z of [box3.min.z, box3.max.z]) corners.push(V(x, y, z));
    let dist = box3.getSize(new THREE.Vector3()).length() * 2;
    for (let i = 0; i < 12; i += 1) {
      camera.position.copy(center).addScaledVector(dir, dist);
      camera.lookAt(center);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      const worst = Math.max(...corners.map((c) => {
        const n = c.clone().project(camera);
        return Math.max(Math.abs(n.x), Math.abs(n.y));
      }));
      dist *= worst / 0.8;
    }
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    return { center, dist };
  }

  function contactShadow(box3) {
    const size = box3.getSize(new THREE.Vector3());
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
    gr.addColorStop(0, 'rgba(20,24,34,0.42)');
    gr.addColorStop(0.55, 'rgba(20,24,34,0.16)');
    gr.addColorStop(1, 'rgba(20,24,34,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(size.x, size.z) * 1.5, Math.max(size.x, size.z) * 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set((box3.min.x + box3.max.x) / 2, box3.min.y - 0.02, (box3.min.z + box3.max.z) / 2);
    return plane;
  }

  async function render(product, { quality = 0.92 } = {}) {
    const build = SCENES[product.category];
    if (!build) throw new Error(`Нет сцены для категории ${product.category}`);
    clearLeds();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    scene.environment = envMap;
    scene.environmentIntensity = 0.95;

    const { object, az, el } = build(product);
    scene.add(object);
    object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // предмет ставим на «стол» и центрируем
    let box3 = new THREE.Box3().setFromObject(object);
    object.position.x -= (box3.min.x + box3.max.x) / 2;
    object.position.z -= (box3.min.z + box3.max.z) / 2;
    object.position.y -= box3.min.y;
    box3 = new THREE.Box3().setFromObject(object);

    const size = box3.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    const key = new THREE.DirectionalLight('#ffffff', 2.1);
    key.position.set(-span * 0.9, span * 1.8, span * 1.1).add(box3.getCenter(new THREE.Vector3()));
    key.target.position.copy(box3.getCenter(new THREE.Vector3()));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 7;
    key.shadow.bias = -0.0004;
    const half = span * 1.3;
    Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.1, far: span * 6 });
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.9);
    rim.position.set(span * 1.2, span * 0.8, -span * 1.4);
    scene.add(key, key.target, rim, new THREE.HemisphereLight('#ffffff', '#c9ced8', 0.55));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(span * 12, span * 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground, contactShadow(box3));

    fit(box3, az, el);
    renderer.render(scene, camera);

    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(renderer.domElement, 0, 0, width, height);
    disposeTree(scene);
    return new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', quality));
  }

  return { render, canvas: out, dispose: () => { pmrem.dispose(); renderer.dispose(); } };
}
