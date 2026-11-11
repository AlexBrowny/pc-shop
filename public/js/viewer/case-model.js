// Модель корпуса: каркас со скруглёнными кромками, перфорированные панели, окно с тонированным стеклом,
// кабельные вырезы на задней стенке, шторка блока питания, вентиляторы с подсветкой.
import * as THREE from 'three';
import {
  box, roundedBox, cylinder, fan, labelPlane, CASE_COLORS, accentOf,
} from './primitives.js';
import { mat, led, trayTexture } from './materials.js';
import { psuDims, shroudHeight as shroudHeightOf } from './layout.js';

const PANEL = 0.5;

function styleOf(product) {
  const n = (product?.name ?? '').toLowerCase();
  if (n.includes('north')) return 'wood';
  if (n.includes('y60')) return 'glass';
  if (n.includes('nr200')) return 'itx';
  return 'mesh';
}

/** Вырезы на задней стенке (в координатах корпуса, см): под бекплейт сокета и кабели. */
function trayCutouts(dims, bp, lay) {
  const { L, H, W } = dims;
  const sx = bp.cx + lay.socket[0];
  const sy = bp.cy + lay.socket[1];
  const right = bp.cx + bp.w / 2;
  return [
    [sx, sy, 9.5, 9.5, 0.12], // бекплейт процессора
    [right + 2.1, bp.cy + bp.h * 0.05, 2.6, bp.h * 0.8, 0.45], // кабельное окно справа от платы
    [bp.cx, -H / 2 + 14, Math.min(bp.w * 0.8, L * 0.5), 3.2, 0.5], // нижнее окно к блоку питания
    [bp.cx - bp.w * 0.1, H / 2 - 1.8, 11, 1.6, 0.5], // верхнее окно к питанию процессора
    ...(W > 0 ? [] : []),
  ];
}

/**
 * Возвращает { group, glass, fans, lights, shroudTop }.
 * product — товар-корпус или null (условный корпус); hasFrontRadiator — на передней панели радиатор СЖО.
 */
