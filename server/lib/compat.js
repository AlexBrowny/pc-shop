// Проверка совместимости сборки. Чистая функция: на вход — объекты товаров, на выход — список проблем.
// Каждая проблема: { level: 'error' | 'warn', code, involves: [категории], block, params }.
// block=true — комплектующие физически несовместимы (в списке выбора такой товар блокируется).

export const BUILD_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'];
export const REQUIRED_SLOTS = ['cpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler'];

const BASE_SYSTEM_POWER_W = 75; // материнская плата, ОЗУ, вентиляторы
const DRIVE_POWER_W = 5;
const HEADROOM = 1.3;

const roundUp50 = (n) => Math.ceil(n / 50) * 50;

export function estimatePower({ cpu, gpu, storage = [] }) {
  const cpuW = cpu?.specs.max_power_w ?? 0;
  const gpuW = gpu?.specs.power_w ?? 0;
  const estimated = cpuW + gpuW + BASE_SYSTEM_POWER_W + storage.length * DRIVE_POWER_W;
  const recommended = Math.max(roundUp50(estimated * HEADROOM), gpu?.specs.rec_psu_w ?? 0);
  return { estimated, recommended };
}

export function checkBuild(parts) {
  const { cpu, motherboard: mb, ram, gpu, psu, case: pcCase, cooler } = parts;
  const storage = parts.storage ?? [];
  const issues = [];
  const add = (level, code, involves, params = {}, block = level === 'error') =>
    issues.push({ level, code, involves, params, block });

  if (cpu && mb && cpu.specs.socket !== mb.specs.socket) {
    add('error', 'socket_mismatch', ['cpu', 'motherboard'], { cpu: cpu.specs.socket, mb: mb.specs.socket });
  }

  if (mb && ram && mb.specs.ram_type !== ram.specs.ram_type) {
    add('error', 'ram_type_mismatch', ['motherboard', 'ram'], { mb: mb.specs.ram_type, ram: ram.specs.ram_type });
  }
  if (cpu && ram && !cpu.specs.ram_types.includes(ram.specs.ram_type)) {
    add('error', 'cpu_ram_type', ['cpu', 'ram'], { cpu: cpu.specs.ram_types.join('/'), ram: ram.specs.ram_type });
  }
  if (mb && ram) {
    if (ram.specs.modules > mb.specs.ram_slots) {
      add('error', 'ram_slots', ['motherboard', 'ram'], { modules: ram.specs.modules, slots: mb.specs.ram_slots });
    }
    if (ram.specs.capacity_gb > mb.specs.max_ram_gb) {
      add('error', 'ram_capacity', ['motherboard', 'ram'], { capacity: ram.specs.capacity_gb, max: mb.specs.max_ram_gb });
    }
  }

  if (mb && pcCase && !pcCase.specs.form_factors.includes(mb.specs.form_factor)) {
    add('error', 'form_factor', ['motherboard', 'case'], { mb: mb.specs.form_factor, supported: pcCase.specs.form_factors.join(', ') });
  }
  if (gpu && pcCase && gpu.specs.length_mm > pcCase.specs.max_gpu_mm) {
    add('error', 'gpu_length', ['gpu', 'case'], { gpu: gpu.specs.length_mm, max: pcCase.specs.max_gpu_mm });
  }
  if (psu && pcCase && !pcCase.specs.psu_form_factors.includes(psu.specs.form_factor)) {
    add('error', 'psu_form_factor', ['psu', 'case'], { psu: psu.specs.form_factor, supported: pcCase.specs.psu_form_factors.join(', ') });
  }

  if (cooler && cpu && !cooler.specs.sockets.includes(cpu.specs.socket)) {
    add('error', 'cooler_socket', ['cooler', 'cpu'], { socket: cpu.specs.socket });
  }
  if (cooler && pcCase) {
    if (cooler.specs.cooler_type === 'Air' && cooler.specs.height_mm > pcCase.specs.max_cooler_mm) {
      add('error', 'cooler_height', ['cooler', 'case'], { height: cooler.specs.height_mm, max: pcCase.specs.max_cooler_mm });
    }
    if (cooler.specs.cooler_type === 'AIO' && !pcCase.specs.radiators.includes(cooler.specs.radiator_mm)) {
      add('error', 'radiator_support', ['cooler', 'case'], { radiator: cooler.specs.radiator_mm, supported: pcCase.specs.radiators.join(', ') });
    }
  }
  if (cooler && cpu && cooler.specs.tdp_w < cpu.specs.max_power_w) {
    add('warn', 'cooler_weak', ['cooler', 'cpu'], { cooler: cooler.specs.tdp_w, cpu: cpu.specs.max_power_w });
  }

  if (mb && storage.length) {
    const m2 = storage.filter((s) => s.specs.interface === 'M.2').length;
    const sata = storage.filter((s) => s.specs.interface === 'SATA').length;
    if (m2 > mb.specs.m2_slots) add('error', 'm2_slots', ['motherboard', 'storage'], { need: m2, have: mb.specs.m2_slots });
    if (sata > mb.specs.sata_ports) add('error', 'sata_ports', ['motherboard', 'storage'], { need: sata, have: mb.specs.sata_ports });
  }

  const power = estimatePower({ cpu, gpu, storage });
  if (psu && (cpu || gpu)) {
    const wattage = psu.specs.wattage_w;
    if (wattage < power.estimated) {
      add('error', 'psu_insufficient', ['psu', 'cpu', 'gpu'], { est: power.estimated, psu: wattage }, false);
    } else if (wattage < power.recommended) {
      add('warn', 'psu_low_headroom', ['psu', 'cpu', 'gpu'], { recommended: power.recommended, psu: wattage });
    }
  }

  if (cpu && !gpu && !cpu.specs.igpu) {
    add('warn', 'no_display', ['cpu', 'gpu'], {});
  }

  const missing = REQUIRED_SLOTS.filter((slot) => (slot === 'storage' ? storage.length === 0 : !parts[slot]));
  if (!gpu && !(cpu?.specs.igpu)) missing.push('gpu');

  const total = [cpu, mb, ram, gpu, psu, pcCase, cooler, ...storage]
    .filter(Boolean)
    .reduce((sum, p) => sum + p.price_uzs, 0);

  return { issues, power, missing, total };
}

/**
 * Статус кандидата при подстановке в текущую сборку.
 * blocked — есть блокирующая ошибка с участием его категории; warn — есть предупреждения/мягкие ошибки; ok — всё хорошо.
 */
export function classifyCandidate(category, candidate, parts) {
  const next = category === 'storage'
    ? { ...parts, storage: [...(parts.storage ?? []), candidate] }
    : { ...parts, [category]: candidate };
  const relevant = checkBuild(next).issues.filter((i) => i.involves.includes(category));
  const blocking = relevant.filter((i) => i.block);
  if (blocking.length) return { status: 'blocked', reasons: blocking };
  if (relevant.length) return { status: 'warn', reasons: relevant };
  return { status: 'ok', reasons: [] };
}
