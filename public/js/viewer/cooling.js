// Охлаждение процессора: воздушная башня (рёбра, тепловые трубки, вентиляторы) и СЖО (помпа, трубки, радиатор).
import * as THREE from 'three';
import {
  box, roundedBox, cylinder, fan, labelPlane, accentOf,
} from './primitives.js';
import { mat, led, finsMap } from './materials.js';
import { RADIATOR_LENGTH_CM } from './layout.js';

const FAN_STYLE = {
  Noctua: { blades: '#c9a273', frame: '#5c432b', rgb: null },
  Thermalright: { blades: '#bfc6d3', frame: '#14161b', rgb: null },
};

function finStack(group, x, sizeX, sizeY, z0, zLen) {
  const fins = Math.round(zLen / 0.34);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(sizeX, sizeY, 0.09), mat.nickel(), fins);
  const m = new THREE.Matrix4();
  for (let i = 0; i < fins; i += 1) {
    m.makeTranslation(x, 0, z0 + 0.17 + i * (zLen / fins));
    mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

export function buildAirCooler({ parts, lay, bp }) {
  const cooler = parts.cooler;
  const accent = accentOf(cooler.brand);
  const style = FAN_STYLE[cooler.brand] ?? { blades: '#aab2c2', frame: '#101217', rgb: accent };
  const g = new THREE.Group();
  const top = cooler.specs.height_mm / 10 + 0.4;
  const double = cooler.specs.tdp_w >= 280;
  g.add(roundedBox(4.8, 4.8, 0.6, mat.copper(), 0.2, [0, 0, 1.5]));
  const towers = double ? [[-2.6, 3.8], [3.9, 3.8]] : [[0.4, 5.2]];
  for (const [x, sx] of towers) {
    finStack(g, x, sx, 12, 1.8, top - 1.8);
    for (const y of [-3.9, -1.3, 1.3, 3.9]) g.add(cylinder(0.3, top - 1.4, mat.copper(), 'z', [x, y, (top + 1.8) / 2], 16));
    g.add(roundedBox(sx + 0.1, 12.1, 0.35, mat.darkMetal('#181b21'), 0.12, [x, 0, top + 0.12]));
    g.add(box(sx * 0.55, 0.22, 0.08, led(accent, { intensity: 1.6 }), [x, 0, top + 0.34]));
    const name = labelPlane(cooler.brand.toUpperCase(), Math.min(sx * 1.6, 7), 0.9, { fg: '#e8ecf3', spacing: 3, glow: true });
    name.rotation.z = Math.PI / 2;
    name.position.set(x, 0, top + 0.31);
    g.add(name);
  }
  const fanSize = double ? 14 : 12;
  const fanXs = double ? [0.55, 7.0] : [towers[0][0] + towers[0][1] / 2 + 1.3];
  const fans = [];
  for (const fx of fanXs) {
    const f = fan(fanSize, style.blades, { frameColor: style.frame, rgb: style.rgb });
    f.rotation.y = Math.PI / 2;
    f.position.set(fx, 0, top - fanSize / 2 + (double ? 0.4 : 0));
    g.add(f);
    fans.push(f);
  }
  g.position.set(bp.cx + lay.socket[0], bp.cy + lay.socket[1], bp.z);
  return { object: g, anchor: new THREE.Vector3(g.position.x, g.position.y + 6.5, bp.z + top) };
}

/** СЖО: радиатор с вентиляторами на передней панели, помпа на процессоре, две оплётные трубки. */
export function buildAio({ parts, dims, bp, lay }) {
  const cooler = parts.cooler;
  const accent = accentOf(cooler.brand);
  const g = new THREE.Group();
  const radSize = cooler.specs.radiator_mm;
  const len = Math.min(RADIATOR_LENGTH_CM[radSize] ?? 27.5, dims.H - 3);
  const zc = -dims.W / 2 + 8;
  const yc = dims.H / 2 - 1.8 - len / 2;
  const rx = dims.L / 2 - 1.5 - 1.4;

  const finTex = finsMap(24);
  const radMat = new THREE.MeshStandardMaterial({ color: '#15171d', metalness: 0.7, roughness: 0.5, bumpMap: finTex, bumpScale: 0.2 });
  const rad = roundedBox(2.7, len, 12.4, radMat, 0.3, [rx, yc, zc]);
  g.add(rad);
  g.add(box(2.9, len - 1.6, 0.14, led(accent, { intensity: 1.2 }), [rx, yc, zc + 6.28]));
  const count = Math.round(radSize / (radSize === 280 ? 140 : 120));
  const fanSize = radSize === 280 ? 14 : 12;
  for (let i = 0; i < count; i += 1) {
    const f = fan(fanSize, '#a7afbf', { rgb: accent });
    f.rotation.y = Math.PI / 2;
    f.position.set(rx - 1.35 - 1.2, yc + len / 2 - (len / count) * (i + 0.5), zc);
    g.add(f);
  }

  // Помпа: корпус, зеркало с логотипом и светящееся кольцо («бесконечность»)
  const px = bp.cx + lay.socket[0];
  const py = bp.cy + lay.socket[1];
  const pump = new THREE.Group();
  pump.add(cylinder(3.9, 3.4, mat.darkMetal('#13151b'), 'z', [0, 0, 3.5], 48));
  const mirror = cylinder(3.3, 0.1, new THREE.MeshStandardMaterial({ color: '#06070a', metalness: 1, roughness: 0.12 }), 'z', [0, 0, 5.25], 48);
  pump.add(mirror);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.14, 12, 64), led(accent, { intensity: 3 }));
  ring.position.z = 5.28;
  pump.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.06, 12, 64), led(accent, { intensity: 1.6, phase: 2 }));
  ring2.position.z = 5.28;
  pump.add(ring2);
  const logo = labelPlane(cooler.brand.toUpperCase().slice(0, 9), 4.8, 0.9, { fg: '#f2f4f8', spacing: 3, glow: true });
  logo.position.z = 5.33;
  pump.add(logo);
  pump.position.set(px, py, bp.z);
  g.add(pump);

  // Оплётные трубки к нижнему краю радиатора
  const start = new THREE.Vector3(px, py, bp.z + 3.4);
  const endY = yc - len / 2 + 1.4;
  const braid = new THREE.MeshStandardMaterial({ color: '#16181e', roughness: 0.75, metalness: 0.15, bumpMap: finsMap(40), bumpScale: 0.6 });
  for (const dz of [-1.8, 1.8]) {
    const p0 = start.clone().add(new THREE.Vector3(3.4, dz > 0 ? 1.2 : -1.2, 0));
    const p3 = new THREE.Vector3(rx - 1.3, endY, zc + dz);
    const curve = new THREE.CatmullRomCurve3([p0, p0.clone().add(new THREE.Vector3(2.6, -1.2, 0.8)), p3.clone().add(new THREE.Vector3(-9, 3, -0.6)), p3]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.5, 10), braid);
    tube.castShadow = true;
    g.add(tube);
  }
  return { object: g, anchor: new THREE.Vector3(px, py + 4.3, bp.z + 6.2) };
}
