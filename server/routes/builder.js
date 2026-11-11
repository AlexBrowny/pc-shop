import { Router } from 'express';
import { rows } from '../db.js';
import { BUILD_SLOTS, checkBuild, classifyCandidate } from '../lib/compat.js';
import { estimateAll, RESOLUTIONS } from '../lib/fps.js';

export const builderRouter = Router();

const MAX_STORAGE_ITEMS = 6;

const toIdOrNull = (v) => (Number.isInteger(v) && v > 0 ? v : null);
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

/** Приводит тело запроса к { cpu: id|null, ..., storage: [id] } и отбрасывает мусор. */
function normalizeSelection(raw) {
  const sel = raw && typeof raw === 'object' ? raw : {};
  const out = { storage: [] };
  for (const slot of BUILD_SLOTS) {
    if (slot === 'storage') continue;
    out[slot] = toIdOrNull(sel[slot]);
  }
  if (Array.isArray(sel.storage)) {
    out.storage = sel.storage.map(toIdOrNull).filter(Boolean).slice(0, MAX_STORAGE_ITEMS);
  }
  return out;
}

/** Загружает товары выбранных id и проверяет, что категория совпадает со слотом. */
async function resolveParts(selection) {
  const ids = [...BUILD_SLOTS.filter((s) => s !== 'storage').map((s) => selection[s]), ...selection.storage].filter(Boolean);
  const byId = new Map();
  if (ids.length) {
    for (const row of await rows('SELECT * FROM products WHERE active AND id = ANY($1::int[])', [ids])) byId.set(row.id, row);
  }
  const pick = (slot, id) => {
    const p = id ? byId.get(id) : null;
    return p && p.category === slot ? p : null;
  };
  const parts = { storage: selection.storage.map((id) => pick('storage', id)).filter(Boolean) };
  for (const slot of BUILD_SLOTS) {
    if (slot !== 'storage') parts[slot] = pick(slot, selection[slot]);
  }
  return parts;
}

builderRouter.post('/options', wrap(async (req, res) => {
  const category = String(req.body?.category ?? '');
  if (!BUILD_SLOTS.includes(category)) {
    return res.status(400).json({ success: false, error: 'invalid_category' });
  }
  const parts = await resolveParts(normalizeSelection(req.body?.selection));
  const products = await rows('SELECT * FROM products WHERE active AND category = $1 ORDER BY price_uzs, id', [category]);
  const options = products.map((product) => {
    const { status, reasons } = classifyCandidate(category, product, parts);
    return { product, status, reasons: reasons.map(({ code, params, level }) => ({ code, params, level })) };
  });
  return res.json({ success: true, data: options });
}));

builderRouter.post('/evaluate', wrap(async (req, res) => {
  const selection = normalizeSelection(req.body?.selection);
  const resolution = Object.hasOwn(RESOLUTIONS, req.body?.resolution) ? req.body.resolution : '1080p';
  const parts = await resolveParts(selection);
  const check = checkBuild(parts);

  const canEstimate = parts.cpu && parts.gpu;
  let fps = null;
  if (canEstimate) {
    const games = await rows('SELECT * FROM games WHERE active ORDER BY builtin DESC, id');
    fps = estimateAll(games, { cpu: parts.cpu, gpu: parts.gpu, ram: parts.ram }, resolution);
  }

  res.json({
    success: true,
    data: {
      parts,
      issues: check.issues.map(({ level, code, involves, params }) => ({ level, code, involves, params })),
      power: check.power,
      missing: check.missing,
      total: check.total,
      fps,
      fpsAssumesDefaultRam: canEstimate && !parts.ram,
      resolution,
    },
  });
}));
