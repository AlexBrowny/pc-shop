import {
  text, floorShadow, accentOf, screw, lighten, darken,
} from './common.js';

const SIZE = { ATX: [520, 416], mATX: [416, 416], ITX: [338, 338] };

export function motherboardArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const ff = SIZE[s.form_factor] ? s.form_factor : 'ATX';
  const [W, H] = SIZE[ff];
  const itx = ff === 'ITX';
  const x0 = 400 - W / 2;
  const y0 = 292 - H / 2;
  const f = (v) => v.toFixed(1);
  const parts = [];

  // плата
  parts.push(`<rect width="${W}" height="${H}" rx="10" fill="url(#gPcb)" stroke="#3a414d" stroke-width="2"/>`);
  parts.push(`<rect width="${W}" height="${H}" rx="10" fill="url(#pTraces)"/>`);
  parts.push(`<rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="8" fill="none" stroke="#fff" stroke-opacity=".07"/>`);

  // питание CPU 8-pin и VRM-радиаторы
  parts.push(`<rect x="${f(W * 0.07)}" y="0" width="${f(W * 0.08)}" height="${f(H * 0.04)}" rx="2" fill="#0b0c0f" stroke="#444a55"/>`);
  parts.push(`<rect x="${f(W * 0.18)}" y="${f(H * 0.05)}" width="${f(W * 0.065)}" height="${f(H * (itx ? 0.36 : 0.46))}" rx="6" fill="url(#gDark)" stroke="#555c6a"/>`);
  parts.push(`<rect x="${f(W * 0.18)}" y="${f(H * 0.05)}" width="${f(W * 0.065)}" height="${f(H * (itx ? 0.36 : 0.46))}" rx="6" fill="url(#pFins)"/>`);
  parts.push(`<rect x="${f(W * 0.18)}" y="${f(H * 0.03)}" width="${f(W * 0.44)}" height="${f(H * 0.075)}" rx="6" fill="url(#gDark)" stroke="#555c6a"/>`);
  parts.push(`<rect x="${f(W * 0.18)}" y="${f(H * 0.03)}" width="${f(W * 0.44)}" height="${f(H * 0.075)}" rx="6" fill="url(#pFinsH)"/>`);
  parts.push(`<rect x="${f(W * 0.2)}" y="${f(H * 0.095)}" width="${f(W * 0.4)}" height="3" rx="1.5" fill="${accent}" opacity=".85"/>`);

  // кожух задней панели
  parts.push(`<rect x="${f(W * 0.015)}" y="${f(H * 0.06)}" width="${f(W * 0.15)}" height="${f(H * 0.5)}" rx="8" fill="url(#gDarkV)" stroke="#586070"/>`);
  parts.push(`<rect x="${f(W * 0.015)}" y="${f(H * 0.06)}" width="${f(W * 0.15)}" height="${f(H * 0.5)}" rx="8" fill="url(#gSheen)" opacity=".3"/>`);
  parts.push(`<rect x="${f(W * 0.15)}" y="${f(H * 0.1)}" width="3" height="${f(H * 0.42)}" rx="1.5" fill="${accent}"/>`);
  parts.push(`<g transform="translate(${f(W * 0.09)} ${f(H * 0.31)}) rotate(-90)">${text(0, 0, p.brand.toUpperCase(), { size: W * 0.05, weight: 800, anchor: 'middle', fill: '#e7eaf0', spacing: 3, opacity: 0.9 })}</g>`);
  if (s.wifi) parts.push(`<circle cx="${f(W * 0.045)}" cy="${f(H * 0.095)}" r="5" fill="url(#gGold)"/><circle cx="${f(W * 0.085)}" cy="${f(H * 0.095)}" r="5" fill="url(#gGold)"/>`);

  // сокет процессора
  const sx = W * 0.4;
  const sy = H * (itx ? 0.3 : 0.3);
  const ss = W * 0.2;
  parts.push(`<rect x="${f(sx - ss / 2 - 8)}" y="${f(sy - ss / 2 - 8)}" width="${f(ss + 16)}" height="${f(ss + 16)}" rx="6" fill="#0c0d10" stroke="#3a414d"/>`);
  parts.push(`<rect x="${f(sx - ss / 2)}" y="${f(sy - ss / 2)}" width="${f(ss)}" height="${f(ss)}" rx="3" fill="url(#gSteelV)" stroke="#2b2f38"/>`);
  parts.push(`<rect x="${f(sx - ss / 2 + 8)}" y="${f(sy - ss / 2 + 8)}" width="${f(ss - 16)}" height="${f(ss - 16)}" fill="#14171d"/>`);
  parts.push(`<path d="M${f(sx - ss / 2 + 8)} ${f(sy - ss / 2 + 8)}h${f(ss - 16)}M${f(sx - ss / 2 + 8)} ${f(sy)}h${f(ss - 16)}M${f(sx)} ${f(sy - ss / 2 + 8)}v${f(ss - 16)}" stroke="#2a3038" stroke-width="1"/>`);
  parts.push(text(sx, sy + ss / 2 + 22, s.socket, { size: W * 0.03, anchor: 'middle', fill: '#aab2c0', opacity: 0.7, spacing: 2 }));

  // слоты DIMM
  const slots = Math.min(s.ram_slots, 4);
  const dx = W * (itx ? 0.66 : 0.64);
  for (let i = 0; i < slots; i += 1) {
    const x = dx + i * (W * 0.037);
    const alt = i % 2 === 0;
    parts.push(`<rect x="${f(x)}" y="${f(H * 0.03)}" width="${f(W * 0.026)}" height="${f(H * (itx ? 0.64 : 0.6))}" rx="3" fill="${alt ? 'url(#gDark)' : '#0d0e12'}" stroke="${alt ? accent : '#444a55'}" stroke-opacity="${alt ? 0.8 : 1}"/>`);
    parts.push(`<rect x="${f(x + W * 0.005)}" y="${f(H * 0.03 + 4)}" width="${f(W * 0.016)}" height="9" rx="2" fill="#d9dde5"/><rect x="${f(x + W * 0.005)}" y="${f(H * (itx ? 0.67 : 0.63) - 12)}" width="${f(W * 0.016)}" height="9" rx="2" fill="#d9dde5"/>`);
  }

  // 24-pin и SATA справа
  parts.push(`<rect x="${f(W * 0.935)}" y="${f(H * 0.3)}" width="${f(W * 0.05)}" height="${f(H * 0.22)}" rx="3" fill="#e8e9ec" stroke="#8a8f99"/>`);
  for (let i = 0; i < 12; i += 1) parts.push(`<rect x="${f(W * 0.945)}" y="${f(H * 0.31 + i * (H * 0.017))}" width="${f(W * 0.03)}" height="5" rx="1" fill="#2a2d33"/>`);
  const sata = Math.min(Math.max(s.sata_ports, 2), 6);
  for (let i = 0; i < sata; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    parts.push(`<rect x="${f(W * (0.86 + col * 0.066))}" y="${f(H * (itx ? 0.62 : 0.62) + row * (H * 0.05))}" width="${f(W * 0.056)}" height="${f(H * 0.036)}" rx="2" fill="#0b0c0f" stroke="#4a505c"/><rect x="${f(W * (0.865 + col * 0.066))}" y="${f(H * (itx ? 0.62 : 0.62) + row * (H * 0.05) + 6)}" width="${f(W * 0.04)}" height="3" fill="url(#gGold)"/>`);
  }

  // M.2 с радиаторами
  const m2 = Math.min(Math.max(s.m2_slots, 1), itx ? 1 : 3);
  for (let i = 0; i < m2; i += 1) {
    const y = H * (itx ? 0.5 : 0.49) + i * (H * 0.07);
    parts.push(`<rect x="${f(W * 0.3)}" y="${f(y)}" width="${f(W * 0.3)}" height="${f(H * 0.052)}" rx="4" fill="url(#gDark)" stroke="#656d7c"/>`);
    parts.push(`<rect x="${f(W * 0.3)}" y="${f(y + H * 0.04)}" width="${f(W * 0.3)}" height="3" rx="1.5" fill="${accent}" opacity=".9"/>`);
    parts.push(`<circle cx="${f(W * 0.305)}" cy="${f(y + H * 0.026)}" r="3.5" fill="url(#gSteelV)"/>`);
  }

  // PCIe x16 (с «броне» для PCIe 5.0), остальные слоты, батарейка
  const gen5 = /5/.test(s.pcie);
  const pcieY = H * (itx ? 0.78 : 0.66);
  const armor = gen5 ? `<rect x="${f(W * 0.07)}" y="${f(pcieY - 7)}" width="${f(W * 0.56)}" height="${f(H * 0.05 + 14)}" rx="5" fill="url(#gSteel)" stroke="#3a3f49"/>` : '';
  parts.push(`${armor}<rect x="${f(W * 0.085)}" y="${f(pcieY)}" width="${f(W * 0.53)}" height="${f(H * 0.05)}" rx="3" fill="#0a0b0e" stroke="#4b525f"/>`);
  parts.push(`<rect x="${f(W * 0.1)}" y="${f(pcieY + H * 0.018)}" width="${f(W * 0.5)}" height="${f(H * 0.014)}" fill="url(#gGold)" opacity=".65"/>`);
  if (!itx) {
    parts.push(`<rect x="${f(W * 0.085)}" y="${f(H * 0.78)}" width="${f(W * 0.28)}" height="${f(H * 0.036)}" rx="3" fill="#0a0b0e" stroke="#4b525f"/>`);
    parts.push(`<rect x="${f(W * 0.085)}" y="${f(H * 0.87)}" width="${f(W * 0.28)}" height="${f(H * 0.036)}" rx="3" fill="#0a0b0e" stroke="#4b525f"/>`);
    parts.push(`<circle cx="${f(W * 0.52)}" cy="${f(H * 0.86)}" r="${f(W * 0.03)}" fill="url(#gSteel)" stroke="#555"/><circle cx="${f(W * 0.52)}" cy="${f(H * 0.86)}" r="${f(W * 0.018)}" fill="#c5c9d1"/>`);
    for (let i = 0; i < 5; i += 1) parts.push(`<circle cx="${f(W * (0.4 + i * 0.026))}" cy="${f(H * 0.945)}" r="4.5" fill="url(#gGold)" opacity=".9"/>`);
  }

  // чипсет
  const cs = W * 0.15;
  const cx = W * (itx ? 0.6 : 0.69);
  const cy = H * (itx ? 0.62 : 0.74);
  parts.push(`<rect x="${f(cx)}" y="${f(cy)}" width="${f(cs)}" height="${f(cs)}" rx="8" fill="url(#gDark)" stroke="${accent}" stroke-width="2"/>`);
  parts.push(`<rect x="${f(cx)}" y="${f(cy)}" width="${f(cs)}" height="${f(cs)}" rx="8" fill="url(#pFins)"/>`);
  parts.push(text(cx + cs / 2, cy + cs / 2 + 6, s.chipset, { size: cs * 0.24, weight: 800, anchor: 'middle', fill: '#f0f2f6', spacing: 1 }));

  // подпись модели
  parts.push(text(W * 0.5, H * 0.985, `${p.brand} ${p.name}`.toUpperCase(), { size: W * 0.026, weight: 700, anchor: 'middle', fill: lighten(accent, 0.3), opacity: 0.75, spacing: 2.5 }));

  // винты
  for (const [x, y] of [[0.03, 0.03], [0.97, 0.03], [0.03, 0.97], [0.97, 0.97], [0.62, 0.66], [0.3, 0.62], [0.62, 0.4]]) parts.push(screw(W * x, H * y, 6));

  return `${floorShadow(400, y0 + H + 14, W * 0.6, 26, 0.6)}
  <g transform="translate(${f(x0)} ${f(y0)})" filter="url(#fDrop)">${parts.join('\n')}
    <rect width="${W}" height="${H}" rx="10" fill="url(#gSheen)" opacity=".35"/>
  </g>
  <ellipse cx="400" cy="292" rx="${f(W * 0.55)}" ry="${f(H * 0.5)}" fill="${darken(accent, 0.1)}" opacity=".07" filter="url(#fSoft)"/>`;
}
