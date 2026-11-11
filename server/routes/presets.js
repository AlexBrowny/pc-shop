import { Router } from 'express';
import { rows } from '../db.js';
import { PRESETS } from '../../data/presets.js';
import { checkBuild } from '../lib/compat.js';
import { estimateAll } from '../lib/fps.js';

export const presetsRouter = Router();

const PRESET_PRESET = 'high'; // для «среднего FPS» берём высокие настройки графики

function loadPreset(preset, bySlug) {
  const part = (slug) => bySlug.get(slug) ?? null;
  const parts = {
    cpu: part(preset.parts.cpu),
    motherboard: part(preset.parts.motherboard),
    ram: part(preset.parts.ram),
    gpu: part(preset.parts.gpu),
    storage: preset.parts.storage.map(part).filter(Boolean),
    psu: part(preset.parts.psu),
    case: part(preset.parts.case),
    cooler: part(preset.parts.cooler),
  };
  const complete = Object.entries(parts).every(([k, v]) => (k === 'storage' ? v.length === preset.parts.storage.length : !!v));
  return { parts, complete };
}

presetsRouter.get('/presets', async (_req, res, next) => {
  try {
    const bySlug = new Map((await rows('SELECT * FROM products WHERE active')).map((p) => [p.slug, p]));
    const games = await rows('SELECT * FROM games WHERE active');
    const data = [];
    for (const preset of PRESETS) {
      const { parts, complete } = loadPreset(preset, bySlug);
      if (!complete) continue; // товар скрыт или удалён — сборку не показываем
      const check = checkBuild(parts);
      const fps = estimateAll(games, { cpu: parts.cpu, gpu: parts.gpu, ram: parts.ram }, preset.resolution);
      const avg = Math.round(fps.reduce((s, g) => s + g.presets[PRESET_PRESET].fps, 0) / fps.length);
      data.push({
        key: preset.key,
        resolution: preset.resolution,
        total: check.total,
        avgFps: avg,
        compatible: !check.issues.some((i) => i.level === 'error'),
        watts: check.power.estimated,
        image: parts.case.image,
        gpu: parts.gpu.name,
        cpu: `${parts.cpu.brand} ${parts.cpu.name}`,
        ram: parts.ram.specs.capacity_gb,
        storageGb: parts.storage.reduce((s, d) => s + d.specs.capacity_gb, 0),
        ids: {
          cpu: parts.cpu.id,
          motherboard: parts.motherboard.id,
          ram: parts.ram.id,
          gpu: parts.gpu.id,
          storage: parts.storage.map((d) => d.id),
          psu: parts.psu.id,
          case: parts.case.id,
          cooler: parts.cooler.id,
        },
        parts: Object.values(parts).flat().map((p) => ({ category: p.category, name: `${p.brand} ${p.name}`, image: p.image, price_uzs: p.price_uzs })),
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
