// Делегирование событий и навигация по hash-маршрутам.
// Элементы с data-action / data-input / data-change вызывают обработчики из реестра `actions`.

export const actions = {};

export function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}

export const go = (path) => {
  if (location.hash.slice(1) === path) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = path;
};

export const replaceQuery = (path, params) => {
  const s = params.toString();
  history.replaceState(null, '', `#${path}${s ? `?${s}` : ''}`);
};

function dispatch(eventName, dataAttr) {
  document.addEventListener(eventName, (event) => {
    const el = event.target.closest(`[${dataAttr}]`);
    if (!el) return;
    const handler = actions[el.getAttribute(dataAttr)];
    if (handler) handler(el, event);
  });
}
dispatch('click', 'data-action');
dispatch('input', 'data-input');
dispatch('change', 'data-change');
