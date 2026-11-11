import {
  text, floorShadow, accentOf, lighten, darken, screw, goldPins, serial,
} from './common.js';

const capText = (gb) => (gb >= 1000 ? `${gb / 1000} TB` : `${gb} GB`);

function nvme(p, accent) {
  const s = p.specs;
  const w = 600;
  const h = 150;
  const cooled = s.read_mbs >= 5000;
  const chips = [0, 1].map((i) => `<rect x="${170 + i * 130}" y="34" width="104" height="82" rx="4" fill="#0b0c10" stroke="#2c323c"/>${text(222 + i * 130, 82, 'NAND', { size: 14, anchor: 'middle', fill: '#6d7585', weight: 700, spacing: 2 })}`).join('');
  return `<g transform="translate(100 225) rotate(-3 300 75)" filter="url(#fDrop)">
    <rect width="${w}" height="${h}" rx="10" fill="#1d5a43" stroke="#0b261c" stroke-width="2"/>
    <rect x="3" y="3" width="${w - 6}" height="${h - 6}" rx="8" fill="none" stroke="#7ad7ae" stroke-opacity=".25"/>
    ${goldPins(8, 22, 20, 16, 3.6, 1.6, true)}
    <path d="M${w - 10} 20 a18 18 0 0 1 0 36" fill="#0e3023"/>
    <circle cx="${w - 22}" cy="${h / 2}" r="12" fill="#0a1d15" stroke="#6cc9a0" stroke-opacity=".4"/>
    <rect x="52" y="44" width="58" height="62" rx="4" fill="#0b0c10" stroke="#2c323c"/>
    ${text(81, 80, 'CTRL', { size: 13, anchor: 'middle', fill: '#6d7585', weight: 700, spacing: 2 })}
    ${chips}
    <rect x="440" y="44" width="62" height="62" rx="4" fill="#0b0c10" stroke="#2c323c"/>
    ${cooled ? `<g><rect x="42" y="14" width="${w - 120}" height="${h - 28}" rx="8" fill="url(#gDark)" stroke="#6a7282" stroke-width="1.5"/><rect x="42" y="14" width="${w - 120}" height="${h - 28}" rx="8" fill="url(#pFins)" opacity=".9"/><rect x="42" y="${h - 30}" width="${w - 120}" height="4" rx="2" fill="${accent}" class="pulse" filter="url(#fGlow)"/>${text(w / 2 - 20, 70, p.brand.toUpperCase(), { size: 28, weight: 800, anchor: 'middle', fill: '#e9ecf2', spacing: 4, italic: true })}${text(w / 2 - 20, 98, `${p.name.replace(/\s\d+\s?[GT]B$/i, '').toUpperCase()}`, { size: 17, weight: 700, anchor: 'middle', fill: lighten(accent, 0.3), spacing: 2 })}</g>`
    : `<rect x="160" y="26" width="${w - 250}" height="98" rx="6" fill="#f2f4f7" opacity=".96"/><rect x="160" y="26" width="${w - 250}" height="10" rx="3" fill="${accent}"/>${text(170 + (w - 250) / 2, 78, p.brand, { size: 26, weight: 800, anchor: 'middle', fill: '#15181f', italic: true })}${text(170 + (w - 250) / 2, 104, p.name, { size: 16, weight: 700, anchor: 'middle', fill: '#3a3f4a' })}`}
    <rect x="0" y="0" width="${w}" height="${h}" rx="10" fill="url(#gSheen)" opacity=".25"/>
    ${text(w - 60, h - 10, capText(s.capacity_gb), { size: 18, weight: 800, anchor: 'end', fill: '#eafff5', opacity: 0.8 })}
  </g>`;
}

