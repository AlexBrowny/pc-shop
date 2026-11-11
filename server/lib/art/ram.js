import {
  text, floorShadow, accentOf, lighten, darken, rect,
} from './common.js';

/** Один модуль: PCB с золотыми контактами, радиатор со скосом, RGB-полоса, наклейка с ёмкостью. */
function stick(p, w, h, { accent, perModule }) {
  const { specs: s, brand } = p;
  const pcbH = h * 0.14;
  const bodyH = h - pcbH;
  const key = w * 0.56;
  let pins = '';
  const count = Math.floor((w - 24) / 8);
  for (let i = 0; i < count; i += 1) {
    const x = 12 + i * 8;
    if (Math.abs(x - key) < 10) continue;
    pins += `<rect x="${x}" y="${(bodyH + 2).toFixed(1)}" width="5.4" height="${(pcbH - 3).toFixed(1)}" fill="url(#gGold)"/>`;
  }
  const rgbLight = darken(accent, 0.05);
  return `<g>
    <rect x="0" y="${(bodyH - 6).toFixed(1)}" width="${w}" height="${(pcbH + 6).toFixed(1)}" rx="3" fill="#10161c" stroke="#2c333d"/>
    ${pins}
    <path d="M${key - 7} ${bodyH + 2}h14v${pcbH}h-14z" fill="#0a0c10"/>
    <path d="M10 8 L${w - 34} 8 L${w - 8} 30 L${w - 8} ${bodyH - 2} L10 ${bodyH - 2} Z" fill="url(#gDarkV)" stroke="#59606e" stroke-width="1.5"/>
    <path d="M10 8 L${w - 34} 8 L${w - 8} 30 L${w - 8} ${bodyH * 0.45} L10 ${bodyH * 0.45} Z" fill="url(#gSheen)" opacity=".28"/>
    <path d="M24 ${bodyH * 0.58} L${w - 24} ${bodyH * 0.58}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <path d="M24 ${bodyH * 0.58 + 3} L${w - 24} ${bodyH * 0.58 + 3}" stroke="#fff" stroke-opacity=".12"/>
    <rect x="30" y="14" width="${w - 98}" height="${(bodyH * 0.2).toFixed(1)}" rx="5" fill="${rgbLight}" opacity=".2"/>
    <rect x="30" y="14" width="${w - 98}" height="${(bodyH * 0.2).toFixed(1)}" rx="5" fill="url(#gAccentH)" class="pulse" filter="url(#fGlow)" style="--d:3.6s"/>
    ${text(34, bodyH * 0.58 + 30, brand.toUpperCase(), { size: bodyH * 0.2, weight: 800, fill: '#eef1f6', spacing: 3, italic: true })}
    ${text(w - 24, bodyH * 0.58 + 30, `${s.ram_type}-${s.speed_mhz}`, { size: bodyH * 0.14, weight: 700, anchor: 'end', fill: lighten(accent, 0.25), spacing: 1 })}
    <rect x="${w - 118}" y="${(bodyH * 0.58 + 8).toFixed(1)}" width="2" height="26" fill="#fff" opacity=".2"/>
    ${text(w * 0.58, bodyH * 0.58 + 54, `CL${s.latency_cl}  ·  ${perModule} GB`, { size: bodyH * 0.1, weight: 600, fill: '#c3c9d4', anchor: 'middle', spacing: 1.2, opacity: 0.85 })}
    ${rect(10, 8, w - 44, 2, '#fff', { opacity: 0.35 })}
  </g>`;
}

export function ramArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const mods = Math.min(Math.max(s.modules, 1), 2);
  const perModule = Math.round(s.capacity_gb / s.modules);
  const w = 560;
  const h = 150;
  const sticks = [];
  for (let i = 0; i < mods; i += 1) {
    const y = mods === 1 ? 225 : 150 + i * 150;
    const x = mods === 1 ? 120 : 110 + i * 22;
    sticks.push(`<g transform="translate(${x} ${y}) rotate(-3 ${w / 2} ${h / 2})" filter="url(#fDrop)">${stick(p, w, h, { accent, perModule })}</g>`);
  }
  return `${floorShadow(400, 490, 300, 28, 0.65)}${sticks.reverse().join('')}`;
}
