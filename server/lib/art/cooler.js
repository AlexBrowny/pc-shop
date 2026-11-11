import {
  text, floorShadow, accentOf, fan, lighten, darken, screw,
} from './common.js';

const FAN_STYLE = {
  Noctua: { blades: '#c9a273', frame: '#5c432b', ring: null },
  Thermalright: { blades: '#c8ced9', frame: '#15171c', ring: null },
};

const COPPER_H = '<linearGradient id="gCopperH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3d10"/><stop offset="0.35" stop-color="#ffc08a"/><stop offset="0.7" stop-color="#c26a26"/><stop offset="1" stop-color="#6a330d"/></linearGradient>';

function squareFan(x, y, size, brand, accent, dur, reverse = false) {
  const st = FAN_STYLE[brand] ?? { blades: '#aeb6c3', frame: '#111318', ring: accent };
  const r = size * 0.43;
  return `<g>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.08}" fill="${st.frame}" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.08}" fill="url(#gSheen)" opacity=".18"/>
    ${[[0.09, 0.09], [0.91, 0.09], [0.09, 0.91], [0.91, 0.91]].map(([a, b]) => `<circle cx="${x + size * a}" cy="${y + size * b}" r="${size * 0.028}" fill="#05060a"/>`).join('')}
    ${fan({ cx: x + size / 2, cy: y + size / 2, r, blades: 9, color: st.blades, ring: st.ring, dur, reverse, frame: true })}
  </g>`;
}

function airTower(p, accent) {
  const s = p.specs;
  const double = s.tdp_w >= 280;
  const brand = p.brand;
  const bw = double ? 340 : 296;
  const x0 = 400 - bw / 2;
  const topY = 62;
  const finBottom = 436;
  const pipes = double ? 7 : 5;
  let pipesSvg = '';
  for (let i = 0; i < pipes; i += 1) {
    const x = x0 + 24 + i * ((bw - 48 - 14) / (pipes - 1));
    pipesSvg += `<rect x="${x.toFixed(1)}" y="${topY - 10}" width="14" height="${finBottom - topY + 40}" rx="7" fill="url(#gCopperH)" stroke="#3a1c08" stroke-opacity=".6"/>`;
  }
  const plate = (x, w, y) => `<g><rect x="${x}" y="${y}" width="${w}" height="26" rx="8" fill="url(#gDarkV)" stroke="#6a7282"/><rect x="${x + w * 0.2}" y="${y + 4}" width="${w * 0.6}" height="3" rx="1.5" fill="${accent}" opacity=".9"/>${text(x + w / 2, y + 20, brand.toUpperCase(), { size: 12, weight: 800, anchor: 'middle', fill: '#dfe3ea', spacing: 3 })}</g>`;
  const finStack = (x, w, y0, h) => `<rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="8" fill="url(#gSteel)" stroke="#69707d"/><rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="8" fill="url(#pFinsH)" opacity=".8"/><rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="8" fill="url(#gSheen)" opacity=".4"/>`;
  const fanSize = double ? 262 : 250;
  const back = double
    ? `${finStack(x0 - 14, bw - 40, topY - 12, finBottom - topY - 20)}${plate(x0 - 6, bw - 56, topY - 22)}${squareFan(x0 + 6, topY + 58, fanSize - 20, brand, accent, 3.6, true)}`
    : '';
  const frontX = double ? x0 + bw - fanSize - 6 : x0 + (bw - fanSize) / 2;
  return `${floorShadow(400, 500, 280, 26, 0.7)}
  <g filter="url(#fDrop)">
    <rect x="${x0 - 30}" y="${finBottom + 22}" width="${bw + 60}" height="14" rx="5" fill="url(#gDarkV)" stroke="#5b6270"/>
    <rect x="${x0 + 40}" y="${finBottom + 4}" width="${bw - 80}" height="26" rx="4" fill="url(#gCopper)" stroke="#5a2d0b"/>
    ${pipesSvg}
    ${back}
    ${finStack(x0, bw, topY + (double ? 6 : 0), finBottom - topY - (double ? 6 : 0))}
    ${plate(x0 + 10, bw - 20, topY - 10 + (double ? 6 : 0))}
    ${squareFan(frontX, topY + 80, fanSize, brand, accent, 3.0)}
  </g>`;
}

