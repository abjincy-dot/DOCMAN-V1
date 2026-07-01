const APP_VERSION = '1.0.2';
const CACHE = 'docman-v119';
// The PDF engine (EmbedPDF) is loaded from jsdelivr at runtime instead of
// being vendored locally. It's not in the precache list below, but the
// cache-first branch in the fetch handler caches it (and its wasm asset)
// the first time it's fetched, and serves it from cache on every load after
// that — so it only ever needs the network once, not on every PDF open.
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './Images/settings-tray.png', './Images/settings-neon.png', './vendor/jszip/jszip.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Cache-first for the PDF engine CDN: once successfully fetched one time,
  // never depend on the network (or jsdelivr's uptime) again.
  if (e.request.url.indexOf('cdn.jsdelivr.net') !== -1) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
