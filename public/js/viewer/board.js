// Материнская плата: печатная плата с текстурой, радиаторы VRM и чипсета, кожух I/O, слоты, разъёмы.
import * as THREE from 'three';
import {
  box, roundedBox, cylinder, labelPlane, accentOf,
} from './primitives.js';
import { mat, led, pcbTexture, finsMap } from './materials.js';

const ghostLine = () => new THREE.LineBasicMaterial({ color: '#7aa2ff', transparent: true, opacity: 0.55 });

function heatsink(w, h, d, accent, { fins = 12, vertical = true } = {}) {
  const g = new THREE.Group();
  const finTexture = finsMap(fins);
  const sinkMat = new THREE.MeshStandardMaterial({
    color: '#4a505c', metalness: 0.9, roughness: 0.38, bumpMap: finTexture, bumpScale: 0.35,
  });
  g.add(roundedBox(w, h, d, sinkMat, 0.25, [0, 0, d / 2]));
  const edge = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 0.14 : w * 0.8, vertical ? h * 0.8 : 0.14, 0.14), led(accent, { intensity: 1.8 }));
  edge.position.set(vertical ? w / 2 - 0.05 : 0, vertical ? 0 : -h / 2 + 0.05, d + 0.02);
  g.add(edge);
  return g;
}

