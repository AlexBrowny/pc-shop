import {
  text, floorShadow, accentOf, fan, lighten, darken, screw,
} from './common.js';

const SERIES = { NVIDIA: 'GEFORCE', AMD: 'RADEON', Intel: 'ARC' };

/** Видеокарта, вид сверху на вентиляторы: кожух, 2–3 вентилятора, радиатор, планка с портами. */
export function gpuArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const len = s.length_mm;
  const fans = len > 285 ? 3 : 2;
  const thick = s.power_w > 350 ? 280 : s.power_w > 250 ? 252 : s.power_w > 130 ? 226 : 190;
  const w = Math.round(480 + (len - 190) * 0.9);
  const h = thick;
  const x0 = 400 - w / 2;
  const y0 = 290 - h / 2;
  const cyF = h * 0.55;
  const span = w - 150;
  const gap = span / fans;
  const r = Math.min(h * 0.31, gap * 0.44);
  const parts = [];

  // PCB и золотые контакты PCIe
  parts.push(`<rect x="40" y="${h - 14}" width="${w - 60}" height="22" rx="3" fill="#161a20"/>`);
  parts.push(`<rect x="70" y="${h + 2}" width="${w * 0.2}" height="12" fill="url(#gGold)"/><rect x="${70 + w * 0.2 + 12}" y="${h + 2}" width="${w * 0.14}" height="12" fill="url(#gGold)"/>`);
  // торцевой радиатор (рёбра по краям)
  parts.push(`<rect x="36" y="-10" width="${w - 52}" height="16" rx="3" fill="url(#gSteelV)"/><rect x="36" y="-10" width="${w - 52}" height="16" rx="3" fill="url(#pFins)"/>`);
  parts.push(`<rect x="36" y="${h - 6}" width="${w - 52}" height="14" rx="3" fill="url(#gSteelV)"/><rect x="36" y="${h - 6}" width="${w - 52}" height="14" rx="3" fill="url(#pFins)"/>`);
  // кожух
  parts.push(`<path d="M30 8 H${w - 40} L${w - 6} 32 V${h - 26} L${w - 40} ${h - 6} H30 Z" fill="url(#gDark)" stroke="#6a7282" stroke-width="2"/>`);
  parts.push(`<path d="M30 8 H${w - 40} L${w - 6} 32 V${h * 0.42} H30 Z" fill="url(#gSheen)" opacity=".22"/>`);
  // акцентные косые вставки
  parts.push(`<path d="M${w * 0.62} ${h - 6} L${w * 0.62 + 44} ${h - 6} L${w * 0.62 + 16} ${h * 0.72} L${w * 0.62 - 28} ${h * 0.72} Z" fill="url(#gAccent)" opacity=".9"/>`);
  // вентиляторы
  for (let i = 0; i < fans; i += 1) {
    const cx = 100 + gap * (i + 0.5) + 8;
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cyF}" r="${(r * 1.1).toFixed(1)}" fill="#0a0b0e" stroke="#3a4050" stroke-width="2"/>`);
    parts.push(fan({ cx, cy: cyF, r, blades: 11, color: '#b3bac6', ring: accent, dur: 2.2 + i * 0.35, reverse: i === 1 }));
  }
  // планка слева с портами
  parts.push(`<rect x="0" y="-4" width="30" height="${h + 14}" rx="4" fill="url(#gSteelV)" stroke="#555a66"/>`);
  for (let i = 0; i < 3; i += 1) parts.push(`<path d="M5 ${h * 0.14 + i * 34}h20l4 5v10l-4 5H5z" fill="#0a0b0e"/><path d="M8 ${h * 0.14 + i * 34 + 4}h14v12H8z" fill="#1c2027"/>`);
  parts.push(`<rect x="5" y="${h * 0.14 + 104}" width="20" height="16" rx="1" fill="#0a0b0e"/>`);
  parts.push(`<rect x="5" y="${h * 0.14 + 124}" width="20" height="26" rx="1" fill="#0a0b0e"/>`);
  parts.push(`<rect x="12" y="${h - 22}" width="6" height="14" rx="1" fill="#a9afba"/>`);
  parts.push(screw(15, 4, 5));
  // разъём питания и названия
  const pw = s.connector.includes('16') ? 46 : 64;
  parts.push(`<rect x="${w - 104}" y="-14" width="${pw}" height="14" rx="2" fill="#0a0b0e" stroke="#4a505c"/>`);
  parts.push(`<rect x="${w - 100}" y="-10" width="${pw - 8}" height="4" fill="url(#gGold)" opacity=".8"/>`);
  const model = p.name.replace(/^GeForce |^Radeon /, '').replace(/\s+\d+\s?GB$/i, '');
  parts.push(text(w * 0.5, h * 0.135, `${SERIES[p.brand] ?? p.brand.toUpperCase()}  ·  ${model.toUpperCase()}`, { size: h * 0.062, weight: 800, anchor: 'middle', fill: '#fff', spacing: 3, opacity: 0.92, italic: true }));
  parts.push(text(w - 24, h - 22, `${s.vram_gb}GB`, { size: h * 0.07, weight: 700, anchor: 'end', fill: lighten(accent, 0.3), opacity: 0.95 }));
  // RGB-полоса вдоль верха
  parts.push(`<rect x="${w * 0.1}" y="19" width="${w * 0.76}" height="3" rx="1.5" fill="${accent}" class="pulse" filter="url(#fGlow)"/>`);

  return `${floorShadow(400, y0 + h + 40, w * 0.55, 28, 0.7)}
  <g transform="translate(${x0.toFixed(1)} ${y0.toFixed(1)}) rotate(-4 ${w / 2} ${h / 2})" filter="url(#fDrop)">${parts.join('\n')}</g>
  <ellipse cx="400" cy="290" rx="${w * 0.55}" ry="${h * 0.6}" fill="${darken(accent, 0.1)}" opacity=".08" filter="url(#fSoft)"/>`;
}
