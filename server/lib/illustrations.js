// Генерация SVG-иллюстраций товаров и обложек игр (оригинальная векторная графика, не фото и не логотипы).
// Используется скриптом `npm run images` и админкой — для новых товаров/игр без загруженной картинки.
// Картинки анимированы средствами CSS внутри SVG (вращение вентиляторов, пульсация подсветки)
// и отключают анимацию при prefers-reduced-motion.

import {
  esc, defs, stage, accentOf,
} from './art/common.js';
import { cpuArt } from './art/cpu.js';
import { motherboardArt } from './art/motherboard.js';
import { ramArt } from './art/ram.js';
import { gpuArt } from './art/gpu.js';
import { storageArt } from './art/storage.js';
import { psuArt } from './art/psu.js';
import { caseArt } from './art/case.js';
import { coolerArt } from './art/cooler.js';

export const slugify = (text) =>
  text.toLowerCase().replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ART = {
  cpu: cpuArt, motherboard: motherboardArt, ram: ramArt, gpu: gpuArt, storage: storageArt, psu: psuArt, case: caseArt, cooler: coolerArt,
};

export function productSvg(p) {
  const accent = accentOf(p.brand);
  const art = (ART[p.category] ?? cpuArt)(p);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${esc(`${p.brand} ${p.name}`)}">
${defs(accent)}
${stage(art)}
</svg>`;
}

const wrap = (text, max) => {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((`${line} ${word}`).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
};

export function gameSvg(g) {
  const h1 = Number.isFinite(g.hue) ? g.hue : 220;
  const h2 = (h1 + 40) % 360;
  const lines = wrap(String(g.title), 15);
  const titleY = 330 - (lines.length - 1) * 16;
  const text = lines
    .map((l, i) => `<text x="24" y="${titleY + i * 32}" font-family="'Segoe UI','Arial Black',Arial,sans-serif" font-size="27" font-weight="900" fill="#fff" letter-spacing="0.5">${esc(l)}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" role="img" aria-label="${esc(g.title)}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 78% 46%)"/><stop offset="0.55" stop-color="hsl(${h2} 62% 22%)"/><stop offset="1" stop-color="hsl(${h2} 55% 8%)"/></linearGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.85"/></linearGradient>
  <radialGradient id="sun" cx="68%" cy="26%" r="48%"><stop offset="0" stop-color="hsl(${h1} 100% 78%)" stop-opacity="0.9"/><stop offset="1" stop-color="hsl(${h1} 100% 60%)" stop-opacity="0"/></radialGradient>
  <style>.drift{animation:drift 9s ease-in-out infinite alternate}@keyframes drift{to{transform:translate(-8px,6px)}}@media (prefers-reduced-motion:reduce){.drift{animation:none}}</style>
</defs>
<rect width="300" height="400" fill="url(#g)"/>
<rect width="300" height="400" fill="url(#sun)"/>
<g class="drift" opacity="0.5"><path d="M-20 0 L120 0 L-20 260Z" fill="#fff" opacity="0.07"/><path d="M160 0 L240 0 L60 300Z" fill="#fff" opacity="0.06"/></g>
<path d="M0 290 L70 200 L120 250 L190 150 L250 230 L300 190 L300 400 L0 400Z" fill="#000" opacity="0.38"/>
<path d="M0 330 L60 270 L130 320 L210 250 L300 320 L300 400 L0 400Z" fill="#000" opacity="0.45"/>
<rect y="170" width="300" height="230" fill="url(#fade)"/>
<rect x="24" y="${titleY - 42}" width="44" height="4" rx="2" fill="hsl(${h1} 100% 70%)"/>
${text}
<text x="24" y="${titleY + lines.length * 32 + 6}" font-family="'Segoe UI',Arial,sans-serif" font-size="13" font-weight="700" fill="#fff" opacity="0.65" letter-spacing="2">${esc(g.year ?? '')}</text>
</svg>`;
}
