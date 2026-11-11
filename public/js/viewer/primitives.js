// Строительные блоки процедурных моделей: коробки, цилиндры, вентиляторы, надписи.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, led, textTexture } from './materials.js';

export const BRAND_COLORS = {
  Intel: '#1c8cff', AMD: '#ff4a3d', NVIDIA: '#76d10f', ASUS: '#27b6ff', MSI: '#ff3b3b', Gigabyte: '#ff8a2a',
  ASRock: '#3d7bff', Kingston: '#e5303a', Corsair: '#ffc933', 'G.Skill': '#ff3b3b', Samsung: '#2f6bff', WD: '#2aa8ee',
  Crucial: '#ff8a1f', Seagate: '#5dc23b', Deepcool: '#19d3c5', 'Cooler Master': '#9a5bff', NZXT: '#b479ff', 'Lian Li': '#d6dae2',
  'Fractal Design': '#9aa3b2', Hyte: '#ff6fb0', Montech: '#ff4f6d', Noctua: '#c98a4b', Arctic: '#2aa3ff', Thermalright: '#ff4a3d',
Seasonic: '#e0b02a', 'be quiet!': '#9aa3b2',
};
export const accentOf = (brand) => BRAND_COLORS[brand] ?? '#ff7a2f';
export const CASE_COLORS = { Black: '#272c38', White: '#e9ecf2', Charcoal: '#454d5f' };

const shadowed = (mesh, cast = true) => {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
};

/** Параллелепипед размером (x, y, z) с центром в (px, py, pz). */
export function box(x, y, z, material, [px, py, pz] = [0, 0, 0]) {
  const mesh = shadowed(new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material));
  mesh.position.set(px, py, pz);
  return mesh;
}

export function roundedBox(x, y, z, material, radius = 0.25, [px, py, pz] = [0, 0, 0]) {
  const r = Math.max(0.01, Math.min(radius, x / 2 - 0.01, y / 2 - 0.01, z / 2 - 0.01));
  const mesh = shadowed(new THREE.Mesh(new RoundedBoxGeometry(x, y, z, 3, r), material));
  mesh.position.set(px, py, pz);
  return mesh;
}

export function cylinder(radius, height, material, axis = 'z', [px, py, pz] = [0, 0, 0], segments = 32) {
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material));
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  mesh.position.set(px, py, pz);
  return mesh;
}

/** Плоская табличка с текстом, смотрит в +z. glow=true — светится (для логотипов с подсветкой). */
export function labelPlane(text, width, height, { fg = '#ffffff', weight = 800, italic = false, spacing = 0, glow = false } = {}) {
  const tex = textTexture(text, { color: fg, weight, aspect: width / height, italic, spacing });
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: !glow, depthWrite: false });
  if (glow) material.color.setScalar(2.2);
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

// ───────── Вентилятор ─────────
const bladeCache = new Map();
function bladesGeometry(count) {
  if (bladeCache.has(count)) return bladeCache.get(count);
  const shape = new THREE.Shape();
  shape.moveTo(0.2, 0.05);
  shape.bezierCurveTo(0.34, -0.28, 0.76, -0.38, 0.97, -0.1);
  shape.bezierCurveTo(0.82, -0.01, 0.56, 0.1, 0.2, 0.15);
  shape.closePath();
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -0.025);
    g.rotateX(0.42); // наклон лопасти
    g.rotateZ((Math.PI * 2 * i) / count);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  bladeCache.set(count, merged);
  return merged;
}

const frameCache = new Map();
function frameGeometry(size) {
  const key = size.toFixed(2);
  if (frameCache.has(key)) return frameCache.get(key);
  const s = size / 2;
  const r = size * 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const hole = new THREE.Path();
  hole.absarc(0, 0, size * 0.47, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 2.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2, curveSegments: 28,
  });
  geo.translate(0, 0, -1.1);
  frameCache.set(key, geo);
  return geo;
}

/**
 * Вентилятор: рамка с круглым отверстием, 9 изогнутых лопастей, ступица и светящееся кольцо.
 * Ось — z группы; крыльчатка помечена userData.spin (рад/с) и вращается в цикле отрисовки.
 */
export function fan(size, bladeColor = '#8a94a8', { frameColor = '#10131a', rgb = null, blades = 9 } = {}) {
  const group = new THREE.Group();
  const frame = shadowed(new THREE.Mesh(frameGeometry(size), mat.plastic(frameColor)));
  group.add(frame);

  const rotor = new THREE.Group();
  rotor.userData.spin = 13 + (size % 3);
  const bladeMesh = shadowed(new THREE.Mesh(bladesGeometry(blades), new THREE.MeshStandardMaterial({
    color: bladeColor, metalness: 0.1, roughness: 0.45, side: THREE.DoubleSide,
  })));
  bladeMesh.scale.setScalar(size * 0.465);
  rotor.add(bladeMesh);
  rotor.add(cylinder(size * 0.105, 1.0, mat.plastic('#0a0b0e'), 'z'));
  const cap = cylinder(size * 0.085, 0.12, mat.darkMetal('#3a3f4b'), 'z', [0, 0, 0.55]);
  rotor.add(cap);
  group.add(rotor);

  if (rgb) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.455, size * 0.011, 8, 64), led(rgb));
    ring.position.z = 1.0;
    group.add(ring);
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(size * 0.115, size * 0.007, 8, 40), led(rgb, { phase: 1 }));
    hubRing.position.z = 0.6;
    group.add(hubRing);
  }
  return group;
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      // общие геометрии/текстуры из кэша пересоздаются на GPU при следующем использовании
      m.dispose?.();
    }
  });
}
