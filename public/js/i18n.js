// Двуязычность (русский / узбекский, латиница) и форматирование сумм в сумах.

const STORAGE_KEY = 'pcm_lang';
export const LANGS = ['ru', 'uz'];

const readLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* localStorage недоступен */ }
  return 'ru';
};

let currentLang = readLang();
export const getLang = () => currentLang;
export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  currentLang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'uz' ? 'uz' : 'ru';
}
document.documentElement.lang = currentLang === 'uz' ? 'uz' : 'ru';

const DICT = {
  ru: {
    'brand.tagline': 'Комплектующие для ПК',
    'nav.home': 'Главная', 'nav.catalog': 'Каталог', 'nav.builder': 'Конструктор ПК', 'nav.cart': 'Корзина',
    'theme.light': 'Светлая тема', 'theme.dark': 'Тёмная тема',
    'currency': 'сум',
    'common.add_to_cart': 'В корзину', 'common.in_cart': 'В корзине', 'common.remove': 'Удалить', 'common.reset': 'Сбросить',
    'common.search': 'Поиск', 'common.all': 'Все', 'common.brand': 'Бренд', 'common.price': 'Цена', 'common.from': 'от', 'common.to': 'до',
    'common.sort': 'Сортировка', 'common.nothing': 'Ничего не найдено', 'common.loading': 'Загрузка…', 'common.error': 'Не удалось загрузить данные',
    'common.total': 'Итого', 'common.specs': 'Характеристики', 'common.in_stock': 'В наличии', 'common.stock_n': 'В наличии: {n} шт.',
    'common.yes': 'Да', 'common.no': 'Нет', 'common.back': 'Назад', 'common.close': 'Закрыть', 'common.pcs': 'шт.', 'common.products': 'товаров',
    'sort.name': 'По названию', 'sort.price_asc': 'Сначала дешёвые', 'sort.price_desc': 'Сначала дорогие', 'sort.new': 'Новинки',
    'home.title': 'Соберите свой идеальный ПК', 'home.sub': 'Каталог комплектующих, конструктор с проверкой совместимости и расчётом FPS в самых требовательных играх — все цены в сумах.',
    'home.cta_builder': 'Открыть конструктор', 'home.cta_catalog': 'Перейти в каталог',
    'home.f1_t': 'Проверка совместимости', 'home.f1_d': 'Сокет, тип памяти, размеры корпуса, мощность блока питания — всё проверяется автоматически.',
    'home.f2_t': 'Расчёт FPS', 'home.f2_d': '20 самых требовательных игр на низких, средних, высоких и ультра настройках для вашей сборки.',
    'home.f3_t': 'Цены в сумах', 'home.f3_d': 'Прозрачные цены в узбекских сумах и интерфейс на русском и узбекском языках.',
    'home.categories': 'Категории', 'home.popular': 'Популярные товары',
    'catalog.title': 'Каталог', 'catalog.filters': 'Фильтры', 'catalog.search_ph': 'Название или бренд',
    'product.to_builder': 'Добавить в конструктор', 'product.sku': 'Артикул', 'product.not_found': 'Товар не найден', 'product.added_builder': 'Добавлено в конструктор',
    'cart.title': 'Корзина', 'cart.empty': 'Корзина пуста', 'cart.checkout': 'Оформить заказ', 'cart.clear': 'Очистить корзину', 'cart.go_catalog': 'Перейти в каталог',
    'builder.title': 'Конструктор ПК', 'builder.sub': 'Выбирайте комплектующие по слотам — несовместимые варианты блокируются, а производительность в играх пересчитывается сразу.',
    'builder.choose': 'Выбрать', 'builder.change': 'Заменить', 'builder.add_drive': 'Добавить накопитель', 'builder.max_drives': 'Достигнут лимит накопителей',
    'builder.picker_title': 'Выбор: {cat}', 'builder.hide_blocked': 'Скрыть несовместимые', 'builder.blocked': 'Несовместимо', 'builder.warn': 'С предупреждением', 'builder.compatible': 'Совместимо',
    'builder.summary': 'Сводка сборки', 'builder.power': 'Расчётная мощность', 'builder.rec_psu': 'Рекомендуемый БП', 'builder.compat': 'Совместимость', 'builder.all_ok': 'Проблем не найдено',
    'builder.missing': 'Не хватает: {list}', 'builder.add_all': 'Добавить сборку в корзину', 'builder.reset': 'Очистить сборку', 'builder.added': 'Сборка добавлена в корзину', 'builder.empty_slot': 'Не выбрано',
    'builder.preview': 'Предпросмотр сборки', 'builder.preview_soon': '3D-модель корпуса и режим 2D появятся на следующем этапе.',
    'viewer.glass': 'Стеклянная стенка', 'viewer.rotate': 'Вращать', 'viewer.reset': 'Сбросить вид', 'viewer.fullscreen': 'На весь экран',
    'viewer.hint3d': 'Тяните мышью — вращение, колесо — масштаб, правая кнопка — сдвиг.', 'viewer.hint2d': 'Вид сбоку (2D): колесо — масштаб, перетаскивание — сдвиг.',
    'viewer.default_case': 'Корпус не выбран — показан условный корпус.', 'viewer.no_webgl': 'Не удалось запустить 3D (WebGL недоступен).', 'viewer.loading': 'Загрузка 3D…',
    'viewer.credits': 'Все модели построены программно: форма и размеры деталей соответствуют выбранным товарам.',
    'checkout.title': 'Оформление заказа', 'checkout.items': 'Ваш заказ', 'checkout.contacts': 'Контакты', 'checkout.payment': 'Оплата',
    'checkout.name': 'Имя и фамилия', 'checkout.phone': 'Телефон', 'checkout.address': 'Адрес доставки (необязательно)', 'checkout.comment': 'Комментарий (необязательно)',
    'checkout.pay_to': 'Переведите {sum} на карту и приложите чек:', 'checkout.card': 'Номер карты', 'checkout.holder': 'Получатель', 'checkout.copy': 'Копировать', 'checkout.copied': 'Скопировано',
    'checkout.receipt': 'Чек об оплате', 'checkout.receipt_hint': 'Скриншот или фото чека (PNG, JPG, WEBP) либо PDF, до {mb} МБ', 'checkout.choose_file': 'Выбрать файл', 'checkout.no_file': 'Файл не выбран',
    'checkout.submit': 'Отправить заказ', 'checkout.sending': 'Отправка…', 'checkout.empty': 'Корзина пуста — нечего оформлять.', 'checkout.no_payment': 'Реквизиты для оплаты уточнит менеджер после заказа.',
    'checkout.done_title': 'Заказ №{id} принят', 'checkout.done_text': 'Мы получили ваш чек и передали заказ менеджеру. Он свяжется с вами по телефону {phone} для подтверждения.', 'checkout.done_total': 'Сумма заказа',
    'err.invalid_name': 'Введите имя (не короче 2 символов).', 'err.invalid_phone': 'Введите телефон в формате +998 90 123 45 67.', 'err.receipt_required': 'Приложите чек об оплате.',
    'err.receipt_invalid_type': 'Файл должен быть изображением (PNG, JPG, WEBP) или PDF.', 'err.file_too_large': 'Файл слишком большой.', 'err.out_of_stock': 'Недостаточно товара на складе: {product}.',
    'err.unknown_product': 'Один из товаров больше недоступен — обновите корзину.', 'err.invalid_items': 'Корзина пуста или содержит ошибки.', 'err.too_many_requests': 'Слишком много попыток, попробуйте позже.', 'err.generic': 'Не удалось отправить заказ. Попробуйте ещё раз.',
    'home.eyebrow': 'Сборка · Совместимость · FPS', 'home.title_a': 'Соберите свой', 'home.title_b': 'идеальный ПК',
    'home.stat_products': 'товаров в каталоге', 'home.stat_games': 'игр для расчёта FPS', 'home.stat_view': 'предпросмотр сборки',
    'home.chip_ok': 'Совместимо', 'home.chip_3d': '3D-сборка', 'home.steps': 'Как это работает',
    'home.s1_t': 'Выберите детали', 'home.s1_d': 'Собирайте ПК по слотам: процессор, плата, память, видеокарта, накопители, блок питания, корпус и охлаждение.',
    'home.s2_t': 'Проверьте совместимость', 'home.s2_d': 'Сокет, тип памяти, размеры корпуса, мощность блока питания — несовместимое блокируется автоматически.',
    'home.s3_t': 'Оцените FPS и закажите', 'home.s3_d': 'Смотрите FPS в 20 самых требовательных играх и оформляйте заказ с оплатой по чеку.',
    'home.cta_t': 'Готовы собрать свой ПК?', 'home.cta_d': 'Откройте конструктор: детали ставятся в 3D-корпус, а FPS пересчитывается сразу.',
    'common.stock_low': 'Осталось {n}', 'common.stock_ok': 'В наличии',
    'search.title': 'Быстрый поиск', 'search.placeholder': 'Поиск деталей…', 'nav.new_build': 'Новая сборка', 'nav.categories': 'Категории', 'nav.collapse': 'Свернуть', 'nav.start': 'Начать сборку', 'nav.menu': 'Меню',
    'home2.title_a': 'Собирайте ПК', 'home2.title_b': 'в 3D', 'home2.sub': 'Каталог комплектующих, проверка совместимости, расчёт FPS и оплата по чеку — всё в одном месте. Цены в сумах.',
    'home2.f1': '3D-предпросмотр сборки', 'home2.f2': 'Проверка совместимости', 'home2.f3': 'Расчёт FPS в играх', 'home2.f4': 'Цены в сумах (UZS)', 'home2.stat_cats': 'категорий',
    'home2.compatible': 'Совместимо', 'home2.build_total': 'Итого', 'home2.drag': 'Вращайте мышью',
    'qs.title': 'Выберите готовую сборку', 'qs.sub': 'Откройте сборку в конструкторе и меняйте любые детали.', 'qs.scratch': 'Собрать с нуля', 'qs.fps': '~{n} FPS · {res}', 'qs.loaded': 'Сборка загружена',
    'qs.budget': 'Бюджетная 1080p', 'qs.balanced': 'Универсальная 1440p', 'qs.compact': 'Компактная ITX', 'qs.ultimate': 'Максимум 4K',
    'bento.title': 'Всё для сборки ПК', 'bento.sub': 'Подберите детали, проверьте совместимость, оцените FPS и закажите.',
    'bento.b3d_t': '3D-конструктор', 'bento.b3d_d': 'Смотрите, как детали встают в корпус, вращайте сцену и переключайтесь в 2D.',
    'bento.compat_t': 'Расширенная проверка совместимости', 'bento.compat_socket': 'Сокет процессора', 'bento.compat_mem': 'Тип памяти', 'bento.compat_gpu': 'Длина видеокарты', 'bento.compat_cooler': 'Высота кулера',
    'bento.fps_t': 'FPS в играх', 'bento.fps_d': '20 самых требовательных игр, 4 пресета графики и 3 разрешения.',
    'bento.power_t': 'Мощность и блок питания', 'bento.power_draw': 'Потребление', 'bento.price_t': 'Цены в сумах', 'bento.pay_t': 'Оплата чеком', 'bento.pay_d': 'Приложите чек — менеджер получит его в Telegram.', 'bento.lang_t': 'Русский и узбекский',
    'bld.title': 'Конструктор ПК', 'bld.parts': 'Детали', 'bld.fps_tab': 'FPS в играх', 'bld.section': 'Сборка ПК', 'bld.checkout': 'Оформить',
    'bld.status_ok': 'Совместимо', 'bld.status_issues': 'Проблем: {n}', 'bld.status_empty': 'Пока пусто', 'bld.fps_avg': 'Ø {n} FPS',
    'pk.summary': 'Ваша сборка', 'pk.parts': 'Деталей', 'pk.price': 'Цена', 'pk.watts': 'Мощность', 'pk.compat_filter': 'Только совместимые', 'pk.in_stock': 'В наличии',
    'pk.brand': 'Производитель', 'pk.price_range': 'Цена, сум', 'pk.showing': 'Показано {n} из {total}', 'pk.add': 'Добавить в сборку', 'pk.incompatible': 'Несовместимо', 'pk.selected': 'В сборке',
    'pk.sort_compat': 'Сначала подходящие', 'pk.sort_price_asc': 'Сначала дешёвые', 'pk.sort_price_desc': 'Сначала дорогие', 'pk.sort_name': 'По названию',
    'viewer.zoom_in': 'Приблизить', 'viewer.zoom_out': 'Отдалить',
    'fps.title': 'Ожидаемый FPS в играх', 'fps.resolution': 'Разрешение', 'fps.game': 'Игра', 'fps.avg': 'Средний FPS',
    'fps.need_parts': 'Выберите процессор и видеокарту, чтобы рассчитать FPS.', 'fps.assume_ram': 'ОЗУ не выбрана — расчёт без учёта памяти.',
    'fps.disclaimer': 'Это модельная оценка по относительной производительности комплектующих, а не результат прямых замеров. Реальный FPS зависит от драйверов, версии игры и сцены.',
    'fps.bottleneck': 'Ограничивает', 'fps.bn_gpu': 'видеокарта', 'fps.bn_cpu': 'процессор', 'fps.bn_vram': 'видеопамять',
    'fps.legend_bad': '< 30 — тормозит', 'fps.legend_ok': '30–59 — играбельно', 'fps.legend_good': '60–143 — плавно', 'fps.legend_great': '144+ — отлично',
    'preset.low': 'Низкие', 'preset.medium': 'Средние', 'preset.high': 'Высокие', 'preset.ultra': 'Ультра',
    'res.1080p': '1080p (Full HD)', 'res.1440p': '1440p (2K)', 'res.2160p': '2160p (4K)',
    'footer.note': 'Учебный проект. Цены и характеристики ориентировочные.',
    'cat.cpu': 'Процессор', 'cat.motherboard': 'Материнская плата', 'cat.ram': 'Оперативная память', 'cat.gpu': 'Видеокарта', 'cat.storage': 'Накопитель', 'cat.psu': 'Блок питания', 'cat.case': 'Корпус', 'cat.cooler': 'Охлаждение',
    'catpl.cpu': 'процессор', 'catpl.motherboard': 'материнская плата', 'catpl.ram': 'память', 'catpl.gpu': 'видеокарта', 'catpl.storage': 'накопитель', 'catpl.psu': 'блок питания', 'catpl.case': 'корпус', 'catpl.cooler': 'охлаждение',
    'issue.socket_mismatch': 'Сокет процессора ({cpu}) не совпадает с сокетом материнской платы ({mb}).',
    'issue.ram_type_mismatch': 'Материнская плата поддерживает {mb}, а выбранная память — {ram}.',
    'issue.cpu_ram_type': 'Процессор поддерживает память {cpu}, выбрана {ram}.',
    'issue.ram_slots': 'Модулей памяти: {modules}, а слотов на плате: {slots}.',
    'issue.ram_capacity': 'Объём памяти {capacity} ГБ превышает максимум платы ({max} ГБ).',
    'issue.form_factor': 'Плата формата {mb} не помещается в корпус (поддерживает: {supported}).',
    'issue.gpu_length': 'Видеокарта ({gpu} мм) длиннее допустимого для корпуса ({max} мм).',
    'issue.psu_form_factor': 'Блок питания {psu} не подходит корпусу (поддерживает: {supported}).',
    'issue.cooler_socket': 'Кулер не поддерживает сокет {socket}.',
    'issue.cooler_height': 'Высота кулера ({height} мм) больше допустимой для корпуса ({max} мм).',
    'issue.radiator_support': 'Корпус не поддерживает радиатор {radiator} мм (поддерживает: {supported}).',
    'issue.cooler_weak': 'Охлаждение рассчитано на {cooler} Вт, процессор может потреблять до {cpu} Вт — возможен перегрев.',
    'issue.m2_slots': 'Нужно слотов M.2: {need}, на плате: {have}.',
    'issue.sata_ports': 'Нужно портов SATA: {need}, на плате: {have}.',
    'issue.psu_insufficient': 'Блок питания {psu} Вт не тянет систему (расчётная нагрузка {est} Вт).',
    'issue.psu_low_headroom': 'Маленький запас мощности: рекомендуется БП от {recommended} Вт, выбран {psu} Вт.',
    'issue.no_display': 'У процессора нет встроенной графики — добавьте видеокарту.',
    'spec.socket': 'Сокет', 'spec.cores': 'Ядра', 'spec.threads': 'Потоки', 'spec.base_ghz': 'Базовая частота', 'spec.boost_ghz': 'Макс. частота',
    'spec.tdp_w': 'TDP', 'spec.max_power_w': 'Макс. потребление', 'spec.ram_types': 'Типы памяти', 'spec.igpu': 'Встроенная графика',
    'spec.chipset': 'Чипсет', 'spec.form_factor': 'Форм-фактор', 'spec.ram_type': 'Тип памяти', 'spec.ram_slots': 'Слотов ОЗУ', 'spec.max_ram_gb': 'Макс. ОЗУ',
    'spec.m2_slots': 'Слотов M.2', 'spec.sata_ports': 'Портов SATA', 'spec.wifi': 'Wi-Fi', 'spec.pcie': 'PCIe',
    'spec.capacity_gb': 'Объём', 'spec.modules': 'Модулей', 'spec.speed_mhz': 'Частота', 'spec.latency_cl': 'Тайминги (CL)',
    'spec.chip': 'Графический чип', 'spec.vram_gb': 'Видеопамять', 'spec.length_mm': 'Длина', 'spec.power_w': 'Потребление', 'spec.rec_psu_w': 'Рекомендуемый БП', 'spec.connector': 'Доп. питание',
    'spec.storage_type': 'Тип', 'spec.interface': 'Интерфейс', 'spec.read_mbs': 'Скорость чтения',
    'spec.wattage_w': 'Мощность', 'spec.efficiency': 'Сертификат', 'spec.modular': 'Модульный',
    'spec.form_factors': 'Форматы плат', 'spec.max_gpu_mm': 'Макс. длина видеокарты', 'spec.max_cooler_mm': 'Макс. высота кулера', 'spec.radiators': 'Радиаторы СЖО', 'spec.psu_form_factors': 'Форматы БП', 'spec.color': 'Цвет',
    'spec.cooler_type': 'Тип охлаждения', 'spec.sockets': 'Сокеты', 'spec.height_mm': 'Высота', 'spec.radiator_mm': 'Радиатор',
    'val.Air': 'Воздушное', 'val.AIO': 'Жидкостное (СЖО)', 'val.Black': 'Чёрный', 'val.White': 'Белый', 'val.Charcoal': 'Графитовый',
    'unit.mb': 'МБ', 'unit.kb': 'КБ', 'unit.ghz': 'ГГц', 'unit.w': 'Вт', 'unit.mm': 'мм', 'unit.gb': 'ГБ', 'unit.tb': 'ТБ', 'unit.mhz': 'МГц', 'unit.mbs': 'МБ/с', 'unit.cores': 'ядер', 'unit.threads': 'потоков',
  },
  uz: {
    'brand.tagline': 'Kompyuter butlovchi qismlari',
    'nav.home': 'Bosh sahifa', 'nav.catalog': 'Katalog', 'nav.builder': 'PC konstruktori', 'nav.cart': 'Savat',
    'theme.light': 'Yorug\' rejim', 'theme.dark': 'Tungi rejim',
    'currency': 'so\'m',
    'common.add_to_cart': 'Savatga', 'common.in_cart': 'Savatda', 'common.remove': 'O\'chirish', 'common.reset': 'Tozalash',
    'common.search': 'Qidiruv', 'common.all': 'Barchasi', 'common.brand': 'Brend', 'common.price': 'Narx', 'common.from': 'dan', 'common.to': 'gacha',
    'common.sort': 'Saralash', 'common.nothing': 'Hech narsa topilmadi', 'common.loading': 'Yuklanmoqda…', 'common.error': 'Ma\'lumotlarni yuklab bo\'lmadi',
    'common.total': 'Jami', 'common.specs': 'Xususiyatlari', 'common.in_stock': 'Omborda bor', 'common.stock_n': 'Omborda: {n} dona',
    'common.yes': 'Ha', 'common.no': 'Yo\'q', 'common.back': 'Orqaga', 'common.close': 'Yopish', 'common.pcs': 'dona', 'common.products': 'ta mahsulot',
    'sort.name': 'Nomi bo\'yicha', 'sort.price_asc': 'Avval arzonlari', 'sort.price_desc': 'Avval qimmatlari', 'sort.new': 'Yangilari',
    'home.title': 'O\'zingizning ideal kompyuteringizni yig\'ing', 'home.sub': 'Butlovchi qismlar katalogi, moslikni tekshiradigan konstruktor va eng talabchan o\'yinlarda FPS hisob-kitobi — barcha narxlar so\'mda.',
    'home.cta_builder': 'Konstruktorni ochish', 'home.cta_catalog': 'Katalogga o\'tish',
    'home.f1_t': 'Moslikni tekshirish', 'home.f1_d': 'Rozetka, xotira turi, korpus o\'lchamlari, quvvat bloki quvvati — hammasi avtomatik tekshiriladi.',
    'home.f2_t': 'FPS hisob-kitobi', 'home.f2_d': 'Eng talabchan 20 ta o\'yin past, o\'rtacha, yuqori va ultra sozlamalarda sizning yig\'ilmangiz uchun.',
    'home.f3_t': 'Narxlar so\'mda', 'home.f3_d': 'O\'zbek so\'mida shaffof narxlar, interfeys rus va o\'zbek tillarida.',
    'home.categories': 'Kategoriyalar', 'home.popular': 'Ommabop mahsulotlar',
    'catalog.title': 'Katalog', 'catalog.filters': 'Filtrlar', 'catalog.search_ph': 'Nomi yoki brendi',
    'product.to_builder': 'Konstruktorga qo\'shish', 'product.sku': 'Artikul', 'product.not_found': 'Mahsulot topilmadi', 'product.added_builder': 'Konstruktorga qo\'shildi',
    'cart.title': 'Savat', 'cart.empty': 'Savat bo\'sh', 'cart.checkout': 'Buyurtma berish', 'cart.clear': 'Savatni tozalash', 'cart.go_catalog': 'Katalogga o\'tish',
    'builder.title': 'PC konstruktori', 'builder.sub': 'Butlovchi qismlarni uyalar bo\'yicha tanlang — mos kelmaydiganlari bloklanadi, o\'yinlardagi unumdorlik esa darhol qayta hisoblanadi.',
    'builder.choose': 'Tanlash', 'builder.change': 'Almashtirish', 'builder.add_drive': 'Xotira qurilmasini qo\'shish', 'builder.max_drives': 'Qurilmalar limiti to\'ldi',
    'builder.picker_title': 'Tanlash: {cat}', 'builder.hide_blocked': 'Mos kelmaydiganlarni yashirish', 'builder.blocked': 'Mos emas', 'builder.warn': 'Ogohlantirish bilan', 'builder.compatible': 'Mos',
    'builder.summary': 'Yig\'ilma xulosasi', 'builder.power': 'Hisoblangan quvvat', 'builder.rec_psu': 'Tavsiya etilgan quvvat bloki', 'builder.compat': 'Moslik', 'builder.all_ok': 'Muammolar topilmadi',
    'builder.missing': 'Yetishmaydi: {list}', 'builder.add_all': 'Yig\'ilmani savatga qo\'shish', 'builder.reset': 'Yig\'ilmani tozalash', 'builder.added': 'Yig\'ilma savatga qo\'shildi', 'builder.empty_slot': 'Tanlanmagan',
    'builder.preview': 'Yig\'ilmani oldindan ko\'rish', 'builder.preview_soon': 'Korpusning 3D modeli va 2D rejimi keyingi bosqichda paydo bo\'ladi.',
    'viewer.glass': 'Shisha panel', 'viewer.rotate': 'Aylantirish', 'viewer.reset': 'Ko\'rinishni tiklash', 'viewer.fullscreen': 'To\'liq ekran',
    'viewer.hint3d': 'Sichqoncha bilan tortib aylantiring, g\'ildirak — masshtab, o\'ng tugma — siljitish.', 'viewer.hint2d': 'Yon ko\'rinish (2D): g\'ildirak — masshtab, tortish — siljitish.',
    'viewer.default_case': 'Korpus tanlanmagan — shartli korpus ko\'rsatilgan.', 'viewer.no_webgl': '3D ni ishga tushirib bo\'lmadi (WebGL mavjud emas).', 'viewer.loading': '3D yuklanmoqda…',
    'viewer.credits': "Barcha modellar dasturiy qurilgan: detallarning shakli va o'lchamlari tanlangan tovarlarga mos keladi.",
    'checkout.title': 'Buyurtmani rasmiylashtirish', 'checkout.items': 'Sizning buyurtmangiz', 'checkout.contacts': 'Aloqa', 'checkout.payment': 'To\'lov',
    'checkout.name': 'Ism va familiya', 'checkout.phone': 'Telefon', 'checkout.address': 'Yetkazib berish manzili (ixtiyoriy)', 'checkout.comment': 'Izoh (ixtiyoriy)',
    'checkout.pay_to': '{sum} ni kartaga o\'tkazing va chekni biriktiring:', 'checkout.card': 'Karta raqami', 'checkout.holder': 'Qabul qiluvchi', 'checkout.copy': 'Nusxalash', 'checkout.copied': 'Nusxalandi',
    'checkout.receipt': 'To\'lov cheki', 'checkout.receipt_hint': 'Chek skrinshoti yoki rasmi (PNG, JPG, WEBP) yoki PDF, {mb} MB gacha', 'checkout.choose_file': 'Fayl tanlash', 'checkout.no_file': 'Fayl tanlanmagan',
    'checkout.submit': 'Buyurtmani yuborish', 'checkout.sending': 'Yuborilmoqda…', 'checkout.empty': 'Savat bo\'sh — rasmiylashtiradigan narsa yo\'q.', 'checkout.no_payment': 'To\'lov rekvizitlarini buyurtmadan so\'ng menejer aytadi.',
    'checkout.done_title': '№{id} buyurtma qabul qilindi', 'checkout.done_text': 'Chekingizni oldik va buyurtmani menejerga uzatdik. U tasdiqlash uchun {phone} raqamiga qo\'ng\'iroq qiladi.', 'checkout.done_total': 'Buyurtma summasi',
    'err.invalid_name': 'Ismni kiriting (kamida 2 belgi).', 'err.invalid_phone': 'Telefonni +998 90 123 45 67 ko\'rinishida kiriting.', 'err.receipt_required': 'To\'lov chekini biriktiring.',
    'err.receipt_invalid_type': 'Fayl rasm (PNG, JPG, WEBP) yoki PDF bo\'lishi kerak.', 'err.file_too_large': 'Fayl juda katta.', 'err.out_of_stock': 'Omborda yetarli emas: {product}.',
    'err.unknown_product': 'Mahsulotlardan biri endi mavjud emas — savatni yangilang.', 'err.invalid_items': 'Savat bo\'sh yoki xatolarga ega.', 'err.too_many_requests': 'Urinishlar juda ko\'p, keyinroq urinib ko\'ring.', 'err.generic': 'Buyurtmani yuborib bo\'lmadi. Qayta urinib ko\'ring.',
    'home.eyebrow': 'Yig\'ish · Moslik · FPS', 'home.title_a': 'O\'zingizning', 'home.title_b': 'ideal kompyuteringizni yig\'ing',
    'home.stat_products': 'katalogdagi mahsulot', 'home.stat_games': 'FPS hisoblash uchun o\'yin', 'home.stat_view': 'yig\'ilmani oldindan ko\'rish',
    'home.chip_ok': 'Mos', 'home.chip_3d': '3D yig\'ilma', 'home.steps': 'Qanday ishlaydi',
    'home.s1_t': 'Qismlarni tanlang', 'home.s1_d': 'Kompyuterni uyalar bo\'yicha yig\'ing: protsessor, anakart, xotira, videokarta, xotira qurilmalari, quvvat bloki, korpus va sovutish.',
    'home.s2_t': 'Moslikni tekshiring', 'home.s2_d': 'Rozetka, xotira turi, korpus o\'lchamlari, quvvat bloki quvvati — mos kelmaydiganlari avtomatik bloklanadi.',
    'home.s3_t': 'FPS ni baholang va buyurtma bering', 'home.s3_d': 'Eng talabchan 20 ta o\'yinda FPS ni ko\'ring va chek orqali to\'lov bilan buyurtma bering.',
    'home.cta_t': 'Kompyuteringizni yig\'ishga tayyormisiz?', 'home.cta_d': 'Konstruktorni oching: qismlar 3D korpusga joylashadi, FPS esa darhol qayta hisoblanadi.',
    'common.stock_low': 'Qoldi: {n}', 'common.stock_ok': 'Omborda bor',
    'search.title': 'Tezkor qidiruv', 'search.placeholder': 'Qismlarni qidirish…', 'nav.new_build': 'Yangi yig\'ilma', 'nav.categories': 'Kategoriyalar', 'nav.collapse': 'Yig\'ish', 'nav.start': 'Yig\'ishni boshlash', 'nav.menu': 'Menyu',
    'home2.title_a': 'Kompyuterni', 'home2.title_b': '3D da yig\'ing', 'home2.sub': 'Butlovchi qismlar katalogi, moslikni tekshirish, FPS hisob-kitobi va chek orqali to\'lov — hammasi bir joyda. Narxlar so\'mda.',
    'home2.f1': 'Yig\'ilmani 3D da ko\'rish', 'home2.f2': 'Moslikni tekshirish', 'home2.f3': 'O\'yinlarda FPS hisobi', 'home2.f4': 'Narxlar so\'mda (UZS)', 'home2.stat_cats': 'kategoriya',
    'home2.compatible': 'Mos', 'home2.build_total': 'Jami', 'home2.drag': 'Sichqoncha bilan aylantiring',
    'qs.title': 'Tayyor yig\'ilmani tanlang', 'qs.sub': 'Yig\'ilmani konstruktorda oching va istalgan qismni almashtiring.', 'qs.scratch': 'Noldan yig\'ish', 'qs.fps': '~{n} FPS · {res}', 'qs.loaded': 'Yig\'ilma yuklandi',
    'qs.budget': 'Byudjetli 1080p', 'qs.balanced': 'Universal 1440p', 'qs.compact': 'Ixcham ITX', 'qs.ultimate': 'Maksimum 4K',
    'bento.title': 'Kompyuter yig\'ish uchun hamma narsa', 'bento.sub': 'Qismlarni tanlang, moslikni tekshiring, FPS ni baholang va buyurtma bering.',
    'bento.b3d_t': '3D konstruktor', 'bento.b3d_d': 'Qismlar korpusga qanday joylashishini ko\'ring, sahnani aylantiring va 2D ga o\'ting.',
    'bento.compat_t': 'Kengaytirilgan moslik tekshiruvi', 'bento.compat_socket': 'Protsessor rozetkasi', 'bento.compat_mem': 'Xotira turi', 'bento.compat_gpu': 'Videokarta uzunligi', 'bento.compat_cooler': 'Kuler balandligi',
    'bento.fps_t': 'O\'yinlarda FPS', 'bento.fps_d': 'Eng talabchan 20 ta o\'yin, 4 ta grafika sozlamasi va 3 ta ekran o\'lchami.',
    'bento.power_t': 'Quvvat va quvvat bloki', 'bento.power_draw': 'Iste\'mol', 'bento.price_t': 'Narxlar so\'mda', 'bento.pay_t': 'Chek orqali to\'lov', 'bento.pay_d': 'Chekni biriktiring — menejer uni Telegram da oladi.', 'bento.lang_t': 'Rus va o\'zbek tillari',
    'bld.title': 'PC konstruktori', 'bld.parts': 'Qismlar', 'bld.fps_tab': 'O\'yinlarda FPS', 'bld.section': 'Kompyuter yig\'ilmasi', 'bld.checkout': 'Rasmiylashtirish',
    'bld.status_ok': 'Mos', 'bld.status_issues': 'Muammolar: {n}', 'bld.status_empty': 'Hozircha bo\'sh', 'bld.fps_avg': 'Ø {n} FPS',
    'pk.summary': 'Sizning yig\'ilmangiz', 'pk.parts': 'Qismlar', 'pk.price': 'Narx', 'pk.watts': 'Quvvat', 'pk.compat_filter': 'Faqat mos kelganlar', 'pk.in_stock': 'Omborda bor',
    'pk.brand': 'Ishlab chiqaruvchi', 'pk.price_range': 'Narx, so\'m', 'pk.showing': '{total} tadan {n} ta ko\'rsatilgan', 'pk.add': 'Yig\'ilmaga qo\'shish', 'pk.incompatible': 'Mos emas', 'pk.selected': 'Yig\'ilmada',
    'pk.sort_compat': 'Avval mos kelganlar', 'pk.sort_price_asc': 'Avval arzonlari', 'pk.sort_price_desc': 'Avval qimmatlari', 'pk.sort_name': 'Nomi bo\'yicha',
    'viewer.zoom_in': 'Yaqinlashtirish', 'viewer.zoom_out': 'Uzoqlashtirish',
    'fps.title': 'O\'yinlarda kutilayotgan FPS', 'fps.resolution': 'Ekran o\'lchami', 'fps.game': 'O\'yin', 'fps.avg': 'O\'rtacha FPS',
    'fps.need_parts': 'FPS hisoblash uchun protsessor va videokartani tanlang.', 'fps.assume_ram': 'RAM tanlanmagan — hisob-kitob xotirani hisobga olmasdan.',
    'fps.disclaimer': 'Bu butlovchi qismlarning nisbiy unumdorligiga asoslangan modelli baho, to\'g\'ridan-to\'g\'ri o\'lchov natijasi emas. Haqiqiy FPS drayverlar, o\'yin versiyasi va sahnaga bog\'liq.',
    'fps.bottleneck': 'Cheklayapti', 'fps.bn_gpu': 'videokarta', 'fps.bn_cpu': 'protsessor', 'fps.bn_vram': 'videoxotira',
    'fps.legend_bad': '< 30 — qotadi', 'fps.legend_ok': '30–59 — o\'ynasa bo\'ladi', 'fps.legend_good': '60–143 — silliq', 'fps.legend_great': '144+ — a\'lo',
    'preset.low': 'Past', 'preset.medium': 'O\'rtacha', 'preset.high': 'Yuqori', 'preset.ultra': 'Ultra',
    'res.1080p': '1080p (Full HD)', 'res.1440p': '1440p (2K)', 'res.2160p': '2160p (4K)',
    'footer.note': 'O\'quv loyiha. Narxlar va xususiyatlar taxminiy.',
    'cat.cpu': 'Protsessor', 'cat.motherboard': 'Anakart', 'cat.ram': 'Operativ xotira', 'cat.gpu': 'Videokarta', 'cat.storage': 'Xotira qurilmasi', 'cat.psu': 'Quvvat bloki', 'cat.case': 'Korpus', 'cat.cooler': 'Sovutish',
    'catpl.cpu': 'protsessor', 'catpl.motherboard': 'anakart', 'catpl.ram': 'xotira', 'catpl.gpu': 'videokarta', 'catpl.storage': 'xotira qurilmasi', 'catpl.psu': 'quvvat bloki', 'catpl.case': 'korpus', 'catpl.cooler': 'sovutish',
    'issue.socket_mismatch': 'Protsessor rozetkasi ({cpu}) anakart rozetkasiga ({mb}) mos kelmaydi.',
    'issue.ram_type_mismatch': 'Anakart {mb} xotirasini qo\'llab-quvvatlaydi, tanlangan xotira esa {ram}.',
    'issue.cpu_ram_type': 'Protsessor {cpu} xotirasini qo\'llab-quvvatlaydi, {ram} tanlangan.',
    'issue.ram_slots': 'Xotira modullari: {modules}, platadagi uyalar: {slots}.',
    'issue.ram_capacity': 'Xotira hajmi {capacity} GB platadagi maksimumdan ({max} GB) oshib ketdi.',
    'issue.form_factor': '{mb} formatidagi anakart korpusga sig\'maydi (qo\'llab-quvvatlanadi: {supported}).',
    'issue.gpu_length': 'Videokarta ({gpu} mm) korpus uchun ruxsat etilgandan ({max} mm) uzun.',
    'issue.psu_form_factor': '{psu} formatidagi quvvat bloki korpusga mos emas (qo\'llab-quvvatlanadi: {supported}).',
    'issue.cooler_socket': 'Kuler {socket} rozetkasini qo\'llab-quvvatlamaydi.',
    'issue.cooler_height': 'Kuler balandligi ({height} mm) korpus uchun ruxsat etilgandan ({max} mm) katta.',
    'issue.radiator_support': 'Korpus {radiator} mm radiatorni qo\'llab-quvvatlamaydi (qo\'llab-quvvatlanadi: {supported}).',
    'issue.cooler_weak': 'Sovutish {cooler} Vt uchun mo\'ljallangan, protsessor {cpu} Vt gacha iste\'mol qilishi mumkin — qizib ketishi mumkin.',
    'issue.m2_slots': 'Kerakli M.2 uyalari: {need}, platada: {have}.',
    'issue.sata_ports': 'Kerakli SATA portlari: {need}, platada: {have}.',
    'issue.psu_insufficient': '{psu} Vt quvvat bloki tizimni ko\'tarolmaydi (hisoblangan yuklama {est} Vt).',
    'issue.psu_low_headroom': 'Quvvat zaxirasi kam: kamida {recommended} Vt blok tavsiya etiladi, {psu} Vt tanlangan.',
    'issue.no_display': 'Protsessorda o\'rnatilgan grafika yo\'q — videokarta qo\'shing.',
    'spec.socket': 'Rozetka (soket)', 'spec.cores': 'Yadrolar', 'spec.threads': 'Oqimlar', 'spec.base_ghz': 'Asosiy chastota', 'spec.boost_ghz': 'Maks. chastota',
    'spec.tdp_w': 'TDP', 'spec.max_power_w': 'Maks. iste\'mol', 'spec.ram_types': 'Xotira turlari', 'spec.igpu': 'O\'rnatilgan grafika',
    'spec.chipset': 'Chipset', 'spec.form_factor': 'Format', 'spec.ram_type': 'Xotira turi', 'spec.ram_slots': 'RAM uyalari', 'spec.max_ram_gb': 'Maks. RAM',
    'spec.m2_slots': 'M.2 uyalari', 'spec.sata_ports': 'SATA portlari', 'spec.wifi': 'Wi-Fi', 'spec.pcie': 'PCIe',
    'spec.capacity_gb': 'Hajmi', 'spec.modules': 'Modullar', 'spec.speed_mhz': 'Chastota', 'spec.latency_cl': 'Taymings (CL)',
    'spec.chip': 'Grafik chip', 'spec.vram_gb': 'Videoxotira', 'spec.length_mm': 'Uzunligi', 'spec.power_w': 'Iste\'mol', 'spec.rec_psu_w': 'Tavsiya etilgan quvvat bloki', 'spec.connector': 'Qo\'shimcha quvvat',
    'spec.storage_type': 'Turi', 'spec.interface': 'Interfeys', 'spec.read_mbs': 'O\'qish tezligi',
    'spec.wattage_w': 'Quvvati', 'spec.efficiency': 'Sertifikat', 'spec.modular': 'Modulli',
    'spec.form_factors': 'Anakart formatlari', 'spec.max_gpu_mm': 'Videokarta maks. uzunligi', 'spec.max_cooler_mm': 'Kuler maks. balandligi', 'spec.radiators': 'SVS radiatorlari', 'spec.psu_form_factors': 'Quvvat bloki formatlari', 'spec.color': 'Rangi',
    'spec.cooler_type': 'Sovutish turi', 'spec.sockets': 'Rozetkalar', 'spec.height_mm': 'Balandligi', 'spec.radiator_mm': 'Radiator',
    'val.Air': 'Havoli', 'val.AIO': 'Suyuqlikli (SVS)', 'val.Black': 'Qora', 'val.White': 'Oq', 'val.Charcoal': 'Grafit',
    'unit.mb': 'MB', 'unit.kb': 'KB', 'unit.ghz': 'GGts', 'unit.w': 'Vt', 'unit.mm': 'mm', 'unit.gb': 'GB', 'unit.tb': 'TB', 'unit.mhz': 'MGts', 'unit.mbs': 'MB/s', 'unit.cores': 'yadro', 'unit.threads': 'oqim',
  },
};

