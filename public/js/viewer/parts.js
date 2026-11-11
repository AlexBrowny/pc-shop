// Расстановка комплектующих в корпусе: плата, процессор, память, видеокарта, охлаждение, накопители, блок питания, кабели.
import * as THREE from 'three';
import {
  box, roundedBox, cylinder, labelPlane, accentOf,
} from './primitives.js';
import { mat, led, finsMap } from './materials.js';
import { ramSlotsUsed, psuDims } from './layout.js';
import { buildBoard } from './board.js';
import { buildGpu } from './gpu.js';
import { buildAirCooler, buildAio } from './cooling.js';

const capText = (gb) => (gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

function cableTube(points, radius = 0.55) {
  const curve = new THREE.CatmullRomCurve3(points);
  const sleeve = new THREE.MeshStandardMaterial({ color: '#0c0d11', roughness: 0.8, metalness: 0.1, bumpMap: finsMap(60), bumpScale: 0.5 });
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 10), sleeve);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCpu({ parts, lay }) {
  const g = new THREE.Group();
  const accent = accentOf(parts.cpu.brand);
  g.add(roundedBox(3.9, 3.9, 0.35, mat.plastic('#1d5a43'), 0.1, [0, 0, 0]));
  g.add(roundedBox(3.2, 3.2, 0.55, mat.steel('#cdd3dd'), 0.18, [0, 0, 0.4]));
  const text = labelPlane(parts.cpu.name.replace(/^Core |^Ryzen /, '').toUpperCase().slice(0, 14), 2.6, 0.5, { fg: '#2a2e37', weight: 700 });
  text.position.z = 0.69;
  g.add(text);
  g.add(box(0.8, 0.1, 0.05, led(accent, { intensity: 1.2 }), [0, -1.3, 0.7]));
  g.position.set(lay.socket[0], lay.socket[1], 1.25);
  return g;
}

/** Модуль памяти: чёрная плата, радиатор со скосом, RGB-диффузор сверху. Толщина — по x, длина — по y, высота — по z. */
export function buildRamStick(ram) {
  const accent = accentOf(ram.brand);
  const g = new THREE.Group();
  g.add(box(0.2, 13.3, 3.4, mat.plastic('#0b0c0f'), [0, 0, 0]));
  const spreaderMat = mat.steel('#6a717f');
  g.add(roundedBox(0.9, 13.0, 3.0, spreaderMat, 0.22, [0, 0, -0.1]));
  g.add(roundedBox(0.92, 12.2, 0.62, new THREE.MeshPhysicalMaterial({ color: '#10131a', metalness: 0.2, roughness: 0.2, transparent: true, opacity: 0.92 }), 0.2, [0, 0, 1.5]));
  g.add(box(0.5, 11.4, 0.3, led(accent, { intensity: 3.2, speed: 1.1 }), [0, 0, 1.52]));
  const name = labelPlane(ram.brand.toUpperCase(), 7, 0.9, { fg: '#eef1f6', italic: true, spacing: 3 });
  name.rotation.y = Math.PI / 2;
  name.rotation.x = Math.PI / 2;
  name.position.set(0.47, 0, -0.1);
  g.add(name);
  return g;
}

function buildRam({ parts, lay }) {
  const ram = parts.ram;
  const slots = ramSlotsUsed(ram.specs.modules, Math.min(parts.motherboard?.specs.ram_slots ?? 4, lay.ramX.length));
  const g = new THREE.Group();
  for (const slot of slots) {
    const stick = buildRamStick(ram);
    stick.position.set(lay.ramX[slot], lay.ramY, 3.0);
    g.add(stick);
  }
  return { object: g, anchor: new THREE.Vector3(lay.ramX[slots[0]], lay.ramY + 7.2, 4.8) };
}

