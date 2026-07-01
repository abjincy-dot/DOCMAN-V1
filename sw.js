const APP_VERSION = '1.0.3';
const CACHE = 'docman-v122';
// The PDF engine (EmbedPDF) is vendored locally in vendor/embedpdf/ instead
// of loaded from jsdelivr at runtime, so it's precached like every other
// app asset below and never depends on the network or a CDN being up.
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './Images/settings-tray.png', './Images/settings-neon.png', './vendor/jszip/jszip.min.js', './vendor/embedpdf/embedpdf.js', './vendor/embedpdf/pdfium.wasm'];

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

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