/** Возвращает { object, anchor } в локальных координатах платы (центр платы, z — наружу от стенки). */
export function buildBoard({ bp, lay, parts }) {
  const g = new THREE.Group();
  const mb = parts.motherboard;
  if (!mb) {
    // плата не выбрана — показываем контур, чтобы было понятно, куда встанут остальные детали
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(bp.w, bp.h, 0.2)), ghostLine()));
    return { object: g, anchor: new THREE.Vector3(0, 0, 0) };
  }
  const s = mb.specs;
  const accent = accentOf(mb.brand);
  const itx = bp.h < 20;

  // PCB: основа + плоскость с текстурой дорожек
  g.add(box(bp.w, bp.h, 0.2, mat.plastic('#0e1116'), [0, 0, 0.1]));
  const tex = new THREE.Mesh(new THREE.PlaneGeometry(bp.w - 0.1, bp.h - 0.1), new THREE.MeshStandardMaterial({ map: pcbTexture(accent), roughness: 0.6, metalness: 0.3 }));
  tex.position.z = 0.205;
  tex.receiveShadow = true;
  g.add(tex);

  // Радиаторы VRM
  lay.vrm.forEach(([x, y, w, h], i) => {
    const sink = heatsink(w, h, 2.6, accent, { fins: i === 0 ? 10 : 14, vertical: i === 0 });
    sink.position.set(x, y, 0.2);
    g.add(sink);
  });
  // 8-pin питания процессора
  g.add(box(4.4, 1.4, 1.6, mat.plastic('#0a0b0e'), [-bp.w / 2 + 6.2, bp.h / 2 - 0.9, 1.0]));

  // Кожух задней панели с логотипом производителя
  const ioW = bp.w * 0.15;
  const ioH = bp.h * 0.5;
  const ioX = -bp.w / 2 + ioW / 2 + 0.6;
  const ioY = bp.h / 2 - 1.8 - ioH / 2;
  g.add(roundedBox(ioW, ioH, 3.4, mat.darkMetal('#1a1d24'), 0.35, [ioX, ioY, 1.9]));
  const logo = labelPlane(mb.brand.toUpperCase(), ioH * 0.7, ioW * 0.4, { fg: '#f1f3f7', spacing: 5, glow: true });
  logo.rotation.z = Math.PI / 2;
  logo.position.set(ioX, ioY, 3.62);
  g.add(logo);
  g.add(box(0.18, ioH * 0.8, 0.18, led(accent, { intensity: 2 }), [ioX + ioW / 2 - 0.1, ioY, 3.5]));
  if (s.wifi) {
    for (const k of [-1, 1]) g.add(cylinder(0.35, 1.6, mat.gold(), 'x', [-bp.w / 2 - 0.4, ioY + ioH / 2 - 1.4 + k * 1.0, 1.4], 14));
  }

  // Сокет процессора (рамка с прижимом)
  const [sx, sy] = lay.socket;
  g.add(roundedBox(5.6, 5.6, 0.7, mat.plastic('#101216'), 0.2, [sx, sy, 0.55]));
  g.add(roundedBox(4.6, 4.6, 0.8, mat.steel('#b8bfcb'), 0.12, [sx, sy, 0.65]));
  g.add(box(3.7, 3.7, 0.85, mat.plastic('#15181e'), [sx, sy, 0.68]));

  // Слоты DIMM с защёлками
  const slots = Math.min(s.ram_slots, lay.ramX.length);
  for (let i = 0; i < slots; i += 1) {
    const x = lay.ramX[i];
    g.add(roundedBox(0.52, 13.3, 1.0, mat.plastic(i % 2 ? '#0d0e12' : '#1a1d24'), 0.12, [x, lay.ramY, 0.7]));
    for (const dy of [-1, 1]) g.add(box(0.5, 0.9, 0.5, mat.plastic('#c9ccd3'), [x, lay.ramY + dy * 6.9, 0.9]));
    g.add(box(0.1, 11.5, 0.1, mat.gold(), [x, lay.ramY, 1.22]));
  }

  // PCIe: «броня» для PCIe 5.0 и слоты
  const pcieY = lay.pcieY;
  const gen5 = /5/.test(s.pcie);
  const x16w = 9.6;
  const x16x = -bp.w / 2 + 3 + x16w / 2 + 0.6;
  g.add(roundedBox(x16w, 0.7, 1.0, mat.plastic('#0a0b0e'), 0.12, [x16x, pcieY, 0.7]));
  g.add(box(x16w - 0.8, 0.12, 0.1, mat.gold(), [x16x, pcieY, 1.22]));
  if (gen5) g.add(roundedBox(x16w + 1.0, 1.3, 0.35, mat.steel('#c5cbd6'), 0.2, [x16x, pcieY, 1.35]));
  if (!itx) {
    g.add(roundedBox(4.2, 0.6, 0.9, mat.plastic('#0a0b0e'), 0.1, [x16x - 2.7, pcieY - 5.4, 0.65]));
    g.add(roundedBox(4.2, 0.6, 0.9, mat.plastic('#0a0b0e'), 0.1, [x16x - 2.7, pcieY - 9.3, 0.65]));
  }

  // M.2 с радиаторами
  const m2 = Math.min(Math.max(s.m2_slots, 1), itx ? 1 : 3);
  const [mx, my] = lay.m2;
  for (let i = 0; i < m2; i += 1) {
    const plate = roundedBox(8.4, 2.5, 0.5, mat.darkMetal('#2b303a'), 0.2, [mx + 0.8, my - i * 2.9 + (itx ? 0 : 0.2), 0.95]);
    g.add(plate);
    g.add(box(7.4, 0.14, 0.14, led(accent, { intensity: 1.6, phase: i }), [mx + 0.8, my - i * 2.9 + 1.0, 1.25]));
  }

  // Радиатор чипсета с названием
  const [cx, cy] = lay.chipset;
  g.add(roundedBox(5.4, 5.4, 1.1, new THREE.MeshStandardMaterial({ color: '#3b414d', metalness: 0.9, roughness: 0.36, bumpMap: finsMap(10), bumpScale: 0.3 }), 0.3, [cx, cy, 0.75]));
  const chipText = labelPlane(s.chipset, 4.4, 1.3, { fg: accent, glow: true, spacing: 1 });
  chipText.position.set(cx, cy, 1.34);
  g.add(chipText);

  // 24-pin, SATA, батарейка, винты
  g.add(roundedBox(1.3, 5.2, 1.7, mat.plastic('#d9dce2'), 0.12, [bp.w / 2 - 0.9, bp.h * 0.2, 1.05]));
  for (let i = 0; i < 12; i += 1) g.add(box(0.5, 0.28, 0.1, mat.plastic('#2a2d33'), [bp.w / 2 - 0.9, bp.h * 0.2 - 2.2 + i * 0.4, 1.93]));
  const sata = Math.min(Math.max(s.sata_ports, 2), 6);
  for (let i = 0; i < sata; i += 1) {
    g.add(roundedBox(1.0, 1.9, 0.9, mat.plastic('#0a0b0e'), 0.1, [bp.w / 2 - 1.2 - (i % 2) * 1.2, -bp.h * 0.18 - Math.floor(i / 2) * 2.1, 0.65]));
  }
  g.add(cylinder(1.0, 0.35, mat.steel('#c9ced8'), 'z', [bp.w * 0.05, -bp.h * 0.34, 0.4], 28));
  for (const [x, y] of [[-0.46, 0.46], [0.46, 0.46], [-0.46, -0.46], [0.46, -0.46], [0.1, 0.1]]) {
    g.add(cylinder(0.28, 0.16, mat.steel('#9aa3b2'), 'z', [x * bp.w, y * bp.h, 0.28], 12));
  }

  return { object: g, anchor: new THREE.Vector3(0, bp.h / 2 - 1, 1.5) };
}
