// Начальный каталог комплектующих. Цены заданы в долларах и переводятся в сумы по курсу USD_RATE.
// Характеристики приведены по открытым спецификациям производителей; `score` — условный
// индекс игровой производительности (RTX 4060 = 100 для GPU, ~i5-13400F = 100 для CPU).

export const USD_RATE = Number(process.env.USD_RATE || 12500); // сум за 1 USD

export const CATEGORIES = [
  { key: 'cpu', name_ru: 'Процессоры', name_uz: 'Protsessorlar', sort: 1 },
  { key: 'motherboard', name_ru: 'Материнские платы', name_uz: 'Anakartlar', sort: 2 },
  { key: 'ram', name_ru: 'Оперативная память', name_uz: 'Operativ xotira', sort: 3 },
  { key: 'gpu', name_ru: 'Видеокарты', name_uz: 'Videokartalar', sort: 4 },
  { key: 'storage', name_ru: 'Накопители', name_uz: 'Xotira qurilmalari', sort: 5 },
  { key: 'psu', name_ru: 'Блоки питания', name_uz: 'Quvvat bloklari', sort: 6 },
  { key: 'case', name_ru: 'Корпуса', name_uz: 'Korpuslar', sort: 7 },
  { key: 'cooler', name_ru: 'Охлаждение', name_uz: 'Sovutish tizimlari', sort: 8 },
];

const INTEL_AMD_DDR = ['DDR4', 'DDR5'];

// cpu(бренд, модель, $, сокет, ядра, потоки, base, boost, tdp, max_power, ram_types, igpu, score)
const cpu = (brand, name, usd, socket, cores, threads, base, boost, tdp, maxP, ramTypes, igpu, score) => ({
  category: 'cpu', brand, name, usd,
  specs: { socket, cores, threads, base_ghz: base, boost_ghz: boost, tdp_w: tdp, max_power_w: maxP, ram_types: ramTypes, igpu, score },
});

// mb(бренд, модель, $, сокет, чипсет, форм-фактор, тип ОЗУ, слотов, макс ГБ, M.2, SATA, wifi, pcie)
const mb = (brand, name, usd, socket, chipset, ff, ramType, slots, maxGb, m2, sata, wifi, pcie) => ({
  category: 'motherboard', brand, name, usd,
  specs: { socket, chipset, form_factor: ff, ram_type: ramType, ram_slots: slots, max_ram_gb: maxGb, m2_slots: m2, sata_ports: sata, wifi, pcie },
});

// ram(бренд, модель, $, тип, суммарно ГБ, модулей, МГц, CL)
const ram = (brand, name, usd, type, gb, modules, mhz, cl) => ({
  category: 'ram', brand, name, usd,
  specs: { ram_type: type, capacity_gb: gb, modules, speed_mhz: mhz, latency_cl: cl },
});

// gpu(бренд, модель, $, чип, VRAM, длина, мощность, рекомендуемый БП, разъём, score)
const gpu = (brand, name, usd, chip, vram, len, power, recPsu, connector, score) => ({
  category: 'gpu', brand, name, usd,
  specs: { chip, vram_gb: vram, length_mm: len, power_w: power, rec_psu_w: recPsu, connector, score },
});

// storage(бренд, модель, $, тип, интерфейс, ГБ, чтение МБ/с)
const storage = (brand, name, usd, type, iface, gb, read) => ({
  category: 'storage', brand, name, usd,
  specs: { storage_type: type, interface: iface, capacity_gb: gb, read_mbs: read },
});

// psu(бренд, модель, $, Вт, сертификат, форм-фактор, модульный)
const psu = (brand, name, usd, watt, eff, ff, modular) => ({
  category: 'psu', brand, name, usd,
  specs: { wattage_w: watt, efficiency: eff, form_factor: ff, modular },
});

// pcCase(бренд, модель, $, форм-факторы плат, макс GPU, макс кулер, радиаторы, форм-факторы БП, цвет)
const pcCase = (brand, name, usd, ffs, gpuMax, coolerMax, rads, psuFfs, color) => ({
  category: 'case', brand, name, usd,
  specs: { form_factors: ffs, max_gpu_mm: gpuMax, max_cooler_mm: coolerMax, radiators: rads, psu_form_factors: psuFfs, color },
});