function aio(p, accent) {
  const rad = p.specs.radiator_mm;
  const n = rad === 360 ? 3 : 2;
  const r = rad === 360 ? 76 : rad === 280 ? 104 : 92;
  const radW = n * (2 * r + 6) + 46;
  const radH = 2 * r + 40;
  const pumpR = 74;
  const totalW = radW + 30 + pumpR * 2 + 40;
  const sc = Math.min(1, 720 / totalW);
  const x0 = (800 - totalW * sc) / 2;
  const cy = 280;
  let fans = '';
  for (let i = 0; i < n; i += 1) {
    const fx = 14 + i * (2 * r + 6);
    fans += squareFan(fx, (radH - (2 * r + 6)) / 2, 2 * r + 6, p.brand, accent, 2.4 + i * 0.3, i % 2 === 1).replace('FAN_STYLE', '');
  }
  const px = radW + 30 + pumpR + 10;
  const py = radH / 2;
  const tube = (dy) => {
    const d = `M${radW - 4} ${radH / 2 + dy} C${radW + 70} ${radH / 2 + dy}, ${px - 130} ${py + dy * 1.4 - 10}, ${px - pumpR * 0.7} ${py + dy * 0.8}`;
    return `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="20" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#2a2e37" stroke-width="16" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round" transform="translate(-2 -3)"/>`;
  };
  return `${floorShadow(400, cy + radH / 2 + 50, 300, 24, 0.65)}
  <g transform="translate(${x0.toFixed(1)} ${(cy - (radH * sc) / 2).toFixed(1)}) scale(${sc.toFixed(3)})" filter="url(#fDrop)">
    <rect x="0" y="0" width="${radW}" height="${radH}" rx="14" fill="url(#gDarkV)" stroke="#5b6270" stroke-width="2"/>
    <rect x="0" y="0" width="${radW}" height="9" rx="4" fill="url(#gSteelV)"/><rect x="0" y="0" width="${radW}" height="9" rx="4" fill="url(#pFins)"/>
    <rect x="0" y="${radH - 9}" width="${radW}" height="9" rx="4" fill="url(#gSteelV)"/><rect x="0" y="${radH - 9}" width="${radW}" height="9" rx="4" fill="url(#pFins)"/>
    <rect x="${radW - 22}" y="0" width="22" height="${radH}" rx="8" fill="url(#gDark)" stroke="#6a7282"/>
    ${fans}
    ${tube(-26)}${tube(26)}
    <g>
      <rect x="${px - pumpR * 1.12}" y="${py - pumpR * 1.12}" width="${pumpR * 2.24}" height="${pumpR * 2.24}" rx="16" fill="url(#gDark)" stroke="#6a7282" stroke-width="2"/>
      ${[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => screw(px + a * pumpR * 0.93, py + b * pumpR * 0.93, 6)).join('')}
      <circle cx="${px}" cy="${py}" r="${pumpR}" fill="#06070a" stroke="#808898" stroke-width="3"/>
      <circle cx="${px}" cy="${py}" r="${pumpR * 0.86}" fill="none" stroke="${accent}" stroke-width="5" class="pulse" filter="url(#fGlow)" style="--d:4s"/>
      <circle cx="${px}" cy="${py}" r="${pumpR * 0.7}" fill="url(#gHub)"/>
      <circle cx="${px}" cy="${py}" r="${pumpR * 0.52}" fill="none" stroke="${accent}" stroke-opacity=".45"/>
      <circle cx="${px}" cy="${py}" r="${pumpR * 0.34}" fill="none" stroke="${accent}" stroke-opacity=".3"/>
      ${text(px, py + 7, p.brand.toUpperCase().slice(0, 9), { size: 17, weight: 800, anchor: 'middle', fill: '#f2f4f8', spacing: 2 })}
      <path d="M${px - pumpR * 0.6} ${py - pumpR * 0.55} A${pumpR * 0.8} ${pumpR * 0.8} 0 0 1 ${px + pumpR * 0.55} ${py - pumpR * 0.6}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="6" stroke-linecap="round"/>
    </g>
  </g>`;
}

export function coolerArt(p) {
  const accent = accentOf(p.brand);
  return `<defs>${COPPER_H}</defs>${p.specs.cooler_type === 'AIO' ? aio(p, accent) : airTower(p, accent)}
  <ellipse cx="400" cy="290" rx="300" ry="200" fill="${darken(accent, 0.1)}" opacity=".07" filter="url(#fSoft)"/>`;
}
