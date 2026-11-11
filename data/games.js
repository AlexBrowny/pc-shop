// Стартовая база: 20 самых требовательных современных игр.
// gpu_fps — FPS при 1080p на эталонной видеокарте (score = 100, ~RTX 4060) без CPU-ограничения.
// cpu_fps — FPS, упирающийся в процессор, на эталонном CPU (score = 100, ~Core i5-13400F).
// vram    — ориентировочный объём видеопамяти (ГБ) при 1080p; для 1440p/4K масштабируется.
// Порядок значений во всех массивах: [low, medium, high, ultra].
// Цифры — модельные оценки, а не результаты прямых замеров.

export const GAMES = [
  { slug: 'cyberpunk-2077', title: 'Cyberpunk 2077', year: 2020, hue: 55, gpu_fps: [118, 100, 88, 72], cpu_fps: [150, 142, 135, 125], vram: [4, 6, 7, 8], ram_gb: 16 },
  { slug: 'alan-wake-2', title: 'Alan Wake 2', year: 2023, hue: 150, gpu_fps: [75, 58, 46, 36], cpu_fps: [130, 120, 110, 100], vram: [5, 6, 8, 10], ram_gb: 16 },
  { slug: 'black-myth-wukong', title: 'Black Myth: Wukong', year: 2024, hue: 20, gpu_fps: [78, 60, 47, 36], cpu_fps: [95, 88, 82, 75], vram: [5, 7, 8, 10], ram_gb: 16 },
  { slug: 'starfield', title: 'Starfield', year: 2023, hue: 215, gpu_fps: [90, 68, 52, 43], cpu_fps: [75, 70, 62, 58], vram: [4, 6, 8, 10], ram_gb: 16 },
  { slug: 'hogwarts-legacy', title: 'Hogwarts Legacy', year: 2023, hue: 265, gpu_fps: [105, 85, 68, 55], cpu_fps: [100, 90, 80, 70], vram: [5, 7, 9, 10], ram_gb: 16 },
  { slug: 'msfs-2024', title: 'Microsoft Flight Simulator 2024', year: 2024, hue: 200, gpu_fps: [70, 52, 40, 31], cpu_fps: [60, 55, 48, 42], vram: [6, 8, 10, 12], ram_gb: 32 },
  { slug: 'star-wars-outlaws', title: 'Star Wars Outlaws', year: 2024, hue: 35, gpu_fps: [82, 62, 48, 38], cpu_fps: [105, 95, 88, 80], vram: [5, 7, 9, 10], ram_gb: 16 },
  { slug: 'avatar-pandora', title: 'Avatar: Frontiers of Pandora', year: 2023, hue: 175, gpu_fps: [85, 65, 51, 40], cpu_fps: [100, 92, 85, 78], vram: [5, 7, 9, 11], ram_gb: 16 },
  { slug: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', year: 2019, hue: 8, gpu_fps: [125, 98, 78, 62], cpu_fps: [135, 125, 115, 105], vram: [3, 5, 7, 8], ram_gb: 16 },
  { slug: 'stalker-2', title: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl', year: 2024, hue: 95, gpu_fps: [72, 56, 43, 32], cpu_fps: [88, 80, 72, 65], vram: [6, 8, 10, 12], ram_gb: 16 },
  { slug: 'dragons-dogma-2', title: "Dragon's Dogma 2", year: 2024, hue: 28, gpu_fps: [80, 64, 52, 42], cpu_fps: [60, 55, 50, 45], vram: [6, 8, 9, 10], ram_gb: 16 },
  { slug: 'silent-hill-2', title: 'Silent Hill 2', year: 2024, hue: 190, gpu_fps: [85, 64, 49, 38], cpu_fps: [115, 105, 95, 88], vram: [6, 8, 9, 10], ram_gb: 16 },
  { slug: 'indiana-jones-great-circle', title: 'Indiana Jones and the Great Circle', year: 2024, hue: 42, gpu_fps: [95, 70, 54, 42], cpu_fps: [140, 130, 120, 110], vram: [6, 8, 10, 12], ram_gb: 16 },
  { slug: 'assassins-creed-shadows', title: "Assassin's Creed Shadows", year: 2025, hue: 350, gpu_fps: [78, 60, 47, 37], cpu_fps: [90, 82, 75, 68], vram: [6, 8, 10, 12], ram_gb: 16 },
  { slug: 'space-marine-2', title: 'Warhammer 40,000: Space Marine 2', year: 2024, hue: 235, gpu_fps: [112, 88, 70, 55], cpu_fps: [90, 82, 75, 68], vram: [4, 6, 8, 10], ram_gb: 16 },
  { slug: 'god-of-war-ragnarok', title: 'God of War Ragnarök', year: 2024, hue: 205, gpu_fps: [120, 95, 78, 62], cpu_fps: [145, 135, 125, 115], vram: [4, 6, 8, 10], ram_gb: 16 },
  { slug: 'horizon-forbidden-west', title: 'Horizon Forbidden West', year: 2024, hue: 120, gpu_fps: [110, 86, 70, 56], cpu_fps: [125, 115, 105, 95], vram: [5, 7, 9, 11], ram_gb: 16 },
  { slug: 'ghost-of-tsushima', title: 'Ghost of Tsushima', year: 2024, hue: 15, gpu_fps: [135, 110, 92, 74], cpu_fps: [150, 140, 130, 120], vram: [4, 6, 8, 9], ram_gb: 16 },
  { slug: 'witcher-3-next-gen', title: 'The Witcher 3: Wild Hunt (Next-Gen)', year: 2022, hue: 330, gpu_fps: [150, 120, 98, 80], cpu_fps: [105, 95, 88, 80], vram: [3, 5, 6, 8], ram_gb: 16 },
  { slug: 'baldurs-gate-3', title: "Baldur's Gate 3", year: 2023, hue: 280, gpu_fps: [135, 105, 82, 66], cpu_fps: [95, 88, 80, 72], vram: [3, 5, 6, 8], ram_gb: 16 },
];