// cooler(бренд, модель, $, тип, сокеты, высота, рейтинг, радиатор)
const cooler = (brand, name, usd, type, sockets, height, rating, rad) => ({
  category: 'cooler', brand, name, usd,
  specs: { cooler_type: type, sockets, height_mm: height, tdp_w: rating, radiator_mm: rad },
});

const ALL_SOCKETS = ['AM4', 'AM5', 'LGA1700', 'LGA1851'];
const ATX_FFS = ['ATX', 'mATX', 'ITX'];

export const PRODUCTS = [
  // ───────── Процессоры ─────────
  cpu('Intel', 'Core i3-12100F', 100, 'LGA1700', 4, 8, 3.3, 4.3, 58, 89, INTEL_AMD_DDR, false, 70),
  cpu('Intel', 'Core i5-12400F', 140, 'LGA1700', 6, 12, 2.5, 4.4, 65, 117, INTEL_AMD_DDR, false, 90),
  cpu('Intel', 'Core i5-13400F', 200, 'LGA1700', 10, 16, 2.5, 4.6, 65, 148, INTEL_AMD_DDR, false, 105),
  cpu('Intel', 'Core i5-14600K', 290, 'LGA1700', 14, 20, 3.5, 5.3, 125, 181, INTEL_AMD_DDR, true, 135),
  cpu('Intel', 'Core i7-14700K', 380, 'LGA1700', 20, 28, 3.4, 5.6, 125, 253, INTEL_AMD_DDR, true, 150),
  cpu('Intel', 'Core i9-14900K', 520, 'LGA1700', 24, 32, 3.2, 6.0, 125, 253, INTEL_AMD_DDR, true, 165),
  cpu('Intel', 'Core Ultra 7 265K', 400, 'LGA1851', 20, 20, 3.9, 5.5, 125, 250, ['DDR5'], true, 158),
  cpu('AMD', 'Ryzen 5 5600', 130, 'AM4', 6, 12, 3.5, 4.4, 65, 88, ['DDR4'], false, 95),
  cpu('AMD', 'Ryzen 7 5800X3D', 300, 'AM4', 8, 16, 3.4, 4.5, 105, 142, ['DDR4'], false, 125),
  cpu('AMD', 'Ryzen 5 7600', 190, 'AM5', 6, 12, 3.8, 5.1, 65, 88, ['DDR5'], true, 125),
  cpu('AMD', 'Ryzen 5 9600X', 230, 'AM5', 6, 12, 3.9, 5.4, 65, 88, ['DDR5'], true, 140),
  cpu('AMD', 'Ryzen 7 7800X3D', 400, 'AM5', 8, 16, 4.2, 5.0, 120, 162, ['DDR5'], true, 175),
  cpu('AMD', 'Ryzen 7 9800X3D', 480, 'AM5', 8, 16, 4.7, 5.2, 120, 162, ['DDR5'], true, 195),
  cpu('AMD', 'Ryzen 9 7950X3D', 600, 'AM5', 16, 32, 4.2, 5.7, 120, 162, ['DDR5'], true, 180),
  cpu('AMD', 'Ryzen 9 9950X', 650, 'AM5', 16, 32, 4.3, 5.7, 170, 230, ['DDR5'], true, 172),

  // ───────── Материнские платы ─────────
  mb('ASRock', 'H610M-HDV/M.2', 70, 'LGA1700', 'H610', 'mATX', 'DDR4', 2, 64, 1, 4, false, 'PCIe 4.0'),
  mb('MSI', 'PRO B660M-A DDR4', 110, 'LGA1700', 'B660', 'mATX', 'DDR4', 4, 128, 2, 4, false, 'PCIe 4.0'),
  mb('MSI', 'MAG B760 Tomahawk WiFi', 200, 'LGA1700', 'B760', 'ATX', 'DDR5', 4, 192, 3, 4, true, 'PCIe 5.0'),
  mb('ASUS', 'ROG STRIX Z790-A Gaming WiFi', 350, 'LGA1700', 'Z790', 'ATX', 'DDR5', 4, 192, 5, 4, true, 'PCIe 5.0'),
  mb('MSI', 'MAG Z890 Tomahawk WiFi', 330, 'LGA1851', 'Z890', 'ATX', 'DDR5', 4, 192, 4, 4, true, 'PCIe 5.0'),
  mb('Gigabyte', 'B550 AORUS Elite V2', 120, 'AM4', 'B550', 'ATX', 'DDR4', 4, 128, 2, 6, false, 'PCIe 4.0'),
  mb('ASUS', 'TUF Gaming B550-Plus WiFi II', 140, 'AM4', 'B550', 'ATX', 'DDR4', 4, 128, 2, 6, true, 'PCIe 4.0'),
  mb('Gigabyte', 'A620M S2H', 90, 'AM5', 'A620', 'mATX', 'DDR5', 2, 96, 2, 4, false, 'PCIe 4.0'),
  mb('MSI', 'MAG B650 Tomahawk WiFi', 200, 'AM5', 'B650', 'ATX', 'DDR5', 4, 192, 2, 4, true, 'PCIe 5.0'),
  mb('ASUS', 'ROG STRIX B650E-I Gaming WiFi', 300, 'AM5', 'B650E', 'ITX', 'DDR5', 2, 96, 2, 2, true, 'PCIe 5.0'),
  mb('ASUS', 'ROG STRIX X870E-E Gaming WiFi', 500, 'AM5', 'X870E', 'ATX', 'DDR5', 4, 192, 4, 4, true, 'PCIe 5.0'),

  // ───────── Оперативная память ─────────
  ram('Kingston', 'FURY Beast 16GB (2x8GB) DDR4-3200', 40, 'DDR4', 16, 2, 3200, 16),
  ram('Corsair', 'Vengeance LPX 32GB (2x16GB) DDR4-3600', 70, 'DDR4', 32, 2, 3600, 18),
  ram('Kingston', 'FURY Beast 16GB (2x8GB) DDR5-5600', 60, 'DDR5', 16, 2, 5600, 40),
  ram('Corsair', 'Vengeance 32GB (2x16GB) DDR5-6000', 100, 'DDR5', 32, 2, 6000, 36),
  ram('G.Skill', 'Trident Z5 RGB 32GB (2x16GB) DDR5-6400', 120, 'DDR5', 32, 2, 6400, 32),
  ram('G.Skill', 'Trident Z5 RGB 64GB (2x32GB) DDR5-6000', 210, 'DDR5', 64, 2, 6000, 30),

  // ───────── Видеокарты ─────────
  gpu('NVIDIA', 'GeForce GTX 1650 4GB', 150, 'TU117', 4, 200, 75, 300, 'нет / none', 40),
  gpu('NVIDIA', 'GeForce RTX 3060 12GB', 280, 'GA106', 12, 242, 170, 550, '1×8-pin', 80),
  gpu('NVIDIA', 'GeForce RTX 4060 8GB', 300, 'AD107', 8, 240, 115, 550, '1×8-pin', 100),
  gpu('NVIDIA', 'GeForce RTX 4060 Ti 8GB', 400, 'AD106', 8, 245, 160, 550, '1×8-pin', 117),
  gpu('NVIDIA', 'GeForce RTX 4070 SUPER 12GB', 600, 'AD104', 12, 267, 220, 650, '1×16-pin', 162),
  gpu('NVIDIA', 'GeForce RTX 4070 Ti SUPER 16GB', 800, 'AD103', 16, 305, 285, 700, '1×16-pin', 190),
  gpu('NVIDIA', 'GeForce RTX 4080 SUPER 16GB', 1000, 'AD103', 16, 310, 320, 750, '1×16-pin', 225),
  gpu('NVIDIA', 'GeForce RTX 4090 24GB', 1800, 'AD102', 24, 336, 450, 850, '1×16-pin', 300),
  gpu('NVIDIA', 'GeForce RTX 5070 12GB', 550, 'GB205', 12, 300, 250, 650, '1×16-pin', 168),
  gpu('NVIDIA', 'GeForce RTX 5080 16GB', 1000, 'GB203', 16, 304, 360, 850, '1×16-pin', 250),
  gpu('NVIDIA', 'GeForce RTX 5090 32GB', 2000, 'GB202', 32, 336, 575, 1000, '1×16-pin', 390),
  gpu('AMD', 'Radeon RX 6600 8GB', 200, 'Navi 23', 8, 190, 132, 450, '1×8-pin', 88),
  gpu('AMD', 'Radeon RX 7600 8GB', 260, 'Navi 33', 8, 204, 165, 550, '1×8-pin', 97),
  gpu('AMD', 'Radeon RX 7800 XT 16GB', 500, 'Navi 32', 16, 267, 263, 700, '2×8-pin', 148),
  gpu('AMD', 'Radeon RX 7900 XTX 24GB', 900, 'Navi 31', 24, 287, 355, 800, '2×8-pin', 235),
  gpu('AMD', 'Radeon RX 9070 XT 16GB', 600, 'Navi 48', 16, 320, 304, 750, '2×8-pin', 215),
  gpu('Intel', 'Arc B580 12GB', 250, 'BMG-G21', 12, 272, 190, 600, '1×8-pin + 1×6-pin', 112),

  // ───────── Накопители ─────────
  storage('Kingston', 'NV2 500GB', 35, 'NVMe SSD', 'M.2', 500, 3500),
  storage('Kingston', 'NV2 1TB', 55, 'NVMe SSD', 'M.2', 1000, 3500),
  storage('WD', 'Blue SN580 1TB', 60, 'NVMe SSD', 'M.2', 1000, 4150),
  storage('Samsung', '990 PRO 1TB', 100, 'NVMe SSD', 'M.2', 1000, 7450),
  storage('WD', 'Black SN850X 2TB', 150, 'NVMe SSD', 'M.2', 2000, 7300),
  storage('Crucial', 'MX500 1TB', 70, 'SATA SSD', 'SATA', 1000, 560),
  storage('Seagate', 'BarraCuda 2TB', 55, 'HDD', 'SATA', 2000, 220),
  storage('Seagate', 'BarraCuda 4TB', 90, 'HDD', 'SATA', 4000, 190),

  // ───────── Блоки питания ─────────
  psu('Deepcool', 'PK550D 550W', 50, 550, '80+ Bronze', 'ATX', false),
  psu('Cooler Master', 'MWE Bronze 650 V2', 65, 650, '80+ Bronze', 'ATX', false),
  psu('be quiet!', 'Pure Power 12 M 650W', 90, 650, '80+ Gold', 'ATX', true),
  psu('Corsair', 'RM750e', 110, 750, '80+ Gold', 'ATX', true),
  psu('MSI', 'MAG A850GL PCIE5', 120, 850, '80+ Gold', 'ATX', true),
  psu('Seasonic', 'FOCUS GX-1000', 170, 1000, '80+ Gold', 'ATX', true),
  psu('Corsair', 'HX1200i', 280, 1200, '80+ Platinum', 'ATX', true),
  psu('Corsair', 'SF750 Platinum', 180, 750, '80+ Platinum', 'SFX', true),

  // ───────── Корпуса ─────────
  pcCase('NZXT', 'H5 Flow', 95, ATX_FFS, 365, 165, [120, 240, 280], ['ATX', 'SFX'], 'Black'),
  pcCase('Lian Li', 'LANCOOL 216', 110, ['ATX', 'mATX', 'ITX'], 392, 180, [120, 240, 280, 360], ['ATX', 'SFX'], 'Black'),
  pcCase('Corsair', '4000D Airflow', 105, ATX_FFS, 360, 170, [120, 240, 280, 360], ['ATX', 'SFX'], 'White'),
  pcCase('Fractal Design', 'North', 140, ATX_FFS, 355, 170, [120, 240, 280, 360], ['ATX', 'SFX'], 'Charcoal'),
  pcCase('Hyte', 'Y60', 200, ATX_FFS, 375, 160, [120, 240, 280, 360], ['ATX', 'SFX'], 'White'),
  pcCase('Montech', 'Air 903 Max', 70, ATX_FFS, 400, 170, [120, 240, 280, 360], ['ATX', 'SFX'], 'Black'),
  pcCase('Cooler Master', 'NR200P', 90, ['ITX'], 330, 155, [120, 240, 280], ['SFX', 'SFX-L'], 'White'),

  // ───────── Охлаждение ─────────
  cooler('Deepcool', 'AK400', 30, 'Air', ALL_SOCKETS, 155, 220, null),
  cooler('Thermalright', 'Peerless Assassin 120 SE', 35, 'Air', ALL_SOCKETS, 155, 245, null),
  cooler('Noctua', 'NH-D15 G2', 150, 'Air', ALL_SOCKETS, 168, 300, null),
  cooler('Arctic', 'Liquid Freezer III 240', 75, 'AIO', ALL_SOCKETS, null, 300, 240),
  cooler('Corsair', 'Nautilus 240 RS', 90, 'AIO', ALL_SOCKETS, null, 280, 240),
  cooler('Arctic', 'Liquid Freezer III 360', 100, 'AIO', ALL_SOCKETS, null, 350, 360),
];
