// Готовые сборки («быстрый старт»). Состав задаётся slug-ами товаров; цена, совместимость и FPS считаются на сервере.
// Подобраны так, чтобы проходить все проверки совместимости (проверяется тестом).

export const PRESETS = [
  {
    key: 'budget',
    resolution: '1080p',
    parts: {
      cpu: 'intel-core-i5-12400f', motherboard: 'msi-pro-b660m-a-ddr4', ram: 'kingston-fury-beast-16gb-2x8gb-ddr4-3200',
      gpu: 'nvidia-geforce-rtx-3060-12gb', storage: ['kingston-nv2-1tb'], psu: 'deepcool-pk550d-550w', case: 'montech-air-903-max', cooler: 'deepcool-ak400',
    },
  },
  {
    key: 'balanced',
    resolution: '1440p',
    parts: {
      cpu: 'amd-ryzen-5-7600', motherboard: 'msi-mag-b650-tomahawk-wifi', ram: 'corsair-vengeance-32gb-2x16gb-ddr5-6000',
      gpu: 'nvidia-geforce-rtx-4070-super-12gb', storage: ['samsung-990-pro-1tb'], psu: 'corsair-rm750e', case: 'corsair-4000d-airflow', cooler: 'thermalright-peerless-assassin-120-se',
    },
  },
  {
    key: 'compact',
    resolution: '1440p',
    parts: {
      cpu: 'amd-ryzen-7-7800x3d', motherboard: 'asus-rog-strix-b650e-i-gaming-wifi', ram: 'corsair-vengeance-32gb-2x16gb-ddr5-6000',
      gpu: 'nvidia-geforce-rtx-4070-super-12gb', storage: ['samsung-990-pro-1tb'], psu: 'corsair-sf750-platinum', case: 'cooler-master-nr200p', cooler: 'arctic-liquid-freezer-iii-240',
    },
  },
  {
    key: 'ultimate',
    resolution: '2160p',
    parts: {
      cpu: 'amd-ryzen-7-9800x3d', motherboard: 'asus-rog-strix-x870e-e-gaming-wifi', ram: 'g-skill-trident-z5-rgb-32gb-2x16gb-ddr5-6400',
      gpu: 'nvidia-geforce-rtx-5090-32gb', storage: ['wd-black-sn850x-2tb'], psu: 'corsair-hx1200i', case: 'lian-li-lancool-216', cooler: 'arctic-liquid-freezer-iii-360',
    },
  },
];
