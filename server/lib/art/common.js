// Общие инструменты для векторных «рендеров» комплектующих: цвета, градиенты, вентилятор, текст.
// Картинки автономные (SVG как <img>): CSS-анимации внутри работают, скриптов нет.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const BRAND_COLORS = {
  Intel: '#1c8cff', AMD: '#ff4a3d', NVIDIA: '#7ed321', ASUS: '#27b6ff', MSI: '#ff3b3b', Gigabyte: '#ff8a2a',
  ASRock: '#3d7bff', Kingston: '#e5303a', Corsair: '#ffc933', 'G.Skill': '#ff3b3b', Samsung: '#2f6bff', WD: '#2aa8ee',
  Crucial: '#ff8a1f', Seagate: '#5dc23b', Deepcool: '#19d3c5', 'Cooler Master': '#9a5bff', NZXT: '#b479ff', 'Lian Li': '#d6dae2',
  'Fractal Design': '#9aa3b2', Hyte: '#ff6fb0', Montech: '#ff4f6d', Noctua: '#c98a4b', Arctic: '#2aa3ff', Thermalright: '#ff4a3d',
  Seasonic: '#e0b02a', 'be quiet!': '#9aa3b2',
};
export const CASE_BODY = { Black: '#1d2029', White: '#e9ecf1', Charcoal: '#3b4252' };
export const accentOf = (brand) => BRAND_COLORS[brand] ?? '#ff7a2f';

