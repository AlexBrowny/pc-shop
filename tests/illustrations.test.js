import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../data/products.js';
import { GAMES } from '../data/games.js';
import { productSvg, gameSvg } from '../server/lib/illustrations.js';

const BAD = /NaN|undefined|Infinity|\[object/;

test('для каждого товара строится корректная SVG-иллюстрация без NaN/undefined', () => {
  for (const p of PRODUCTS) {
    const svg = productSvg({ ...p });
    assert.ok(svg.startsWith('<svg') && svg.trimEnd().endsWith('</svg>'), `${p.name}: нет корня svg`);
    assert.doesNotMatch(svg, BAD, `${p.brand} ${p.name}: в SVG попали некорректные значения`);
    // теги <g> и <defs> сбалансированы
    for (const tag of ['g', 'defs', 'text']) {
      const open = (svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length;
      const close = (svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
      assert.equal(open, close, `${p.name}: несбалансированный тег <${tag}>`);
    }
  }
});

test('иллюстрации анимируют вентиляторы только через CSS и отключают анимацию при reduced-motion', () => {
  const gpu = productSvg(PRODUCTS.find((p) => p.category === 'gpu'));
  assert.match(gpu, /class="spin"/);
  assert.match(gpu, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(gpu, /<script/i);
});

test('названия с кавычками и скобками экранируются', () => {
  const svg = productSvg({ category: 'gpu', brand: 'Te"st', name: '<b>"X"</b> & Y', specs: PRODUCTS.find((p) => p.category === 'gpu').specs });
  assert.doesNotMatch(svg, /<b>/);
  assert.match(svg, /&lt;b&gt;/);
});

test('обложки игр строятся для всех игр', () => {
  for (const g of GAMES) {
    const svg = gameSvg(g);
    assert.doesNotMatch(svg, BAD, g.title);
    assert.ok(svg.includes('</svg>'));
  }
});
