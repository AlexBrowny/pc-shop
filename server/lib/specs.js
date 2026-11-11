// Единый источник правды о характеристиках: по нему строится форма в админке и проверяются данные на сервере.
// Без корректных характеристик ломаются проверка совместимости, расчёт FPS и 3D-модель.

const FF = ['ATX', 'mATX', 'ITX'];
const PSU_FF = ['ATX', 'SFX', 'SFX-L'];
const RAM_TYPES = ['DDR4', 'DDR5'];

// type: string | int | number | bool | enum | multi | intlist; nullable — значение необязательно
export const SPEC_FIELDS = {
  cpu: [
    { key: 'socket', label: 'Сокет', type: 'string' },
    { key: 'cores', label: 'Ядра', type: 'int', min: 1, max: 256 },
    { key: 'threads', label: 'Потоки', type: 'int', min: 1, max: 512 },
    { key: 'base_ghz', label: 'Базовая частота, ГГц', type: 'number', min: 0.5, max: 8 },
    { key: 'boost_ghz', label: 'Макс. частота, ГГц', type: 'number', min: 0.5, max: 8 },
    { key: 'tdp_w', label: 'TDP, Вт', type: 'int', min: 1, max: 600 },
    { key: 'max_power_w', label: 'Макс. потребление, Вт', type: 'int', min: 1, max: 600 },
    { key: 'ram_types', label: 'Типы памяти', type: 'multi', options: RAM_TYPES },
    { key: 'igpu', label: 'Встроенная графика', type: 'bool' },
    { key: 'score', label: 'Индекс производительности (i5-13400F = 100)', type: 'number', min: 1, max: 1000 },
  ],
  motherboard: [
    { key: 'socket', label: 'Сокет', type: 'string' },
    { key: 'chipset', label: 'Чипсет', type: 'string' },
    { key: 'form_factor', label: 'Форм-фактор', type: 'enum', options: FF },
    { key: 'ram_type', label: 'Тип памяти', type: 'enum', options: RAM_TYPES },
    { key: 'ram_slots', label: 'Слотов ОЗУ', type: 'int', min: 1, max: 4 },
    { key: 'max_ram_gb', label: 'Макс. ОЗУ, ГБ', type: 'int', min: 4, max: 1024 },
    { key: 'm2_slots', label: 'Слотов M.2', type: 'int', min: 0, max: 8 },
    { key: 'sata_ports', label: 'Портов SATA', type: 'int', min: 0, max: 12 },
    { key: 'wifi', label: 'Wi-Fi', type: 'bool' },
    { key: 'pcie', label: 'PCIe (например, PCIe 5.0)', type: 'string' },
  ],
  ram: [
    { key: 'ram_type', label: 'Тип памяти', type: 'enum', options: RAM_TYPES },
    { key: 'capacity_gb', label: 'Объём комплекта, ГБ', type: 'int', min: 1, max: 1024 },
    { key: 'modules', label: 'Модулей в комплекте', type: 'int', min: 1, max: 4 },
    { key: 'speed_mhz', label: 'Частота, МГц', type: 'int', min: 400, max: 12000 },
    { key: 'latency_cl', label: 'Тайминги CL', type: 'int', min: 1, max: 100 },
  ],
  gpu: [
    { key: 'chip', label: 'Графический чип', type: 'string' },
    { key: 'vram_gb', label: 'Видеопамять, ГБ', type: 'int', min: 1, max: 128 },
    { key: 'length_mm', label: 'Длина, мм', type: 'int', min: 100, max: 500 },
    { key: 'power_w', label: 'Потребление, Вт', type: 'int', min: 1, max: 1000 },
    { key: 'rec_psu_w', label: 'Рекомендуемый БП, Вт', type: 'int', min: 100, max: 2000 },
    { key: 'connector', label: 'Доп. питание', type: 'string' },
    { key: 'score', label: 'Индекс производительности (RTX 4060 = 100)', type: 'number', min: 1, max: 2000 },
  ],
  storage: [
    { key: 'storage_type', label: 'Тип', type: 'enum', options: ['NVMe SSD', 'SATA SSD', 'HDD'] },
    { key: 'interface', label: 'Интерфейс', type: 'enum', options: ['M.2', 'SATA'] },
    { key: 'capacity_gb', label: 'Объём, ГБ', type: 'int', min: 16, max: 100000 },
    { key: 'read_mbs', label: 'Скорость чтения, МБ/с', type: 'int', min: 1, max: 20000 },
  ],
  psu: [
    { key: 'wattage_w', label: 'Мощность, Вт', type: 'int', min: 100, max: 3000 },
    { key: 'efficiency', label: 'Сертификат (например, 80+ Gold)', type: 'string' },
    { key: 'form_factor', label: 'Форм-фактор', type: 'enum', options: PSU_FF },
    { key: 'modular', label: 'Модульный', type: 'bool' },
  ],
  case: [
    { key: 'form_factors', label: 'Поддерживаемые платы', type: 'multi', options: FF },
    { key: 'max_gpu_mm', label: 'Макс. длина видеокарты, мм', type: 'int', min: 100, max: 600 },
    { key: 'max_cooler_mm', label: 'Макс. высота кулера, мм', type: 'int', min: 50, max: 250 },
    { key: 'radiators', label: 'Поддерживаемые радиаторы СЖО', type: 'intlist', options: [120, 240, 280, 360], optional: true },
    { key: 'psu_form_factors', label: 'Форматы БП', type: 'multi', options: PSU_FF },
    { key: 'color', label: 'Цвет', type: 'enum', options: ['Black', 'White', 'Charcoal'] },
  ],
  cooler: [
    { key: 'cooler_type', label: 'Тип', type: 'enum', options: ['Air', 'AIO'] },
    { key: 'sockets', label: 'Сокеты', type: 'multi', options: ['AM4', 'AM5', 'LGA1700', 'LGA1851'], free: true },
    { key: 'height_mm', label: 'Высота, мм (для воздушных)', type: 'int', min: 20, max: 250, nullable: true },
    { key: 'tdp_w', label: 'Рассеиваемая мощность, Вт', type: 'int', min: 1, max: 1000 },
    { key: 'radiator_mm', label: 'Радиатор, мм (для СЖО)', type: 'intlist', options: [120, 240, 280, 360], single: true, nullable: true },
  ],
};

