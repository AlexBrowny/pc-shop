import {
  text, floorShadow, accentOf, fan, lighten, darken, screw,
} from './common.js';

const TIER = {
  Bronze: ['#c98a4b', 'BRONZE'], Gold: ['#f0c24a', 'GOLD'], Platinum: ['#cfd6e2', 'PLATINUM'], Titanium: ['#aab4c8', 'TITANIUM'],
};

function cable(path, color, w = 9) {
  return `<path d="${path}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="${w + 3}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2" stroke-linecap="round" transform="translate(-1.5 -2)"/>`;
}

function connector(x, y, w, h, pinsX, pinsY) {
  let pins = '';
  for (let i = 0; i < pinsX; i += 1) for (let j = 0; j < pinsY; j += 1) pins += `<rect x="${x + 5 + i * ((w - 10) / pinsX)}" y="${y + 5 + j * ((h - 10) / pinsY)}" width="${(w - 10) / pinsX - 2}" height="${(h - 10) / pinsY - 2}" rx="1" fill="url(#gGold)"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#0b0c0f" stroke="#4a505c"/>${pins}`;
}

export function psuArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const sfx = s.form_factor !== 'ATX';
  const w = sfx ? 300 : 380;
  const h = sfx ? 270 : 330;
  const x0 = sfx ? 130 : 90;
  const y0 = 290 - h / 2;
  const tierKey = Object.keys(TIER).find((k) => s.efficiency.includes(k)) ?? 'Bronze';
  const [tierColor, tierName] = TIER[tierKey];
  const fr = Math.min(w, h) * 0.38;
  const cx = w * 0.5;
  const cy = h * 0.5;

  let grille = '';
  for (let i = 1; i <= 5; i += 1) grille += `<circle cx="${cx}" cy="${cy}" r="${(fr * i) / 5.2}" fill="none" stroke="#c7ccd6" stroke-opacity=".75" stroke-width="2"/>`;
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12;
    grille += `<path d="M${cx} ${cy}L${(cx + Math.cos(a) * fr * 1.02).toFixed(1)} ${(cy + Math.sin(a) * fr * 1.02).toFixed(1)}" stroke="#c7ccd6" stroke-opacity=".6" stroke-width="1.6"/>`;
  }

  const modular = s.modular;
  return `${floorShadow(400, y0 + h + 36, 340, 26, 0.7)}
  <g transform="translate(${x0} ${y0})" filter="url(#fDrop)">
    <rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="url(#gDark)" stroke="#5f6674" stroke-width="2"/>
    <rect x="0" y="0" width="${w}" height="${h}" rx="16" fill="url(#gSheen)" opacity=".2"/>
    <rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="10" fill="#0d0e12" stroke="#2a2e38"/>
    <circle cx="${cx}" cy="${cy}" r="${fr * 1.08}" fill="#06070a" stroke="${accent}" stroke-width="3" class="pulse" style="--d:4.5s"/>
    <g transform="translate(0 0)">${fan({ cx, cy, r: fr * 0.98, blades: 7, color: '#8f98a7', dur: 2.8, frame: false })}</g>
    ${grille}
    <circle cx="${cx}" cy="${cy}" r="${fr * 0.22}" fill="#111318" stroke="#555c68"/>
    ${text(cx, cy + 6, p.brand.length > 9 ? p.brand.slice(0, 9) : p.brand, { size: fr * 0.15, weight: 800, anchor: 'middle', fill: lighten(accent, 0.25), spacing: 1 })}
    ${[[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]].map(([x, y]) => screw(x, y, 6)).join('')}
    <rect x="${w - 76}" y="${h - 54}" width="62" height="30" rx="6" fill="#14161c" stroke="${tierColor}" stroke-width="2"/>
    ${text(w - 45, h - 40, '80 PLUS', { size: 9, weight: 800, anchor: 'middle', fill: '#e8ecf4', spacing: 1 })}
    ${text(w - 45, h - 29, tierName, { size: 10, weight: 800, anchor: 'middle', fill: tierColor, spacing: 0.5 })}
    <rect x="${w - 3}" y="${h * 0.2}" width="12" height="${h * 0.6}" rx="3" fill="url(#gDarkV)" stroke="#555c68"/>
    ${modular ? Array.from({ length: 6 }, (_, i) => `<rect x="${w - 1}" y="${h * 0.24 + i * (h * 0.09)}" width="9" height="${h * 0.06}" rx="1" fill="#05060a" stroke="#555c68"/>`).join('') : ''}
  </g>
  <g transform="translate(${x0 + w + 6} ${y0 + h * 0.2})">
    ${cable('M0 30 C70 30 80 -10 150 -10 S 230 20 250 20', '#262a33')}
    ${cable('M0 62 C80 62 90 40 160 44 S 250 70 262 70', '#2e333d', 8)}
    ${cable('M0 94 C70 94 100 100 160 100 S 230 120 250 126', '#262a33')}
    ${cable('M0 126 C80 126 90 150 160 156 S 230 170 240 178', '#2e333d', 8)}
    ${connector(236, 6, 54, 30, 12, 2)}
    ${connector(248, 54, 40, 26, 4, 2)}
    ${connector(232, 112, 56, 24, 8, 2)}
    ${connector(222, 164, 36, 24, 3, 2)}
  </g>
  ${text(x0 + w / 2, y0 - 22, `${s.wattage_w} W`, { size: 46, weight: 800, anchor: 'middle', fill: '#fff', opacity: 0.95, spacing: 2 })}`;
}
