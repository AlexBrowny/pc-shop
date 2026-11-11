import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, USD_RATE } from '../data/products.js';
import { GAMES } from '../data/games.js';
import { checkBuild, classifyCandidate } from '../server/lib/compat.js';
import { estimateGameFps, vramFactor } from '../server/lib/fps.js';

const find = (name) => {
  const p = PRODUCTS.find((x) => x.name === name);
  assert.ok(p, `product not found: ${name}`);
  return { ...p, price_uzs: Math.round(p.usd * USD_RATE) };
};
const game = (slug) => {
  const g = GAMES.find((x) => x.slug === slug);
  return { ...g, gpu_fps: g.gpu_fps, cpu_fps: g.cpu_fps };
};
const codes = (result) => result.issues.map((i) => i.code);

const goodBuild = () => ({
  cpu: find('Ryzen 7 7800X3D'),
  motherboard: find('MAG B650 Tomahawk WiFi'),
  ram: find('Vengeance 32GB (2x16GB) DDR5-6000'),
  gpu: find('GeForce RTX 4070 SUPER 12GB'),
  storage: [find('990 PRO 1TB')],
  psu: find('RM750e'),
  case: find('4000D Airflow'),
  cooler: find('Liquid Freezer III 240'),
});

test('собранная вручную совместимая сборка не имеет ошибок', () => {
  const r = checkBuild(goodBuild());
  assert.deepEqual(r.issues.filter((i) => i.level === 'error'), []);
  assert.deepEqual(r.missing, []);
});

test('несовпадение сокета процессора и платы — ошибка', () => {
  const r = checkBuild({ ...goodBuild(), cpu: find('Core i5-13400F') });
  assert.ok(codes(r).includes('socket_mismatch'));
});

test('DDR4 в плате DDR5 — ошибка типа памяти', () => {
  const r = checkBuild({ ...goodBuild(), ram: find('FURY Beast 16GB (2x8GB) DDR4-3200') });
  assert.ok(codes(r).includes('ram_type_mismatch'));
});

test('видеокарта длиннее корпуса — ошибка', () => {
  const r = checkBuild({ ...goodBuild(), case: find('NR200P'), motherboard: find('ROG STRIX B650E-I Gaming WiFi'), psu: find('SF750 Platinum'), gpu: find('GeForce RTX 4090 24GB') });
  assert.ok(codes(r).includes('gpu_length'));
});

test('ATX-плата не помещается в ITX-корпус', () => {
  const r = checkBuild({ ...goodBuild(), case: find('NR200P') });
  assert.ok(codes(r).includes('form_factor'));
  assert.ok(codes(r).includes('psu_form_factor'));
});

test('слабый БП: ошибка нехватки мощности, но без блокировки выбора', () => {
  const r = checkBuild({ ...goodBuild(), gpu: find('GeForce RTX 4090 24GB'), psu: find('PK550D 550W') });
  const issue = r.issues.find((i) => i.code === 'psu_insufficient');
  assert.ok(issue);
  assert.equal(issue.block, false);
});

test('классификация кандидата: несовместимый сокет блокируется, совместимый — ok', () => {
  const parts = goodBuild();
  assert.equal(classifyCandidate('cpu', find('Core i7-14700K'), parts).status, 'blocked');
  assert.equal(classifyCandidate('cpu', find('Ryzen 9 9950X'), parts).status, 'ok');
});

test('классификация кандидата: слабый кулер для горячего CPU даёт предупреждение', () => {
  const parts = { ...goodBuild(), cpu: find('Ryzen 9 9950X') };
  assert.equal(classifyCandidate('cooler', find('AK400'), parts).status, 'warn');
});

test('недостающие обязательные компоненты перечисляются', () => {
  const r = checkBuild({ cpu: find('Ryzen 5 5600'), storage: [] });
  assert.ok(r.missing.includes('motherboard'));
  assert.ok(r.missing.includes('gpu')); // у 5600 нет встроенной графики
});

test('FPS растёт с мощностью видеокарты и падает с пресетом и разрешением', () => {
  const cpu = find('Ryzen 7 7800X3D');
  const ram = find('Vengeance 32GB (2x16GB) DDR5-6000');
  const g = game('cyberpunk-2077');
  const weak = estimateGameFps(g, { cpu, gpu: find('GeForce RTX 3060 12GB'), ram });
  const strong = estimateGameFps(g, { cpu, gpu: find('GeForce RTX 4080 SUPER 16GB'), ram });
  assert.ok(strong.ultra.fps > weak.ultra.fps);
  assert.ok(strong.low.fps >= strong.ultra.fps);
  const uhd = estimateGameFps(g, { cpu, gpu: find('GeForce RTX 4080 SUPER 16GB'), ram }, '2160p');
  assert.ok(uhd.ultra.fps < strong.ultra.fps);
});

test('слабый процессор становится узким местом на мощной видеокарте', () => {
  const r = estimateGameFps(game('dragons-dogma-2'), {
    cpu: find('Core i3-12100F'),
    gpu: find('GeForce RTX 4090 24GB'),
    ram: find('Vengeance 32GB (2x16GB) DDR5-6000'),
  });
  assert.equal(r.low.bottleneck, 'cpu');
});

test('нехватка видеопамяти штрафуется', () => {
  assert.equal(vramFactor(12, 8), 1);
  assert.ok(vramFactor(4, 8) < 0.6);
});
