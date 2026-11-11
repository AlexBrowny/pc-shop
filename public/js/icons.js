// Встроенные SVG-иконки (stroke-стиль, наследуют currentColor).
import { raw } from './util.js';

const svg = (body, size = 20) =>
  raw(`<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`);

export const icons = {
  cart: svg('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.8l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.1l1.6-6.6H6.2"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>'),
  moon: svg('<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: svg('<path d="m5 12.5 4.2 4.2L19 7"/>'),
  bolt: svg('<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12Z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.2A2.2 2.2 0 0 0 13.3 4H6.2A2.2 2.2 0 0 0 4 6.2v7.1a2.2 2.2 0 0 0 2.2 2.2h2.3"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>'),
  cube: svg('<path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4Z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>'),
  shield: svg('<path d="M12 3 4.5 6v5.6c0 4.4 3.1 8.2 7.5 9.4 4.4-1.2 7.5-5 7.5-9.4V6Z"/><path d="m8.8 12.2 2.4 2.4 4-4.6"/>'),
  gauge: svg('<path d="M4 17a8.5 8.5 0 1 1 16 0"/><path d="m12 17 4-6"/><circle cx="12" cy="17" r="1.2"/>'),
  coin: svg('<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.3c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 3 5.6 1.5 5.6 4.4 0 1.2-1.2 2-2.9 2-1.4 0-2.5-.6-3-1.6M12 6.5v1.4M12 16.1v1.4"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  home: svg('<path d="M4 10.8 12 4l8 6.8V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19Z"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  chevL: svg('<path d="m14.5 6-6 6 6 6"/>'),
  chevR: svg('<path d="m9.5 6 6 6-6 6"/>'),
  chevD: svg('<path d="m6 9.5 6 6 6-6"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  zoomIn: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M11 8.5v5M8.5 11h5"/>'),
  zoomOut: svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5M8.5 11h5"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  layers: svg('<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5l8.5 4.5 8.5-4.5"/>'),
  plane: svg('<path d="M21 3.5 3.5 10.8l5.6 2.2L11.3 19l2.5-4.2L21 3.5Z"/><path d="m9.1 13 12-9.5"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z"/>'),
  receipt: svg('<path d="M6 3.5h12v17l-2.4-1.6-2.1 1.6-1.5-1.6-1.5 1.6-2.1-1.6L6 20.5Z"/><path d="M9 8.5h6M9 12h6"/>'),
  alert: svg('<path d="M12 4 3 19.5h18Z"/><path d="M12 10v4.2M12 16.8v.2"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  trash: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/>'),
};

const CAT_ICONS = {
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  motherboard: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><rect x="7" y="7" width="5" height="5" rx="1"/><path d="M15 6.5v6M17.5 6.5v6M7 16h7M16.5 16.5h1"/>',
  ram: '<rect x="2.5" y="7" width="19" height="8" rx="1.5"/><path d="M5.5 15v2.5M9 15v2.5M12.5 15v2.5M16 15v2.5M19 15v2.5"/><path d="M6 10h4M12 10h6"/>',
  gpu: '<rect x="2.5" y="6.5" width="19" height="10" rx="2"/><circle cx="8.5" cy="11.5" r="3"/><circle cx="16" cy="11.5" r="3"/><path d="M5 19.5h5"/>',
  storage: '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><circle cx="12" cy="10" r="3.2"/><path d="M8 17h8"/>',
  psu: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="10" cy="12" r="3.5"/><path d="M17 9v6"/>',
  case: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="9" r="2.5"/><circle cx="12" cy="15.5" r="2.5"/>',
  cooler: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.8"/><path d="M12 10.2c0-3 1.8-4.6 3.8-4.2M13.8 12c3 0 4.6 1.8 4.2 3.8M12 13.8c0 3-1.8 4.6-3.8 4.2M10.2 12c-3 0-4.6-1.8-4.2-3.8"/>',
};

export const catIcon = (key, size = 22) => svg(CAT_ICONS[key] ?? '', size);

/** Логотип: чип с «ножками» в градиентной плашке. */
export const logoMark = raw(`<svg class="logo-svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-2)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#lg)"/>
  <rect x="12" y="12" width="16" height="16" rx="3.5" fill="var(--accent-ink)"/>
  <path d="M17 8v4M23 8v4M17 28v4M23 28v4M8 17h4M8 23h4M28 17h4M28 23h4" stroke="var(--accent-ink)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M17.5 20.2 20 22.7 23.8 17.4" fill="none" stroke="url(#lg)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`);
