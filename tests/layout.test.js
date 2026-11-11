import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../data/products.js';
import {
  caseDims, boardPlacement, boardLayout, formFactorOf, ramSlotsUsed, gpuThickness, shroudHeight, SIZE_BY_FORM_FACTOR,
} from '../public/js/viewer/layout.js';

const cases = PRODUCTS.filter((p) => p.category === 'case');
const gpus = PRODUCTS.filter((p) => p.category === 'gpu');

test('размеры корпуса вмещают самую длинную допустимую видеокарту и кулер', () => {
  for (const c of cases) {
    const { L, W } = caseDims(c.specs);
    assert.ok(L * 10 >= c.specs.max_gpu_mm + 70, `${c.name}: длина ${L} см мала для GPU ${c.specs.max_gpu_mm} мм`);
    assert.ok(W * 10 >= c.specs.max_cooler_mm + 50, `${c.name}: ширина ${W} см мала для кулера ${c.specs.max_cooler_mm} мм`);
  }
});

test('плата любого формата помещается в корпус, который её поддерживает', () => {
  for (const c of cases) {
    const dims = caseDims(c.specs);
    for (const ff of c.specs.form_factors) {
      const bp = boardPlacement(dims, ff);
      assert.ok(bp.cx - bp.w / 2 >= -dims.L / 2, `${c.name}/${ff}: плата выходит за заднюю стенку`);
      assert.ok(bp.cx + bp.w / 2 <= dims.L / 2, `${c.name}/${ff}: плата выходит за переднюю панель`);
      assert.ok(bp.cy + bp.h / 2 <= dims.H / 2, `${c.name}/${ff}: плата выходит за верх`);
      assert.ok(bp.cy - bp.h / 2 >= -dims.H / 2, `${c.name}/${ff}: плата выходит за низ`);
    }
  }
});

test('элементы платы лежат в пределах платы', () => {
  for (const ff of Object.keys(SIZE_BY_FORM_FACTOR)) {
    const [w, h] = SIZE_BY_FORM_FACTOR[ff];
    const lay = boardLayout(ff);
    for (const x of lay.ramX) assert.ok(Math.abs(x) < w / 2, `${ff}: слот DIMM вне платы`);
    assert.ok(lay.ramY + 6.65 <= h / 2 && lay.ramY - 6.65 >= -h / 2, `${ff}: DIMM выходит за плату`);
    assert.ok(Math.abs(lay.socket[0]) < w / 2 && Math.abs(lay.socket[1]) < h / 2, `${ff}: сокет вне платы`);
  }
});

test('видеокарта в слоте не выходит за корпус и не упирается в шторку блока питания', () => {
  for (const c of cases) {
    const dims = caseDims(c.specs);
    const ff = c.specs.form_factors.includes('ATX') ? 'ATX' : 'ITX';
    const bp = boardPlacement(dims, ff);
    const lay = boardLayout(ff);
    const shroudTop = -dims.H / 2 + 0.5 + shroudHeight(dims.itx ? 'SFX' : 'ATX');
    for (const g of gpus) {
      const len = g.specs.length_mm / 10;
      if (g.specs.length_mm > c.specs.max_gpu_mm) continue; // несовместимая пара — в сцене не бывает
      assert.ok(-dims.L / 2 + 1.1 + len <= dims.L / 2 - 1.5, `${c.name}/${g.name}: карта упирается в переднюю панель`);
      const bottom = bp.cy + lay.pcieY - gpuThickness(g.specs.power_w) / 2;
      assert.ok(bottom > shroudTop, `${c.name}/${g.name}: карта (низ ${bottom.toFixed(1)}) заходит в шторку (верх ${shroudTop.toFixed(1)})`);
    }
  }
});

test('форм-фактор платы определяется по плате, а без неё — по корпусу', () => {
  assert.equal(formFactorOf({ form_factor: 'mATX' }, null), 'mATX');
  assert.equal(formFactorOf(null, { form_factors: ['ITX'] }), 'ITX');
  assert.equal(formFactorOf(null, null), 'ATX');
});

test('пары памяти занимают слоты A2/B2, одиночный модуль — A2', () => {
  assert.deepEqual(ramSlotsUsed(2, 4), [1, 3]);
  assert.deepEqual(ramSlotsUsed(2, 2), [0, 1]);
  assert.deepEqual(ramSlotsUsed(1, 4), [1]);
  assert.deepEqual(ramSlotsUsed(4, 4), [0, 1, 2, 3]);
});
