// Материалы и процедурные текстуры 3D-сцены: металл, пластик, стекло, печатная плата, перфорация, светодиоды.
import * as THREE from 'three';

const textures = new Map();

function canvasTexture(key, w, h, draw, { repeat = null, srgb = true } = {}) {
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  textures.set(key, tex);
  return tex;
}

/** Детерминированный генератор псевдослучайных чисел — чтобы текстуры не менялись между запусками. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Шлифованный металл: горизонтальные штрихи как карта шероховатости. */
export const brushedMap = () => canvasTexture('brushed', 256, 256, (ctx, w, h) => {
  const r = rng(7);
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i += 1) {
    const v = 120 + r() * 110;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    ctx.fillRect(r() * w, r() * h, 20 + r() * 120, 1);
  }
}, { repeat: [2, 2], srgb: false });

/** Перфорация шестиугольниками: белое — материал, чёрное — отверстие (для alphaMap/alphaTest). */
export const hexMeshMap = (cell = 14, repeatX = 8, repeatY = 8) => canvasTexture(`hex-${cell}-${repeatX}-${repeatY}`, 128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  const dx = cell;
  const dy = cell * 0.866;
  for (let row = -1; row * dy < h + dy; row += 1) {
    for (let col = -1; col * dx < w + dx; col += 1) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const px = cx + Math.cos(a) * cell * 0.36;
        const py = cy + Math.sin(a) * cell * 0.36;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}, { repeat: [repeatX, repeatY], srgb: false });

/** Рёбра радиатора: чередование светлых и тёмных полос. */
export const finsMap = (stripes = 14) => canvasTexture(`fins-${stripes}`, 256, 256, (ctx, w, h) => {
  const step = w / stripes;
  for (let i = 0; i < stripes; i += 1) {
    const g = ctx.createLinearGradient(i * step, 0, (i + 1) * step, 0);
    g.addColorStop(0, '#d9d9d9');
    g.addColorStop(0.55, '#8c8c8c');
    g.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = g;
    ctx.fillRect(i * step, 0, step, h);
  }
}, { srgb: false });

/** Печатная плата: тёмная основа, дорожки, переходные отверстия, шелкография. */
export const pcbTexture = (accent) => canvasTexture(`pcb-${accent}`, 1024, 1024, (ctx, w, h) => {
  const r = rng(42);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2b3342');
  g.addColorStop(1, '#1a202b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 160; i += 1) {
    ctx.strokeStyle = `rgba(150,175,210,${0.1 + r() * 0.14})`;
    ctx.lineWidth = 1.5 + r() * 2.5;
    ctx.beginPath();
    let x = r() * w;
    let y = r() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k += 1) {
      if (r() > 0.5) x += (r() - 0.5) * 260; else y += (r() - 0.5) * 260;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 420; i += 1) {
    ctx.fillStyle = `rgba(200,170,90,${0.15 + r() * 0.25})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, 1.4 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(220,225,235,0.22)';
  ctx.font = '700 15px system-ui, sans-serif';
  for (let i = 0; i < 70; i += 1) ctx.fillText(['C12', 'R44', 'L3', 'U7', 'Q2', 'JBAT1', 'F_PANEL', 'SYS_FAN'][i % 8], r() * (w - 60), 20 + r() * (h - 40));
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.globalAlpha = 1;
});

/** Текстура с надписью (для логотипов, табличек): прозрачный фон. */
export function textTexture(text, { color = '#ffffff', weight = 800, aspect = 4, italic = false, spacing = 0 } = {}) {
  return canvasTexture(`text-${text}-${color}-${weight}-${aspect}-${italic}-${spacing}`, 1024, Math.round(1024 / aspect), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(h * 0.62)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, w / 2, h / 2 + h * 0.03, w * 0.94);
  });
}

/** Прорези в задней стенке корпуса (кабельные окна, вырез под бекплейт сокета). */
export function trayTexture(L, H, cutouts) {
  const key = `tray-${L.toFixed(1)}-${H.toFixed(1)}-${cutouts.map((c) => c.join(',')).join(';')}`;
  return canvasTexture(key, 1024, Math.max(256, Math.round((1024 * H) / L)), (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const sx = w / L;
    const sy = h / H;
    for (const [cx, cy, cw, ch, round] of cutouts) {
      const x = (cx + L / 2) * sx - (cw * sx) / 2;
      const y = (H / 2 - cy) * sy - (ch * sy) / 2;
      ctx.fillStyle = '#030406';
      ctx.beginPath();
      ctx.roundRect(x, y, cw * sx, ch * sy, Math.min(cw * sx, ch * sy) * round);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }, { srgb: true });
}

// ───────── Материалы ─────────
export const mat = {
  steel: (color = '#aab2bf') => new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.34, roughnessMap: brushedMap() }),
  nickel: () => new THREE.MeshStandardMaterial({ color: '#dfe3ea', metalness: 1, roughness: 0.2 }),
  copper: () => new THREE.MeshStandardMaterial({ color: '#c8702e', metalness: 1, roughness: 0.28 }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#d9a634', metalness: 1, roughness: 0.3 }),
  coated: (color) => new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.5 }),
  darkMetal: (color = '#1f232b') => new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.4, roughnessMap: brushedMap() }),
  plastic: (color = '#101217') => new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.55 }),
  rubber: (color = '#0b0c0f') => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 }),
  glass: () => new THREE.MeshPhysicalMaterial({
    color: '#0a1019', transparent: true, opacity: 0.26, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 2.4, depthWrite: false,
  }),
  mesh: (color) => new THREE.MeshStandardMaterial({
    color, metalness: 0.5, roughness: 0.5, alphaMap: hexMeshMap(14, 14, 14), alphaTest: 0.5, side: THREE.DoubleSide,
  }),
};

// ───────── Светодиоды (RGB): светятся и плавно «дышат», подхватываются bloom ─────────
const LEDS = new Set();
const tmpColor = new THREE.Color();

export function led(color, { intensity = 2.4, phase = Math.random() * Math.PI * 2, speed = 1 } = {}) {
  const base = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const material = new THREE.MeshStandardMaterial({ color: '#050505', emissive: base.clone(), emissiveIntensity: intensity, roughness: 0.5 });
  material.userData.led = { hsl, intensity, phase, speed };
  LEDS.add(material);
  return material;
}

export const clearLeds = () => LEDS.clear();

export function tickLeds(time) {
  for (const m of LEDS) {
    const { hsl, intensity, phase, speed } = m.userData.led;
    const wave = Math.sin(time * speed * 1.2 + phase);
    tmpColor.setHSL((hsl.h + wave * 0.045 + 1) % 1, Math.min(1, hsl.s + 0.05), Math.max(0.35, hsl.l));
    m.emissive.copy(tmpColor);
    m.emissiveIntensity = intensity * (0.82 + 0.22 * wave);
  }
}