export function t(key, params) {
  const text = DICT[currentLang][key] ?? DICT.ru[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

const priceFormat = new Intl.NumberFormat('ru-RU');
export const fmtNumber = (n) => priceFormat.format(n).replace(/ | /g, ' ');
export const fmtPrice = (uzs) => `${fmtNumber(uzs)} ${t('currency')}`;

export const categoryName = (cat) => (currentLang === 'uz' ? cat.name_uz : cat.name_ru);

const SKIP_SPECS = new Set(['score']);
const UNIT_BY_SUFFIX = { _ghz: 'unit.ghz', _w: 'unit.w', _mm: 'unit.mm', _mhz: 'unit.mhz', _mbs: 'unit.mbs' };

function formatGb(gb) {
  return gb >= 1000 ? `${gb / 1000} ${t('unit.tb')}` : `${gb} ${t('unit.gb')}`;
}

export function formatSpec(key, value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'number' ? `${v} ${t('unit.mm')}` : (DICT[currentLang][`val.${v}`] ?? v))).join(', ');
  }
  if (key === 'capacity_gb') return formatGb(value);
  if (key.endsWith('_gb')) return `${value} ${t('unit.gb')}`;
  for (const [suffix, unitKey] of Object.entries(UNIT_BY_SUFFIX)) {
    if (key.endsWith(suffix)) return `${value} ${t(unitKey)}`;
  }
  if (typeof value === 'string') return DICT[currentLang][`val.${value}`] ?? value;
  return String(value);
}

