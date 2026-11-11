// Простой ограничитель частоты запросов в памяти процесса (по IP, скользящее окно).

export function rateLimiter({ windowMs, max, onlyFailures = false }) {
  const hits = new Map(); // key -> [timestamps]

  const recent = (key, now) => {
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };

  const middleware = (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const list = recent(key, now);
    if (list.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - list[0])) / 1000)));
      return res.status(429).json({ success: false, error: 'too_many_requests' });
    }
    if (onlyFailures) {
      // считаем только неуспешные ответы (например, неверный пароль)
      res.on('finish', () => {
        if (res.statusCode >= 400) hits.set(key, [...recent(key, Date.now()), Date.now()]);
      });
    } else {
      hits.set(key, [...list, now]);
    }
    return next();
  };

  middleware.reset = () => hits.clear();
  return middleware;
}
