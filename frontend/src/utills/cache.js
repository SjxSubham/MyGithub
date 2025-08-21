const NS = 'ghdash';

const k = (x) => `${NS}:${x}`;

export function setCache(key, value, ttlMs) {
  const expires = Date.now() + ttlMs;
  localStorage.setItem(k(key), JSON.stringify({ value, expires }));
}

export function getCache(key) {
  const raw = localStorage.getItem(k(key));
  if (!raw) return null;
  try {
    const { value, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(k(key));
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(k(key));
    return null;
  }
}

export function setETag(key, etag) {
  if (etag) localStorage.setItem(k(`etag:${key}`), etag);
}

export function getETag(key) {
  return localStorage.getItem(k(`etag:${key}`));
}

export function clearUserCaches(username) {
  Object.keys(localStorage).forEach((keyName) => {
    if (keyName.startsWith(`${NS}:`) && keyName.includes(username)) {
      localStorage.removeItem(keyName);
    }
  });
}