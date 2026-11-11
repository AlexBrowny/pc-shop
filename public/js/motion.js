// Анимации интерфейса: появление при прокрутке, счётчики, наклон/подсветка под курсором, ripple, шапка.
// Всё отключается при prefers-reduced-motion.

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
export const prefersReducedMotion = () => reduced;

const STAGGER_MS = 55;
const STAGGER_CAP = 8;

let revealObserver = null;
let countObserver = null;

const easeOut = (t) => 1 - (1 - t) ** 3;

/** Плавно меняет число в элементе. format — функция форматирования. */
export function animateNumber(el, to, { from = 0, duration = 900, format = (v) => String(Math.round(v)) } = {}) {
  if (reduced || !Number.isFinite(to)) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(from + (to - from) * easeOut(t));
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = format(to);
  };
  requestAnimationFrame(frame);
}

function setupObservers() {
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

  countObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      countObserver.unobserve(el);
      const target = Number(el.dataset.count);
      animateNumber(el, target, { duration: 1300, format: (v) => `${Math.round(v)}${el.dataset.suffix ?? ''}` });
    }
  }, { threshold: 0.4 });
}

/** Подключает к наблюдению новые .reveal и [data-count] внутри root. */
export function scan(root = document) {
  if (!revealObserver) return;
  root.querySelectorAll('.reveal:not([data-seen])').forEach((el, i, all) => {
    el.dataset.seen = '1';
    if (reduced) {
      el.classList.add('in');
      return;
    }
    const siblings = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains('reveal')) : all;
    const index = Math.min(STAGGER_CAP, Math.max(0, siblings.indexOf(el)));
    el.style.setProperty('--rd', `${index * STAGGER_MS}ms`);
    revealObserver.observe(el);
  });
  root.querySelectorAll('[data-count]:not([data-seen])').forEach((el) => {
    el.dataset.seen = '1';
    if (reduced) el.textContent = `${el.dataset.count}${el.dataset.suffix ?? ''}`;
    else countObserver.observe(el);
  });
}

// ───────── Курсор: подсветка карточек и наклон ─────────
function onPointerMove(e) {
  const spot = e.target.closest?.('.spot');
  if (spot) {
    const r = spot.getBoundingClientRect();
    spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
    spot.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  if (reduced) return;
  const tilt = e.target.closest?.('[data-tilt]');
  if (tilt) {
    const r = tilt.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = Number(tilt.dataset.tilt) || 8;
    tilt.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    tilt.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
  }
}

function onPointerLeave(e) {
  const tilt = e.target.closest?.('[data-tilt]');
  if (tilt && !tilt.contains(e.relatedTarget)) {
    tilt.style.setProperty('--rx', '0deg');
    tilt.style.setProperty('--ry', '0deg');
  }
}

function onPointerDown(e) {
  const btn = e.target.closest?.('.btn');
  if (!btn || btn.disabled || reduced) return;
  const r = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(r.width, r.height) * 1.6;
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
}

export function initMotion() {
  setupObservers();
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerout', onPointerLeave, { passive: true });
  document.addEventListener('pointerdown', onPointerDown, { passive: true });

  const header = document.getElementById('header');
  const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Новые элементы (после рендера страниц и подгрузки каталога) подключаются автоматически
  const app = document.getElementById('app');
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(app); });
  }).observe(app, { childList: true, subtree: true });
  scan(app);
}

/** Перезапускает CSS-анимацию появления страницы. */
export function pageEnter(el) {
  if (reduced) return;
  el.classList.remove('page-in');
  void el.offsetWidth; // перезапуск анимации
  el.classList.add('page-in');
}

/** Короткая «пружинка» на элементе (бейдж корзины и т.п.). */
export function bump(el) {
  if (!el || reduced) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/** Плавная смена темы: на время перехода включаем transition на всех цветах. */
export function themeTransition() {
  if (reduced) return;
  const root = document.documentElement;
  root.classList.add('theme-fade');
  setTimeout(() => root.classList.remove('theme-fade'), 450);
}