export function buildCase(dims, product, {
  hasFrontRadiator = false, psuFormFactor = 'ATX', bp, lay,
} = {}) {
  const { L, H, W } = dims;
  const colorName = product?.specs.color ?? 'Black';
  const light = colorName === 'White';
  const bodyColor = CASE_COLORS[colorName] ?? CASE_COLORS.Black;
  const accent = accentOf(product?.brand ?? 'NZXT');
  const style = styleOf(product);

  const body = mat.coated(bodyColor);
  const inner = mat.coated(light ? '#c4c9d2' : '#23262d');
  const dark = mat.darkMetal('#0f1116');
  const group = new THREE.Group();
  const fans = [];
  const lights = [];

  // ── Задняя стенка (подложка платы) с кабельными окнами
  group.add(roundedBox(L - 0.4, H - 0.4, 0.4, inner, 0.15, [0, 0, -W / 2 + 0.2]));
  if (bp && lay) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(L - 0.6, H - 0.6),
      new THREE.MeshBasicMaterial({ map: trayTexture(L - 0.6, H - 0.6, trayCutouts(dims, bp, lay)), transparent: true, depthWrite: false, toneMapped: false }),
    );
    decal.position.z = -W / 2 + 0.42;
    group.add(decal);
  }

  // ── Верх, низ, перед, тыл
  group.add(roundedBox(L, PANEL, W, body, 0.2, [0, H / 2 - PANEL / 2, 0]));
  group.add(roundedBox(L, PANEL, W, body, 0.2, [0, -H / 2 + PANEL / 2, 0]));
  group.add(roundedBox(1.6, H, W, body, 0.3, [L / 2 - 0.8, 0, 0]));
  group.add(roundedBox(0.9, H, W, body, 0.2, [-L / 2 + 0.45, 0, 0]));

  // Вентиляционная решётка сверху
  const topVent = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.55, W * 0.62), mat.mesh(light ? '#9aa1ad' : '#0b0c0f'));
  topVent.rotation.x = -Math.PI / 2;
  topVent.position.set(-L * 0.08, H / 2 + 0.02, 0);
  group.add(topVent);

  // Передняя панель: порты и кнопка питания на верхней кромке
  group.add(box(2.2, 0.5, 0.9, mat.rubber(), [L / 2 - 2.6, H / 2 + 0.12, W / 2 - 3.2]));
  group.add(box(2.2, 0.5, 0.9, mat.rubber(), [L / 2 - 2.6, H / 2 + 0.12, W / 2 - 5.2]));
  const power = cylinder(0.8, 0.5, mat.darkMetal('#2a2d36'), 'y', [L / 2 - 2.6, H / 2 + 0.2, W / 2 - 8.4]);
  group.add(power);
  const powerRing = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.07, 8, 32), led(accent, { speed: 0.7 }));
  powerRing.rotation.x = Math.PI / 2;
  powerRing.position.copy(power.position).setY(H / 2 + 0.45);
  group.add(powerRing);

  // Передняя «лицевая» панель по стилю
  const faceX = L / 2 + 0.02;
  if (style === 'wood') {
    const slats = 16;
    const slatW = (W - 2.4) / slats;
    for (let i = 0; i < slats; i += 1) {
      const slat = roundedBox(0.4, H - 3, slatW - 0.25, new THREE.MeshStandardMaterial({ color: i % 2 ? '#b9874e' : '#a97a45', roughness: 0.7, metalness: 0 }), 0.1, [faceX + 0.1, 0, -W / 2 + 1.4 + slatW * (i + 0.5)]);
      group.add(slat);
    }
  } else if (style === 'glass') {
    const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, H - 2), mat.glass());
    glassFront.rotation.y = Math.PI / 2;
    glassFront.position.set(faceX + 0.05, 0, 0);
    group.add(glassFront);
  } else {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.6, H - 1.6), mat.mesh(bodyColor));
    mesh.rotation.y = Math.PI / 2;
    mesh.position.set(faceX, 0, 0);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // ── Рамка и тонированное стекло боковой стенки
  const frame = 0.8;
  group.add(roundedBox(L, frame, 0.7, body, 0.2, [0, H / 2 - frame / 2, W / 2 - 0.35]));
  group.add(roundedBox(L, frame, 0.7, body, 0.2, [0, -H / 2 + frame / 2, W / 2 - 0.35]));
  group.add(roundedBox(frame, H, 0.7, body, 0.2, [L / 2 - frame / 2, 0, W / 2 - 0.35]));
  group.add(roundedBox(frame, H, 0.7, body, 0.2, [-L / 2 + frame / 2, 0, W / 2 - 0.35]));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(L - 1.4, H - 1.4, 0.25), mat.glass());
  glass.position.set(0, 0, W / 2 - 0.15);
  glass.name = 'glass';
  glass.renderOrder = 5;
  group.add(glass);

  // ── Задняя панель: слоты расширения, окно I/O, вентилятор выдува
  const slotX = -L / 2 + 0.95;
  const slotTop = H / 2 - (dims.itx ? 15 : 17);
  for (let i = 0; i < 7; i += 1) {
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 1.7), mat.mesh('#0e1014'));
    cover.rotation.y = Math.PI / 2;
    cover.position.set(slotX, slotTop - i * 2.05, -W / 2 + 7.8);
    group.add(cover);
  }
  const io = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.2), mat.mesh('#b9bec8'));
  io.rotation.y = Math.PI / 2;
  io.position.set(slotX, H / 2 - 7, -W / 2 + 8.8);
  group.add(io);
  const rear = fan(12, '#7d8798', { rgb: accent });
  rear.rotation.y = -Math.PI / 2;
  rear.position.set(-L / 2 + 2.3, H / 2 - 8.5, -W / 2 + 7.5);
  group.add(rear);
  fans.push(rear);

  // ── Передние вентиляторы (вдув), если на передней панели нет радиатора СЖО
  if (!hasFrontRadiator) {
    const count = dims.itx ? 2 : 3;
    for (let i = 0; i < count; i += 1) {
      const f = fan(14, '#9aa3b4', { rgb: accent });
      f.rotation.y = Math.PI / 2;
      f.position.set(L / 2 - 2.9, H / 2 - 9 - i * 14.6, -W / 2 + 8.2);
      group.add(f);
      fans.push(f);
    }
  }

  // ── Шторка блока питания: передняя часть отсека закрыта, задняя открыта под БП
  const psu = psuDims(psuFormFactor);
  const shroudH = shroudHeightOf(psuFormFactor);
  const shroudStart = -L / 2 + 1.5 + psu.x + 1;
  const shroudEnd = L / 2 - 1.8;
  const shroudLen = shroudEnd - shroudStart;
  const shroudCx = (shroudStart + shroudEnd) / 2;
  const shroudY = -H / 2 + PANEL + shroudH / 2;
  group.add(roundedBox(shroudLen, shroudH, W - 1.6, mat.darkMetal('#14161c'), 0.35, [shroudCx, shroudY, -0.1]));
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(shroudLen * 0.5, shroudH * 0.45), mat.mesh('#07080a'));
  vent.position.set(shroudCx + shroudLen * 0.18, shroudY - shroudH * 0.12, W / 2 - 0.92);
  group.add(vent);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(shroudLen - 1.2, 0.22, 0.2), led(accent, { speed: 0.8 }));
  strip.position.set(shroudCx, shroudY + shroudH * 0.3, W / 2 - 0.9);
  group.add(strip);
  if (product) {
    const logo = labelPlane(product.brand.toUpperCase(), Math.min(14, shroudLen * 0.5), 1.8, { fg: '#eef1f6', spacing: 4, glow: false });
    logo.position.set(shroudCx - shroudLen * 0.12, shroudY + shroudH * 0.04, W / 2 - 0.88);
    group.add(logo);
  }

  // ── Ножки
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    group.add(box(4, 1.1, 2.4, mat.rubber('#08090c'), [sx * (L / 2 - 5), -H / 2 - 0.55, sz * (W / 2 - 3.2)]));
  }

  // ── Подсветка внутри: цветные источники «разливают» RGB по деталям
  const spill = new THREE.PointLight(accent, 150, 60, 2);
  spill.position.set(L / 2 - 8, 2, 10);
  const spill2 = new THREE.PointLight(accent, 100, 50, 2);
  spill2.position.set(-L / 2 + 14, -H / 4, 9);
  lights.push(spill, spill2);
  group.add(spill, spill2);

  return {
    group, glass, fans, lights, shroudTop: -H / 2 + PANEL + shroudH,
  };
}