function sata(p, accent) {
  const s = p.specs;
  return `<g transform="translate(160 150) rotate(-4 240 170)" filter="url(#fDrop)">
    <rect x="0" y="22" width="480" height="340" rx="22" fill="url(#gDarkV)" stroke="#444a56" stroke-width="2"/>
    <rect x="0" y="0" width="480" height="340" rx="22" fill="url(#gSteel)" stroke="#555b68" stroke-width="2"/>
    <rect x="0" y="0" width="480" height="340" rx="22" fill="url(#gSheen)"/>
    <rect x="30" y="34" width="420" height="272" rx="12" fill="#14171d" stroke="#2a2f39"/>
    <rect x="30" y="34" width="420" height="12" rx="6" fill="${accent}"/>
    ${text(54, 110, p.brand, { size: 50, weight: 800, fill: '#f2f4f8', italic: true })}
    ${text(54, 144, p.name.replace(/\s\d+\s?[GT]B$/i, ''), { size: 24, weight: 700, fill: lighten(accent, 0.35), spacing: 2 })}
    ${text(54, 270, capText(s.capacity_gb), { size: 70, weight: 800, fill: '#fff' })}
    ${text(430, 290, 'SATA III · 6 Gb/s', { size: 16, weight: 600, anchor: 'end', fill: '#9aa3b2', spacing: 1 })}
    <path d="M54 170h250M54 182h170" stroke="#fff" stroke-opacity=".1" stroke-width="3"/>
    <rect x="${480 - 100}" y="340" width="86" height="16" rx="3" fill="#0b0c0f"/>
    <rect x="${480 - 96}" y="344" width="78" height="6" fill="url(#gGold)"/>
    ${screw(18, 18, 6)}${screw(462, 18, 6)}${screw(18, 322, 6)}${screw(462, 322, 6)}
  </g>`;
}

function hdd(p, accent) {
  const s = p.specs;
  return `<g transform="translate(240 70) rotate(3 160 230)" filter="url(#fDrop)">
    <rect x="0" y="28" width="330" height="440" rx="14" fill="#2a2e37"/>
    <rect x="0" y="0" width="330" height="440" rx="14" fill="url(#gSteel)" stroke="#555b68" stroke-width="2"/>
    <rect x="0" y="0" width="330" height="440" rx="14" fill="url(#gSheen)"/>
    <circle cx="165" cy="120" r="62" fill="url(#gSteelV)" stroke="#6a717d" stroke-width="2"/>
    <circle cx="165" cy="120" r="40" fill="none" stroke="#6a717d" stroke-opacity=".6"/>
    <circle cx="165" cy="120" r="10" fill="#8a919d"/>
    <rect x="30" y="208" width="270" height="190" rx="8" fill="#f1f3f6"/>
    <rect x="30" y="208" width="270" height="22" rx="8" fill="${accent}"/>
    ${text(46, 272, p.brand, { size: 38, weight: 800, fill: '#15181f', italic: true })}
    ${text(46, 298, p.name, { size: 18, weight: 700, fill: '#3a3f4a' })}
    ${text(284, 380, capText(s.capacity_gb), { size: 56, weight: 800, anchor: 'end', fill: '#15181f' })}
    ${Array.from({ length: 22 }, (_, i) => `<rect x="${46 + i * 4.2}" y="318" width="${i % 3 === 0 ? 2.8 : 1.6}" height="26" fill="#15181f"/>`).join('')}
    ${text(46, 366, `S/N ${serial(p.name, 8)}`, { size: 12, fill: '#4a505c', weight: 600, spacing: 1 })}
    ${screw(20, 20, 7)}${screw(310, 20, 7)}${screw(20, 420, 7)}${screw(310, 420, 7)}
    <rect x="${330 - 150}" y="468" width="62" height="16" rx="3" fill="#0b0c0f"/><rect x="${330 - 146}" y="472" width="54" height="6" fill="url(#gGold)"/>
    <rect x="${330 - 80}" y="468" width="70" height="16" rx="3" fill="#0b0c0f"/><rect x="${330 - 76}" y="472" width="62" height="6" fill="url(#gGold)"/>
  </g>`;
}

export function storageArt(p) {
  const s = p.specs;
  const accent = accentOf(p.brand);
  const body = s.storage_type === 'HDD' ? hdd(p, accent) : s.interface === 'SATA' ? sata(p, accent) : nvme(p, accent);
  const shadowY = s.storage_type === 'HDD' ? 548 : s.interface === 'SATA' ? 530 : 440;
  return `${floorShadow(400, shadowY, 280, 24, 0.7)}${body}<ellipse cx="400" cy="300" rx="300" ry="170" fill="${darken(accent, 0.1)}" opacity=".07" filter="url(#fSoft)"/>`;
}
