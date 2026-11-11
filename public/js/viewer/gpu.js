// Видеокарта: кожух, скошенная задняя панель с логотипом, силовой разъём, вентиляторы снизу, планка с портами.
import * as THREE from 'three';
import {
  box, roundedBox, fan, labelPlane, accentOf,
} from './primitives.js';
import { mat, led } from './materials.js';
import { gpuThickness } from './layout.js';

const SERIES = { NVIDIA: 'GEFORCE RTX', AMD: 'RADEON', Intel: 'ARC' };
const shortName = (p) => p.name.replace(/\s*\d+\s?GB.*$/i, '').replace(/^GeForce |^Radeon /, '');

export function buildGpu({ parts, dims, bp, lay }) {
  const gpu = parts.gpu;
  const s = gpu.specs;
  const accent = accentOf(gpu.brand);
  const len = s.length_mm / 10;
  const T = gpuThickness(s.power_w);
  const D = Math.min(11.5, dims.W - 1.1 - 1.2 - 1.5 - 0.9);
  const g = new THREE.Group();

  // Кожух и «подложка» (бэкплейт) сверху
  g.add(roundedBox(len, T - 0.5, D, mat.darkMetal('#181b22'), 0.45));
  g.add(roundedBox(len - 0.8, 0.28, D - 0.6, mat.steel('#2c3039'), 0.12, [0.1, T / 2 - 0.1, 0]));
  // Скошенные акценты на бэкплейте
  const slash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, D * 0.7), led(accent, { intensity: 1.7 }));
  slash.position.set(len * 0.18, T / 2 + 0.07, 0);
  slash.rotation.y = 0.5;
  g.add(slash);
  const badge = labelPlane(shortName(gpu).toUpperCase(), Math.min(len * 0.55, 13), 1.6, { fg: '#f2f4f8', italic: true, spacing: 2 });
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(-len * 0.12, T / 2 + 0.06, 0);
  g.add(badge);

  // Торец, обращённый к стеклу: светящаяся полоса, логотип серии, силовой разъём
  const end = D / 2;
  g.add(box(len - 1.4, 0.2, 0.18, led(accent, { intensity: 2.6, speed: 0.9 }), [0, T / 2 - 0.7, end + 0.05]));
  const series = labelPlane(SERIES[gpu.brand] ?? gpu.brand.toUpperCase(), 9, 1.1, { fg: '#ffffff', spacing: 5, glow: true });
  series.position.set(-len * 0.2, -0.4, end + 0.04);
  g.add(series);
  const sixteen = s.connector.includes('16');
  g.add(roundedBox(sixteen ? 2.4 : 4.2, 1.7, 0.9, mat.plastic('#07080a'), 0.12, [len / 2 - 3.4, 0.3, end + 0.35]));
  g.add(box(sixteen ? 1.9 : 3.6, 0.5, 0.2, mat.plastic('#e6e8ec'), [len / 2 - 3.4, 0.3, end + 0.82]));

  // Вентиляторы смотрят вниз
  const count = len > 28.5 ? 3 : 2;
  const fanSize = Math.min(D - 1, (len - 2) / count);
  for (let i = 0; i < count; i += 1) {
    const f = fan(fanSize, '#aeb5c4', { rgb: accent, blades: 11 });
    f.rotation.x = Math.PI / 2;
    f.position.set(-len / 2 + (len / count) * (i + 0.5) + 0.3, -(T - 0.5) / 2 - 0.2, 0);
    g.add(f);
  }
  // Планка с портами и золотые контакты PCIe
  g.add(roundedBox(0.22, T + 0.5, D + 0.4, mat.steel('#c5cbd6'), 0.1, [-len / 2 - 0.12, 0, 0.1]));
  for (let i = 0; i < 4; i += 1) g.add(box(0.3, 0.7, 1.7, mat.plastic('#050608'), [-len / 2 - 0.2, -T * 0.32 + i * 0.9, 3.5 - (i === 3 ? 0.6 : 0)]));
  g.add(box(9, 0.14, 0.9, mat.gold(), [-len / 2 + 6, -T / 2 + 0.2, -D / 2 + 0.6]));

  const xs = -dims.L / 2 + 1.1;
  const world = [xs + len / 2, bp.cy + lay.pcieY, bp.z + 0.9 + D / 2];
  g.position.set(...world);
  return {
    object: g,
    anchor: new THREE.Vector3(world[0], world[1] + T / 2 + 0.5, world[2] + D / 2),
    connector: new THREE.Vector3(world[0] + len / 2 - 3.4, world[1] + 0.3, world[2] + end + 0.7),
  };
}
