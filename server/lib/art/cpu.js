import {
  text, floorShadow, accentOf, serial, lighten, darken,
} from './common.js';

function chipTop(p, size) {
  const { specs: s, brand } = p;
  const amd = brand === 'AMD';
  const w = size;
  const h = amd ? size : size * 0.84;
  const iw = w * 0.8;
  const ih = h * 0.8;
  const accent = accentOf(brand);
  let caps = '';
  // SMD-конденсаторы вокруг теплораспределителя
  for (let i = 0; i < 9; i += 1) {
    const x = -w / 2 + w * 0.12 + i * ((w * 0.76) / 8);
    caps += `<rect x="${(x - 5).toFixed(1)}" y="${(-h / 2 + 8).toFixed(1)}" width="10" height="6" rx="1" fill="#c9b27c"/><rect x="${(x - 5).toFixed(1)}" y="${(h / 2 - 14).toFixed(1)}" width="10" height="6" rx="1" fill="#c9b27c"/>`;
  }
  const notch = amd && s.socket === 'AM5'
    ? [-0.27, 0.27].map((k) => `<rect x="${(k * iw - 16).toFixed(1)}" y="${(-ih / 2 - 1).toFixed(1)}" width="32" height="11" rx="3" fill="#10382a"/><rect x="${(k * iw - 16).toFixed(1)}" y="${(ih / 2 - 10).toFixed(1)}" width="32" height="11" rx="3" fill="#10382a"/>`).join('')
      + [-0.27, 0.27].map((k) => `<rect x="${(-iw / 2 - 1).toFixed(1)}" y="${(k * ih - 16).toFixed(1)}" width="11" height="32" rx="3" fill="#10382a"/><rect x="${(iw / 2 - 10).toFixed(1)}" y="${(k * ih - 16).toFixed(1)}" width="11" height="32" rx="3" fill="#10382a"/>`).join('')
    : '';
  const sn = serial(p.name, 9);
  const lines = amd
    ? [
      text(0, -ih * 0.2, 'AMD', { size: iw * 0.15, weight: 800, anchor: 'middle', fill: '#2a2e37', opacity: 0.8, spacing: 4 }),
      text(0, -ih * 0.2 + iw * 0.12, p.name.toUpperCase(), { size: iw * 0.075, weight: 700, anchor: 'middle', fill: '#2a2e37', opacity: 0.78, spacing: 1 }),
      text(0, ih * 0.3, `${s.cores}-CORE · ${s.boost_ghz.toFixed(1)} GHZ`, { size: iw * 0.05, anchor: 'middle', fill: '#2a2e37', opacity: 0.6, spacing: 1.5 }),
    ]
    : [
      text(0, -ih * 0.16, 'intel', { size: iw * 0.2, weight: 800, anchor: 'middle', fill: '#2a2e37', opacity: 0.8, italic: true }),
      text(0, -ih * 0.16 + iw * 0.11, p.name.replace('Intel ', '').toUpperCase(), { size: iw * 0.07, weight: 700, anchor: 'middle', fill: '#2a2e37', opacity: 0.78, spacing: 1 }),
      text(0, ih * 0.3, `${s.base_ghz.toFixed(2)} GHZ · ${s.cores}C/${s.threads}T`, { size: iw * 0.05, anchor: 'middle', fill: '#2a2e37', opacity: 0.6, spacing: 1.2 }),
    ];
  return `<g filter="url(#fDrop)">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="18" fill="url(#gGreen)" stroke="#0b261c" stroke-width="2"/>
    <rect x="${-w / 2 + 3}" y="${-h / 2 + 3}" width="${w - 6}" height="${h - 6}" rx="15" fill="none" stroke="#6ad0a4" stroke-opacity=".25"/>
    ${caps}
    <polygon points="${-w / 2 + 12},${-h / 2 + 12} ${-w / 2 + 34},${-h / 2 + 12} ${-w / 2 + 12},${-h / 2 + 34}" fill="url(#gGold)"/>
    <rect x="${-iw / 2}" y="${-ih / 2}" width="${iw}" height="${ih}" rx="24" fill="url(#gSteel)" stroke="#5b616e" stroke-width="1.5"/>
    ${notch}
    <rect x="${-iw / 2 + 8}" y="${-ih / 2 + 8}" width="${iw - 16}" height="${ih - 16}" rx="18" fill="none" stroke="#fff" stroke-opacity=".5"/>
    <rect x="${-iw / 2}" y="${-ih / 2}" width="${iw}" height="${ih}" rx="24" fill="url(#gSheen)"/>
    ${lines.join('')}
    ${text(0, ih * 0.43, `${sn}  ${serial(p.name + brand, 6)}`, { size: iw * 0.035, anchor: 'middle', fill: '#2a2e37', opacity: 0.5, spacing: 1.2 })}
    <rect x="${-iw / 2 + 14}" y="${ih / 2 - 16}" width="${iw * 0.18}" height="3" rx="1.5" fill="${accent}" opacity=".9"/>
  </g>`;
}

function chipUnderside(p, size) {
  const amd = p.brand === 'AMD';
  const pga = p.specs.socket === 'AM4';
  const w = size;
  const h = amd ? size : size * 0.84;
  const cell = pga ? 11 : 9;
  const padArea = { x: -w / 2 + 16, y: -h / 2 + 16, w: w - 32, h: h - 32 };
  const pad = pga
    ? `<pattern id="pPads" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><circle cx="${cell / 2}" cy="${cell / 2}" r="3.2" fill="url(#gGold)"/></pattern>`
    : `<pattern id="pPads" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><rect x="1.2" y="1.2" width="${cell - 3.4}" height="${cell - 3.4}" rx="1.4" fill="url(#gGold)"/></pattern>`;
  return `<g filter="url(#fDrop)">
    <defs>${pad}</defs>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="18" fill="#1b5a42" stroke="#0b261c" stroke-width="2"/>
    <rect x="${padArea.x}" y="${padArea.y}" width="${padArea.w}" height="${padArea.h}" fill="url(#pPads)"/>
    <rect x="${-w * 0.2}" y="${-h * 0.2}" width="${w * 0.4}" height="${h * 0.4}" rx="6" fill="#1b5a42"/>
    <rect x="${-w * 0.2}" y="${-h * 0.2}" width="${w * 0.4}" height="${h * 0.4}" rx="6" fill="none" stroke="#0d3326" stroke-width="2"/>
    ${[[-1, -1], [1, -1], [1, 1]].map(([sx, sy]) => `<circle cx="${(sx * (w / 2 - 12)).toFixed(1)}" cy="${(sy * (h / 2 - 12)).toFixed(1)}" r="4" fill="#0d3326"/>`).join('')}
    <polygon points="${-w / 2 + 6},${h / 2 - 6} ${-w / 2 + 26},${h / 2 - 6} ${-w / 2 + 6},${h / 2 - 26}" fill="url(#gGold)"/>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="18" fill="url(#gSheen)" opacity=".5"/>
  </g>`;
}

export function cpuArt(p) {
  const accent = accentOf(p.brand);
  return `${floorShadow(400, 478, 300, 36, 0.7)}
  <g transform="translate(262 318) rotate(-10)">${chipUnderside(p, 248)}</g>
  <g transform="translate(468 296) rotate(6)">${chipTop(p, 300)}</g>
  <ellipse cx="468" cy="296" rx="190" ry="190" fill="${lighten(accent, 0.2)}" opacity="0.06" filter="url(#fSoft)"/>
  ${text(400, 548, '', { size: 1, fill: darken(accent, 0.2) })}`;
}