export const CATEGORY_KEYS = Object.keys(SPEC_FIELDS);

function validateField(field, raw) {
  const empty = raw === undefined || raw === null || raw === '';
  if (empty) {
    if (field.nullable) return { value: null };
    if (field.optional) return { value: [] };
    return { error: 'required' };
  }
  switch (field.type) {
    case 'string': {
      const v = String(raw).trim();
      return v && v.length <= 60 ? { value: v } : { error: 'invalid' };
    }
    case 'int':
    case 'number': {
      const n = Number(raw);
      if (!Number.isFinite(n) || (field.type === 'int' && !Number.isInteger(n))) return { error: 'invalid' };
      if (n < field.min || n > field.max) return { error: 'out_of_range' };
      return { value: n };
    }
    case 'bool':
      return { value: raw === true || raw === 'true' || raw === 1 || raw === '1' };
    case 'enum':
      return field.options.includes(raw) ? { value: raw } : { error: 'invalid' };
    case 'multi': {
      const list = Array.isArray(raw) ? raw.map(String) : null;
      if (!list || !list.length) return { error: 'invalid' };
      if (!field.free && list.some((v) => !field.options.includes(v))) return { error: 'invalid' };
      if (field.free && list.some((v) => !v.trim() || v.length > 20)) return { error: 'invalid' };
      return { value: [...new Set(list.map((v) => v.trim()))] };
    }
    case 'intlist': {
      if (field.single) {
        const n = Number(raw);
        return field.options.includes(n) ? { value: n } : { error: 'invalid' };
      }
      const list = Array.isArray(raw) ? raw.map(Number) : null;
      if (!list || list.some((n) => !field.options.includes(n))) return { error: 'invalid' };
      return { value: [...new Set(list)].sort((a, b) => a - b) };
    }
    default:
      return { error: 'invalid' };
  }
}

/** Проверяет и нормализует характеристики. Возвращает { ok, value } или { ok: false, errors: { key: code } }. */
export function validateSpecs(category, input) {
  const fields = SPEC_FIELDS[category];
  if (!fields) return { ok: false, errors: { category: 'unknown' } };
  const src = input && typeof input === 'object' ? input : {};
  const value = {};
  const errors = {};
  for (const field of fields) {
    const res = validateField(field, src[field.key]);
    if (res.error) errors[field.key] = res.error;
    else value[field.key] = res.value;
  }
  // перекрёстные проверки
  if (!Object.keys(errors).length) {
    if (category === 'cpu' && value.threads < value.cores) errors.threads = 'less_than_cores';
    if (category === 'cooler') {
      if (value.cooler_type === 'Air' && value.height_mm === null) errors.height_mm = 'required';
      if (value.cooler_type === 'AIO' && value.radiator_mm === null) errors.radiator_mm = 'required';
      if (value.cooler_type === 'Air') value.radiator_mm = null;
      if (value.cooler_type === 'AIO') value.height_mm = null;
    }
    if (category === 'storage' && ((value.storage_type === 'NVMe SSD') !== (value.interface === 'M.2'))) errors.interface = 'mismatch';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

const arrayOfNumbers = (raw, label, errors, min, max) => {
  const arr = Array.isArray(raw) ? raw.map(Number) : null;
  if (!arr || arr.length !== 4 || arr.some((n) => !Number.isFinite(n) || n < min || n > max)) {
    errors[label] = 'invalid';
    return null;
  }
  return arr;
};

/** Валидация игры: четыре значения (low/medium/high/ultra) для каждого из параметров. */
export function validateGame(input) {
  const src = input && typeof input === 'object' ? input : {};
  const errors = {};
  const title = String(src.title ?? '').trim();
  if (!title || title.length > 80) errors.title = 'invalid';
  const year = src.year === '' || src.year == null ? null : Number(src.year);
  if (year !== null && (!Number.isInteger(year) || year < 1990 || year > 2100)) errors.year = 'invalid';
  const gpu = arrayOfNumbers(src.gpu_fps, 'gpu_fps', errors, 1, 1000);
  const cpu = arrayOfNumbers(src.cpu_fps, 'cpu_fps', errors, 1, 1000);
  const vram = arrayOfNumbers(src.vram, 'vram', errors, 1, 64);
  const ram = Number(src.ram_gb ?? 16);
  if (!Number.isInteger(ram) || ram < 4 || ram > 128) errors.ram_gb = 'invalid';
  const hue = Number.isFinite(Number(src.hue)) ? Math.max(0, Math.min(359, Math.round(Number(src.hue)))) : 220;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, year, gpu_fps: gpu, cpu_fps: cpu, vram, ram_gb: ram, hue } };
}