export function specRows(product) {
  return Object.entries(product.specs)
    .filter(([key]) => !SKIP_SPECS.has(key) && !(key === 'height_mm' && product.specs.height_mm === null) && !(key === 'radiator_mm' && product.specs.radiator_mm === null))
    .map(([key, value]) => ({ label: t(`spec.${key}`), value: formatSpec(key, value) }));
}

/** Короткие характеристики для карточек и списков. */
export function keySpecs(product) {
  const s = product.specs;
  switch (product.category) {
    case 'cpu': return [s.socket, `${s.cores} ${t('unit.cores')} / ${s.threads} ${t('unit.threads')}`, `${s.boost_ghz} ${t('unit.ghz')}`];
    case 'motherboard': return [s.socket, s.chipset, s.form_factor, s.ram_type];
    case 'ram': return [s.ram_type, formatGb(s.capacity_gb), `${s.speed_mhz} ${t('unit.mhz')}`];
    case 'gpu': return [`${s.vram_gb} ${t('unit.gb')}`, `${s.length_mm} ${t('unit.mm')}`, `${s.power_w} ${t('unit.w')}`];
    case 'storage': return [s.storage_type, formatGb(s.capacity_gb), s.interface];
    case 'psu': return [`${s.wattage_w} ${t('unit.w')}`, s.efficiency, s.form_factor];
    case 'case': return [s.form_factors.join('/'), `GPU ≤ ${s.max_gpu_mm} ${t('unit.mm')}`, formatSpec('color', s.color)];
    case 'cooler': return [formatSpec('cooler_type', s.cooler_type), s.radiator_mm ? `${s.radiator_mm} ${t('unit.mm')}` : `${s.height_mm} ${t('unit.mm')}`, `${s.tdp_w} ${t('unit.w')}`];
    default: return [];
  }
}

export function issueText(issue) {
  return t(`issue.${issue.code}`, issue.params);
}