// ───────── Цвета ─────────
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (rgb) => `#${rgb.map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a, b, t) => { const [x, y] = [toRgb(a), toRgb(b)]; return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const lighten = (hex, t) => mix(hex, '#ffffff', t);
export const darken = (hex, t) => mix(hex, '#000000', t);

/** Детерминированное «случайное» число из строки — для гравировок и серийников. */
export function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const serial = (seed, len = 10) => {
  let h = hash(seed);
  let out = '';
  for (let i = 0; i < len; i += 1) { out += 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'[h % 33]; h = Math.imul(h ^ (h >>> 7), 2654435761) >>> 0; }
  return out;
};

// ───────── Фон, градиенты, фильтры ─────────
export function defs(accent) {
  const light = lighten(accent, 0.45);
  const dark = darken(accent, 0.45);
  return `<defs>
  <radialGradient id="bgGlow" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="${accent}" stop-opacity="0.34"/><stop offset="0.55" stop-color="${accent}" stop-opacity="0.07"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1e26"/><stop offset="0.6" stop-color="#101218"/><stop offset="1" stop-color="#08090d"/></linearGradient>
  <linearGradient id="gSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9097a4"/><stop offset="0.18" stop-color="#eef1f5"/><stop offset="0.42" stop-color="#b3b9c4"/><stop offset="0.7" stop-color="#f4f6f9"/><stop offset="1" stop-color="#868d9a"/></linearGradient>
  <linearGradient id="gSteelV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="0.5" stop-color="#b3b9c4"/><stop offset="1" stop-color="#7d8493"/></linearGradient>
  <linearGradient id="gDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#454b58"/><stop offset="0.5" stop-color="#242830"/><stop offset="1" stop-color="#14161b"/></linearGradient>
  <linearGradient id="gDarkV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b404c"/><stop offset="1" stop-color="#15171d"/></linearGradient>
  <linearGradient id="gBlack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#23262e"/><stop offset="1" stop-color="#0a0b0e"/></linearGradient>
  <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset="0.5" stop-color="#d9a634"/><stop offset="1" stop-color="#9a6d12"/></linearGradient>
  <linearGradient id="gCopper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc08a"/><stop offset="0.5" stop-color="#c26a26"/><stop offset="1" stop-color="#7a3d10"/></linearGradient>
  <linearGradient id="gAccent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="gAccentH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset="0.5" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="gPcb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#242a33"/><stop offset="1" stop-color="#11151b"/></linearGradient>
  <linearGradient id="gGreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c7a5a"/><stop offset="1" stop-color="#14402f"/></linearGradient>
  <linearGradient id="gSheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.08"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.16"/></linearGradient>
  <linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe2ff" stop-opacity="0.34"/><stop offset="0.45" stop-color="#cfe2ff" stop-opacity="0.04"/><stop offset="1" stop-color="#cfe2ff" stop-opacity="0.12"/></linearGradient>
  <radialGradient id="gHub" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#4a505d"/><stop offset="1" stop-color="#0c0d11"/></radialGradient>
  <filter id="fSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="fDrop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000" flood-opacity="0.55"/></filter>
  <pattern id="pGrid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity="0.035"/></pattern>
  <pattern id="pHex" width="14" height="12" patternUnits="userSpaceOnUse"><path d="M3.5 0 10.5 0 14 6 10.5 12 3.5 12 0 6Z" fill="none" stroke="#000" stroke-opacity="0.55" stroke-width="1.6"/></pattern>
  <pattern id="pFins" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="3" height="6" fill="#000" fill-opacity="0.32"/></pattern>
  <pattern id="pFinsH" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="3" fill="#000" fill-opacity="0.32"/></pattern>
  <pattern id="pTraces" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M0 12H34L44 22H60M0 40H18L28 50H60M12 0V28M46 0V14L52 20V60" fill="none" stroke="#fff" stroke-opacity="0.045" stroke-width="1.4"/></pattern>
  <path id="blade" d="M0.19 0.05C0.34-0.28 0.76-0.38 0.97-0.1C0.82-0.01 0.56 0.1 0.19 0.15Z"/>
  <style>
    .spin{animation:spin var(--d,3.2s) linear infinite}
    .spinr{animation:spin var(--d,3.2s) linear infinite reverse}
    .pulse{animation:pulse var(--d,3.4s) ease-in-out infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
    @media (prefers-reduced-motion:reduce){.spin,.spinr,.pulse{animation:none}}
  </style>
</defs>`;
}

export const stage = (body) => `<rect width="800" height="600" fill="url(#bg)"/>
<rect width="800" height="600" fill="url(#pGrid)"/>
<ellipse cx="400" cy="300" rx="420" ry="300" fill="url(#bgGlow)"/>
${body}`;

/** Мягкая тень-эллипс под предметом. */
export const floorShadow = (cx, cy, rx, ry, opacity = 0.6) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${opacity}" filter="url(#fSoft)"/>`;

export const text = (x, y, str, { size = 20, weight = 700, fill = '#fff', anchor = 'start', spacing = 0, opacity = 1, italic = false, extra = '' } = {}) =>
  `<text x="${x}" y="${y}" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}"${italic ? ' font-style="italic"' : ''} ${extra}>${esc(str)}</text>`;

export const rect = (x, y, w, h, fill, { rx = 0, stroke = '', sw = 1, opacity = 1, extra = '' } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${opacity !== 1 ? ` opacity="${opacity}"` : ''} ${extra}/>`;

export const screw = (x, y, r = 7) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#gSteelV)" stroke="#000" stroke-opacity=".5"/><path d="M${x - r * 0.6} ${y}H${x + r * 0.6}M${x} ${y - r * 0.6}V${y + r * 0.6}" stroke="#000" stroke-opacity=".55" stroke-width="${r * 0.22}"/>`;

/**
 * Вентилятор (вид спереди). r — радиус, ring — цвет RGB-кольца (или null), dur — период оборота.
 * Лопасти рисуются в единичных координатах и масштабируются, вращается только крыльчатка.
 */
export function fan({ cx, cy, r, blades = 9, color = '#9aa3b2', ring = null, dur = 3.2, reverse = false, hub = 'gHub', frame = true }) {
  const step = 360 / blades;
  const bl = Array.from({ length: blades }, (_, i) => `<use href="#blade" transform="rotate(${(step * i).toFixed(1)})"/>`).join('');
  return `<g transform="translate(${cx} ${cy}) scale(${r})">
  ${frame ? '<circle r="1.04" fill="#07080b" stroke="#2a2e38" stroke-width="0.05"/>' : '<circle r="1" fill="#07080b"/>'}
  ${ring ? `<circle r="0.98" fill="none" stroke="${ring}" stroke-width="0.055" class="pulse" filter="url(#fGlow)" style="--d:${(dur * 1.3).toFixed(1)}s"/>` : ''}
  <g class="${reverse ? 'spinr' : 'spin'}" style="--d:${dur}s" fill="${color}" fill-opacity="0.92" stroke="#000" stroke-opacity="0.35" stroke-width="0.012">${bl}</g>
  <circle r="0.24" fill="url(#${hub})" stroke="#000" stroke-opacity=".6" stroke-width="0.02"/>
  <circle r="0.1" fill="#000" fill-opacity=".55"/>
</g>`;
}

/** Ряд (или столбец) золотых контактов. */
export function goldPins(x, y, count, w, h, gap, vertical = false) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    out += vertical
      ? `<rect x="${x}" y="${y + i * (h + gap)}" width="${w}" height="${h}" fill="url(#gGold)"/>`
      : `<rect x="${x + i * (w + gap)}" y="${y}" width="${w}" height="${h}" fill="url(#gGold)"/>`;
  }
  return out;
}
