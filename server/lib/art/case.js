import {
  text, floorShadow, accentOf, fan, lighten, darken, CASE_BODY,
} from './common.js';

const KD = 0.62; // ослабление глубины (боковая стенка уходит влево)
const KH = 0.22; // подъём дальнего края боковой стенки

function styleOf(p) {
  const n = p.name.toLowerCase();
  if (n.includes('north')) return 'wood';
  if (n.includes('y60')) return 'glass';
  if (n.includes('nr200')) return 'itx';
  if (n.includes('216') || n.includes('903')) return 'mesh-fans';
  return 'mesh';
}

/** Внутренности (вид через стекло) в плоских координатах: x — от задней стенки (0) к передней (D), y — вниз. */
function interior(p, D, H, accent, itx) {
  const parts = [];
  parts.push(`<rect width="${D}" height="${H}" fill="#07080c"/>`);
  parts.push(`<rect x="8" y="8" width="${D - 16}" height="${H - 16}" fill="url(#gBlack)" opacity=".85"/>`);
  const bx = itx ? 60 : 64;
  const by = 28;
  const bw = itx ? 150 : 214;
  const bh = itx ? 150 : 171;
  // материнская плата
  parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="url(#gPcb)" stroke="#434a57"/>`);
  parts.push(`<rect x="${bx + 6}" y="${by + 6}" width="${bw * 0.18}" height="${bh * 0.55}" rx="3" fill="url(#gDark)" stroke="#59606e"/>`);
  parts.push(`<rect x="${bx + 6}" y="${by + 4}" width="${bw * 0.55}" height="10" rx="3" fill="url(#gDark)" stroke="#59606e"/>`);
  // слоты ОЗУ с подсветкой
  for (let i = 0; i < 4; i += 1) {
    const x = bx + bw * 0.62 + i * 12;
    parts.push(`<rect x="${x}" y="${by + 8}" width="8" height="${bh * 0.5}" rx="2" fill="#0b0c10" stroke="#474e5b"/>`);
    if (i % 2 === 1) parts.push(`<rect x="${x + 1}" y="${by + 10}" width="6" height="${bh * 0.46}" rx="2" fill="${accent}" class="pulse" filter="url(#fGlow)" style="--d:${3 + i * 0.3}s"/>`);
  }
  // кулер процессора (СЖО) с подсветкой
  const px = bx + bw * 0.36;
  const py = by + bh * 0.3;
  parts.push(`<circle cx="${px}" cy="${py}" r="25" fill="#0a0b0f" stroke="#555c68" stroke-width="2"/><circle cx="${px}" cy="${py}" r="19" fill="none" stroke="${accent}" stroke-width="3" class="pulse" filter="url(#fGlow)"/>`);
  parts.push(`<circle cx="${px}" cy="${py}" r="10" fill="url(#gHub)"/>`);
  // видеокарта
  const gy = by + bh + 14;
  parts.push(`<rect x="${bx - 6}" y="${gy}" width="${bw + 40}" height="40" rx="5" fill="url(#gDarkV)" stroke="#636b79" stroke-width="1.5"/>`);
  parts.push(`<rect x="${bx + 6}" y="${gy + 5}" width="${bw + 14}" height="3" rx="1.5" fill="${accent}" class="pulse" filter="url(#fGlow)"/>`);
  parts.push(`<rect x="${bx + 20}" y="${gy + 18}" width="${bw - 20}" height="12" rx="2" fill="url(#pFins)" opacity=".8"/>`);
  // шторка блока питания
  const sy = H - 104;
  parts.push(`<rect x="${itx ? 70 : 92}" y="${sy}" width="${D - (itx ? 150 : 186)}" height="${H - sy - 14}" rx="6" fill="url(#gDarkV)" stroke="#575f6d"/>`);
  parts.push(`<rect x="${itx ? 82 : 104}" y="${sy + 16}" width="${D - (itx ? 174 : 210)}" height="3" rx="1.5" fill="${accent}" class="pulse" filter="url(#fGlow)"/>`);
  parts.push(`<rect x="14" y="${sy + 14}" width="${itx ? 48 : 70}" height="${H - sy - 28}" rx="4" fill="#12141a" stroke="#3b414d"/>`);
  parts.push(text(itx ? 94 : 126, sy + 52, (p.brand || '').toUpperCase(), { size: 14, weight: 800, fill: '#cfd4de', spacing: 3, opacity: 0.8 }));
  // вентиляторы: задний и передние
  parts.push(fan({ cx: 36, cy: 70, r: 28, blades: 9, color: '#d8dde6', ring: accent, dur: 2.4 }));
  const fx = D - 44;
  const count = itx ? 2 : 3;
  for (let i = 0; i < count; i += 1) {
    const cy = itx ? 80 + i * 110 : 62 + i * 105;
    parts.push(fan({ cx: fx, cy, r: 40, blades: 11, color: '#d8dde6', ring: accent, dur: 2.9 + i * 0.4, reverse: i % 2 === 1 }));
  }
  return parts.join('\n');
}

function frontFace(p, W, H, body, accent, style) {
  const parts = [];
  const edge = body === CASE_BODY.White ? '#aeb4c0' : '#4b5260';
  parts.push(`<rect width="${W}" height="${H}" rx="6" fill="${body}" stroke="${edge}" stroke-width="2"/>`);
  parts.push(`<rect x="12" y="34" width="${W - 24}" height="${H - 56}" rx="4" fill="#06070a"/>`);
  if (style === 'wood') {
    for (let i = 0; i < 14; i += 1) {
      const x = 14 + i * ((W - 28) / 14);
      parts.push(`<rect x="${x.toFixed(1)}" y="36" width="${((W - 28) / 14 - 3).toFixed(1)}" height="${H - 60}" rx="2" fill="url(#gWood)"/>`);
    }
  } else if (style === 'glass') {
    parts.push(fan({ cx: W / 2, cy: H * 0.3, r: W * 0.3, blades: 11, color: '#d8dde6', ring: accent, dur: 3 }));
    parts.push(fan({ cx: W / 2, cy: H * 0.66, r: W * 0.3, blades: 11, color: '#d8dde6', ring: accent, dur: 3.4, reverse: true }));
    parts.push(`<rect x="12" y="34" width="${W - 24}" height="${H - 56}" rx="4" fill="url(#gGlass)"/>`);
  } else {
    const n = style === 'mesh-fans' ? 3 : 2;
    for (let i = 0; i < n; i += 1) {
      parts.push(fan({ cx: W / 2, cy: 34 + ((H - 56) / n) * (i + 0.5), r: Math.min(W * 0.36, (H - 56) / n / 2 - 4), blades: 11, color: '#cfd5df', ring: accent, dur: 3 + i * 0.3, reverse: i === 1 }));
    }
    parts.push(`<rect x="12" y="34" width="${W - 24}" height="${H - 56}" rx="4" fill="url(#pHex)" opacity="0.9"/>`);
  }
  // верхняя кромка: кнопка питания и порты
  parts.push(`<circle cx="${W - 26}" cy="17" r="6" fill="#0c0d10" stroke="${accent}" stroke-width="2"/>`);
  parts.push(`<rect x="22" y="12" width="14" height="6" rx="2" fill="#0c0d10"/><rect x="42" y="12" width="14" height="6" rx="2" fill="#0c0d10"/>`);
  parts.push(`<rect width="${W}" height="${H}" rx="6" fill="url(#gSheen)" opacity=".22"/>`);
  return parts.join('\n');
}

export function caseArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const itx = !s.form_factors.includes('ATX');
  const style = styleOf(p);
  const body = CASE_BODY[s.color] ?? CASE_BODY.Black;
  const W = itx ? 150 : 182;
  const H = itx ? 292 : 380;
  const D = itx ? 330 : 356;
  const sx = KD * D;
  const sy = KH * D;
  const light = body === CASE_BODY.White;
  const top = light ? '#f6f8fb' : lighten(body, 0.18);
  const sideFrame = body;
  const edge = light ? '#aeb4c0' : '#4b5260';
  const glassSide = style !== 'itx';
  const sc = Math.min(1.12, 500 / (H + sy));
  // габарит композиции: x ∈ [-sx, W], y ∈ [-sy, H + 10]; центрируем его на холсте
  const tx = 400 - ((W - sx) / 2) * sc;
  const ty = 292 - ((H + 10 - sy) / 2) * sc;
  const gWood = '<linearGradient id="gWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c79a62"/><stop offset="0.5" stop-color="#a87a45"/><stop offset="1" stop-color="#8a5f33"/></linearGradient>';

  return `<defs>${gWood}</defs>
  ${floorShadow(400, ty + (H + 10) * sc, 280, 30, 0.75)}
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${sc.toFixed(3)})" filter="url(#fDrop)">
    <!-- ножки -->
    <rect x="12" y="${H}" width="34" height="10" rx="3" fill="#0c0d10"/><rect x="${W - 46}" y="${H}" width="34" height="10" rx="3" fill="#0c0d10"/>
    <rect x="${-sx + 40}" y="${H - sy}" width="34" height="8" rx="3" fill="#0c0d10"/>
    <!-- боковая стенка со стеклом -->
    <g transform="matrix(${KD} ${KH} 0 1 ${-sx} ${-sy})">
      <rect width="${D}" height="${H}" fill="${sideFrame}" stroke="${edge}" stroke-width="2"/>
      ${glassSide
    ? `<g transform="translate(14 14)"><svg width="${D - 28}" height="${H - 28}" viewBox="0 0 ${D} ${H}" preserveAspectRatio="none">${interior(p, D, H, accent, itx)}</svg></g>
      <rect x="14" y="14" width="${D - 28}" height="${H - 28}" fill="url(#gGlass)"/>
      <path d="M${D * 0.1} ${H - 14} L${D * 0.5} 14 L${D * 0.64} 14 L${D * 0.24} ${H - 14} Z" fill="#fff" opacity=".07"/>`
    : `<rect x="14" y="14" width="${D - 28}" height="${H - 28}" rx="4" fill="${light ? '#f4f6fa' : lighten(body, 0.08)}"/><rect x="14" y="14" width="${D - 28}" height="${H - 28}" fill="url(#pHex)" opacity=".85"/><rect x="14" y="14" width="${D - 28}" height="${H - 28}" fill="url(#gSheen)" opacity=".5"/>`}
    </g>
    <!-- верхняя панель -->
    <polygon points="0,0 ${W},0 ${W - sx},${-sy} ${-sx},${-sy}" fill="${top}" stroke="${edge}" stroke-width="2"/>
    <g transform="matrix(1 0 ${-KD} ${-KH} 0 0)">
      <rect x="${W * 0.1}" y="${D * 0.12}" width="${W * 0.8}" height="${D * 0.5}" rx="6" fill="#000" opacity=".16"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="${W * 0.14}" y="${D * 0.15 + i * (D * 0.04)}" width="${W * 0.72}" height="3" rx="1.5" fill="#000" opacity=".3"/>`).join('')}
    </g>
    <!-- передняя панель -->
    ${frontFace(p, W, H, body, accent, style)}
    ${text(W / 2, H - 12, p.brand.toUpperCase(), { size: 13, weight: 800, anchor: 'middle', fill: light ? '#555d6b' : '#aab2c0', spacing: 4, opacity: 0.85 })}
  </g>`;
}
