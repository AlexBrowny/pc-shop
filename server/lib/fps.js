// Модельная оценка FPS. Это не замеры, а оценка по относительным индексам производительности.
//
//   gpu_fps = gpu_ref[preset] * (gpu.score/100)^0.95 * resFactor * vramPenalty
//   cpu_fps = cpu_ref[preset] * (cpu.score/100)^0.9
//   fps     = мягкий минимум(gpu_fps, cpu_fps) * ramFactor

export const PRESETS = ['low', 'medium', 'high', 'ultra'];
export const RESOLUTIONS = {
  '1080p': { gpu: 1, vram: 1 },
  '1440p': { gpu: 0.68, vram: 1.25 },
  '2160p': { gpu: 0.38, vram: 1.6 },
};

const GPU_EXPONENT = 0.95;
const CPU_EXPONENT = 0.9;
const SOFT_MIN_P = 8; // чем больше, тем ближе к жёсткому min()
const MAX_FPS = 500;

const softMin = (a, b) => Math.pow(Math.pow(a, -SOFT_MIN_P) + Math.pow(b, -SOFT_MIN_P), -1 / SOFT_MIN_P);

export function vramFactor(vramGb, needGb) {
  if (vramGb >= needGb) return 1;
  return Math.max(0.35, Math.pow(vramGb / needGb, 1.5));
}

export function ramFactor(ram, game) {
  if (!ram) return 1;
  let factor = 1;
  const { capacity_gb: gb, modules } = ram.specs;
  if (gb < game.ram_gb) factor *= Math.max(0.6, Math.sqrt(gb / game.ram_gb));
  if (modules < 2) factor *= 0.93; // одноканальный режим
  return factor;
}

export function estimateGameFps(game, { cpu, gpu, ram }, resolution = '1080p') {
  const res = RESOLUTIONS[resolution] ?? RESOLUTIONS['1080p'];
  const result = {};
  PRESETS.forEach((preset, i) => {
    const needVram = game.vram[i] * res.vram;
    const vf = vramFactor(gpu.specs.vram_gb, needVram);
    const gpuFps = game.gpu_fps[i] * Math.pow(gpu.specs.score / 100, GPU_EXPONENT) * res.gpu * vf;
    const cpuFps = game.cpu_fps[i] * Math.pow(cpu.specs.score / 100, CPU_EXPONENT);
    const combined = softMin(gpuFps, cpuFps) * ramFactor(ram, game);

    let bottleneck = gpuFps <= cpuFps ? 'gpu' : 'cpu';
    if (vf < 0.95 && bottleneck === 'gpu') bottleneck = 'vram';

    result[preset] = { fps: Math.max(1, Math.min(MAX_FPS, Math.round(combined))), bottleneck };
  });
  return result;
}

export function estimateAll(games, parts, resolution) {
  return games.map((game) => ({
    slug: game.slug,
    title: game.title,
    year: game.year,
    cover: game.cover,
    presets: estimateGameFps(game, parts, resolution),
  }));
}
