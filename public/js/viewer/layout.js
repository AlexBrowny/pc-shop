// Геометрия сборки в сантиметрах — чистые функции без three.js (их проверяют тесты).
//
// Система координат: x — к передней панели (+), y — вверх, z — от задней стенки к стеклу (+).
// Камера смотрит со стороны стекла, поэтому перед корпуса — справа, I/O материнской платы — слева.

export const SIZE_BY_FORM_FACTOR = { ATX: [30.5, 24.4], mATX: [24.4, 24.4], ITX: [17, 17] };

const BOARDS = {
  ATX: { socket: [-4.75, 5.0], ramX: [2.3, 3.25, 4.2, 5.15], ramY: 4.4, pcieY: -1.0, m2: [-3.5, 1.5], chipset: [5.5, -5.5], vrm: [[-11.8, 5.0, 2.6, 11], [-4.75, 10.6, 11, 2.0]] },
  mATX: { socket: [-2.7, 5.0], ramX: [2.3, 3.25, 4.2, 5.15], ramY: 4.4, pcieY: -1.5, m2: [-2.0, 1.5], chipset: [4.5, -5.5], vrm: [[-9.5, 5.0, 2.6, 11], [-2.7, 10.6, 9, 2.0]] },
  ITX: { socket: [-1.6, 2.6], ramX: [3.4, 4.35], ramY: 1.2, pcieY: -6.2, m2: [-1.6, -1.8], chipset: [3.5, -3.8], vrm: [[-6.6, 2.6, 2.0, 7], [-1.6, 6.6, 7, 1.6]] },
};

const BASE_ZB = 1.1; // высота платы над задней панелью (подложка + стойки)

export function formFactorOf(mbSpec, caseSpec) {
  if (mbSpec?.form_factor && BOARDS[mbSpec.form_factor]) return mbSpec.form_factor;
  return caseSpec && !caseSpec.form_factors.includes('ATX') ? 'ITX' : 'ATX';
}

export function caseDims(spec) {
  if (!spec) return { L: 45.5, H: 46, W: 21.5, itx: false };
  const itx = !spec.form_factors.includes('ATX');
  return {
    L: spec.max_gpu_mm / 10 + (itx ? 7 : 9),
    H: itx ? 29 : 46,
    W: spec.max_cooler_mm / 10 + 5.5,
    itx,
  };
}

export function boardPlacement(dims, ff) {
  const [w, h] = SIZE_BY_FORM_FACTOR[ff];
  const topGap = dims.itx ? 2 : 3.5;
  return {
    w, h,
    cx: -dims.L / 2 + 1.2 + w / 2,
    cy: dims.H / 2 - topGap - h / 2,
    z: -dims.W / 2 + BASE_ZB,
  };
}

export const boardLayout = (ff) => BOARDS[ff];

/** Номера слотов DIMM (от процессора наружу), занятые модулями: пары идут в слоты A2/B2. */
export function ramSlotsUsed(modules, slots) {
  const total = Math.max(1, Math.min(slots, 4));
  if (modules >= total) return Array.from({ length: total }, (_, i) => i);
  if (modules === 1) return [Math.min(1, total - 1)];
  if (modules === 2) return [1, 3];
  return Array.from({ length: modules }, (_, i) => i);
}

export function gpuThickness(powerW) {
  if (powerW <= 130) return 4;
  if (powerW <= 250) return 4.6;
  if (powerW <= 350) return 5.6;
  return 6.6;
}

export function psuDims(formFactor) {
  if (formFactor === 'SFX') return { x: 10, y: 6.3, z: 12.5 };
  if (formFactor === 'SFX-L') return { x: 13, y: 6.3, z: 12.5 };
  return { x: 16, y: 8.6, z: 15 };
}

/** Высота шторки блока питания: БП + небольшой зазор. */
export const shroudHeight = (psuFormFactor) => psuDims(psuFormFactor).y + 1.2;

export const RADIATOR_LENGTH_CM = { 120: 15.5, 240: 27.5, 280: 31.5, 360: 39.5 };