export function buildSataSsd(drive) {
  const g = new THREE.Group();
  g.add(roundedBox(10, 0.9, 7, mat.steel('#8f98a8'), 0.25));
  const label = labelPlane(drive.brand, 5, 1.2, { fg: '#12151c' });
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.47, 0);
  g.add(label);
  return g;
}

export function buildHdd(drive) {
  const g = new THREE.Group();
  g.add(roundedBox(14.7, 2.6, 10.2, mat.steel('#aeb6c4'), 0.3));
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 6.2), new THREE.MeshStandardMaterial({ color: '#e9ecf1', roughness: 0.6 }));
  sticker.rotation.x = -Math.PI / 2;
  sticker.position.set(1.2, 1.31, 0);
  g.add(sticker);
  const label = labelPlane(`${drive.brand} ${capText(drive.specs.capacity_gb)}`, 8.6, 1.6, { fg: '#15181f', italic: true });
  label.rotation.x = -Math.PI / 2;
  label.position.set(1.2, 1.33, 0);
  g.add(label);
  for (const [x, z] of [[-6.4, -4.2], [-6.4, 4.2], [6.4, -4.2], [6.4, 4.2]]) g.add(cylinder(0.35, 0.12, mat.steel('#7c8494'), 'y', [x, 1.32, z], 12));
  return g;
}

function buildPsu({ parts, dims }) {
  const psu = parts.psu;
  const d = psuDims(psu.specs.form_factor);
  const accent = accentOf(psu.brand);
  const g = new THREE.Group();
  g.add(roundedBox(d.x, d.y, d.z, mat.darkMetal('#16181e'), 0.4));
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(d.x * 0.7, d.y * 0.6), mat.mesh('#050608'));
  vent.position.set(-d.x * 0.08, 0, d.z / 2 + 0.02);
  g.add(vent);
  const label = labelPlane(`${psu.brand.toUpperCase()}  ${psu.specs.wattage_w} W`, d.x * 0.62, 1.4, { fg: '#e9edf3', spacing: 2, glow: false });
  label.position.set(-d.x * 0.08, d.y * 0.34, d.z / 2 + 0.03);
  g.add(label);
  g.add(box(d.x * 0.5, 0.15, 0.1, led(accent, { intensity: 1.6 }), [-d.x * 0.08, -d.y * 0.4, d.z / 2 + 0.05]));
  const x = -dims.L / 2 + 1.1 + d.x / 2;
  const y = -dims.H / 2 + 0.5 + d.y / 2 + 0.2;
  const z = -dims.W / 2 + 1.2 + d.z / 2;
  g.position.set(x, y, z);
  return { object: g, anchor: new THREE.Vector3(x, y + d.y / 2, z + d.z / 2), top: new THREE.Vector3(x + d.x / 2, y + d.y / 2 - 1, z) };
}

