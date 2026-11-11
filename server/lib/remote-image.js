// Безопасная загрузка картинки по ссылке (для админки): только https, запрет внутренних адресов (SSRF),
// ограничение размера и времени. Адрес проверяется в момент соединения, поэтому подмена DNS (rebinding) не проходит.
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

/** Адреса, куда сервер ходить не должен: локальные, частные, link-local, мультикаст, зарезервированные. */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7)); // IPv4-mapped
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
  }
  return true;
}

class RemoteImageError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function safeLookup(allowPrivate) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIPv6(addresses) ? 6 : 4 }];
      if (!allowPrivate && list.some((a) => isPrivateAddress(a.address))) return callback(new RemoteImageError('blocked_host'));
      return options?.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
    });
  };
}

function requestOnce(url, { maxBytes, allowPrivate }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url, {
      method: 'GET',
      headers: { 'User-Agent': 'PCMarketImageImport/1.0', Accept: 'image/*' },
      lookup: safeLookup(allowPrivate),
      timeout: TIMEOUT_MS,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve({ redirect: new URL(res.headers.location, url) });
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new RemoteImageError('fetch_failed'));
        return;
      }
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.resume();
        reject(new RemoteImageError('too_large'));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          req.destroy(new RemoteImageError('too_large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new RemoteImageError('fetch_timeout')));
    req.on('error', (err) => reject(err instanceof RemoteImageError ? err : new RemoteImageError(err.code === 'ENOTFOUND' ? 'fetch_failed' : (err.message === 'blocked_host' ? 'blocked_host' : 'fetch_failed'))));
    req.end();
  });
}

/**
 * Скачивает файл по ссылке и возвращает Buffer. Тип проверяется отдельно по «магическим байтам» (detectMime).
 * allowPrivate — только для тестов с локальным сервером.
 */
export async function fetchRemoteImage(rawUrl, { maxBytes, allowPrivate = false } = {}) {
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    throw new RemoteImageError('invalid_url');
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const secure = url.protocol === 'https:' || (allowPrivate && url.protocol === 'http:');
    if (!secure || url.username || url.password) throw new RemoteImageError('invalid_url');
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !allowPrivate && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) throw new RemoteImageError('blocked_host');
    // eslint-disable-next-line no-await-in-loop
    const result = await requestOnce(url, { maxBytes, allowPrivate });
    if (result.buffer) return result.buffer;
    url = result.redirect;
  }
  throw new RemoteImageError('too_many_redirects');
}
