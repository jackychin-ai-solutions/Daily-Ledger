// Offline cache for the app shell.
// Requests are network-first and refresh the cache, so editing index.html does NOT need a VERSION bump.
// Bump VERSION only when the SHELL precache list changes or to force old caches to be cleared.
const VERSION = 'ledger-v10';
const SHELL = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Promise.race instead of AbortController: fetch(request, {signal}) throws for navigation requests.
function fetchWithTimeout(req){
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS); });
  return Promise.race([fetch(req), timeout]).finally(() => clearTimeout(timer));
}

// Network first (3 s timeout) for same-origin files so updates show up; cache, then index.html, as offline fallback.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetchWithTimeout(req)
      .then(res => {
        if (res.ok && res.status === 200){   // never cache 404s or partial (206) responses
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