export async function buildParts(parts, ctx) {
  const items = []; // { key, anchor: Vector3 (мировая), text }
  const root = new THREE.Group();
  const full = { ...ctx, parts };
  const board = new THREE.Group();
  board.position.set(ctx.bp.cx, ctx.bp.cy, ctx.bp.z);
  root.add(board);
  const world = (local) => new THREE.Vector3(...local).add(board.position);
  const label = (p) => `${p.brand} ${p.name}`;

  const mb = buildBoard(full);
  board.add(mb.object);
  if (parts.motherboard) items.push({ key: 'motherboard', text: label(parts.motherboard), anchor: world(mb.anchor.toArray()) });

  if (parts.cpu) {
    const cpu = buildCpu(full);
    board.add(cpu);
    items.push({ key: 'cpu', text: label(parts.cpu), anchor: world(cpu.position.toArray()).add(new THREE.Vector3(0, 0, 0.9)) });
  }
  if (parts.ram) {
    const ram = buildRam(full);
    board.add(ram.object);
    items.push({ key: 'ram', text: parts.ram.name, anchor: world(ram.anchor.toArray()) });
  }
  parts.storage.filter((d) => d.specs.interface === 'M.2').slice(0, 2).forEach((d, i) => {
    const [mx, my] = ctx.lay.m2;
    if (mx + 0.8 + (i ? 9.2 : 0) + 4 > ctx.bp.w / 2) return;
    items.push({ key: 'storage', text: label(d), anchor: world([mx + 0.8, my - i * 2.9, 1.3]) });
  });

  let gpuInfo = null;
  if (parts.gpu) {
    gpuInfo = buildGpu(full);
    root.add(gpuInfo.object);
    items.push({ key: 'gpu', text: label(parts.gpu), anchor: gpuInfo.anchor });
  }
  let psuInfo = null;
  if (parts.psu) {
    psuInfo = buildPsu(full);
    root.add(psuInfo.object);
    items.push({ key: 'psu', text: label(parts.psu), anchor: psuInfo.anchor });
  }
  if (parts.cooler) {
    const cooler = parts.cooler.specs.cooler_type === 'AIO' ? buildAio(full) : buildAirCooler(full);
    root.add(cooler.object);
    items.push({ key: 'cooler', text: label(parts.cooler), anchor: cooler.anchor });
  }

  // Накопители 2.5"/3.5" стоят на шторке БП (в ITX-корпусе места нет)
  if (!ctx.dims.itx) {
    const x0 = ctx.dims.L / 2 - 15.5;
    const bays = parts.storage.filter((d) => d.specs.interface === 'SATA');
    bays.forEach((d, i) => {
      const isHdd = d.specs.storage_type === 'HDD';
      const obj = isHdd ? buildHdd(d) : buildSataSsd(d);
      const h = isHdd ? 2.6 : 0.9;
      const col = Math.floor(i / 4);
      const level = i % 4;
      obj.position.set(x0 - col * 16, ctx.shroudTop + h / 2 + level * 3.1, -ctx.dims.W / 2 + 1.6 + 5.1);
      root.add(obj);
      items.push({ key: 'storage', text: label(d), anchor: obj.position.clone().add(new THREE.Vector3(0, h / 2, 5)) });
    });
  }

  // Кабели: уходят за заднюю стенку через кабельные окна
  const { bp, dims } = ctx;
  if (parts.motherboard && parts.psu) {
    const right = bp.cx + bp.w / 2;
    const y24 = bp.cy + bp.h * 0.2;
    root.add(cableTube([
      new THREE.Vector3(right - 0.9, y24, bp.z + 2.0),
      new THREE.Vector3(right - 0.4, y24 - 0.5, bp.z + 3.4),
      new THREE.Vector3(right + 1.6, y24 - 1.5, bp.z + 2.4),
      new THREE.Vector3(right + 2.1, y24 - 4.5, -dims.W / 2 + 0.2),
    ], 0.9));
  }
  if (parts.cpu && parts.psu) {
    const x8 = bp.cx - bp.w / 2 + 6.2;
    const y8 = bp.cy + bp.h / 2;
    root.add(cableTube([
      new THREE.Vector3(x8, y8 - 0.9, bp.z + 1.8),
      new THREE.Vector3(x8, y8 + 0.1, bp.z + 3.0),
      new THREE.Vector3(x8 + 0.4, dims.H / 2 - 2.4, bp.z + 1.4),
      new THREE.Vector3(x8 + 0.6, dims.H / 2 - 1.8, -dims.W / 2 + 0.2),
    ], 0.55));
  }
  if (gpuInfo && parts.psu) {
    const c = gpuInfo.connector;
    root.add(cableTube([
      c.clone(),
      c.clone().add(new THREE.Vector3(0, 0, 2.2)),
      c.clone().add(new THREE.Vector3(0.6, -3.2, 3.2)),
      new THREE.Vector3(c.x + 1.6, ctx.shroudTop + 0.3, dims.W / 2 - 3.6),
    ], 0.6));
  }
  return { root, items };
}
