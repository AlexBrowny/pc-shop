import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, USD_RATE } from '../data/products.js';
import { PRESETS } from '../data/presets.js';
import { checkBuild } from '../server/lib/compat.js';

const slugify = (t) => t.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const bySlug = new Map(PRODUCTS.map((p) => [slugify(`${p.brand} ${p.name}`), { ...p, price_uzs: Math.round(p.usd * USD_RATE) }]));

for (const preset of PRESETS) {
  test(`готовая сборка «${preset.key}» полностью совместима, без ошибок и предупреждений`, () => {
    const get = (slug) => {
      const p = bySlug.get(slug);
      assert.ok(p, `товар не найден: ${slug}`);
      return p;
    };
    const parts = {
      cpu: get(preset.parts.cpu), motherboard: get(preset.parts.motherboard), ram: get(preset.parts.ram), gpu: get(preset.parts.gpu),
      storage: preset.parts.storage.map(get), psu: get(preset.parts.psu), case: get(preset.parts.case), cooler: get(preset.parts.cooler),
    };
    const result = checkBuild(parts);
    assert.deepEqual(result.issues.map((i) => `${i.level}:${i.code}`), []);
    assert.deepEqual(result.missing, []);
  });
}
