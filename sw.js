const APP_VERSION = '1.0.7';
const CACHE = 'docman-v137';
// Small, critical-path files: install fails if any of these can't be cached
// (they're tiny, so a failure here means something is actually wrong).
const CORE_ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './Images/settings-tray.png', './Images/settings-neon.png', './vendor/jszip/jszip.min.js'];
// Larger/optional vendor files: cached best-effort. A single flaky download
// (pdfium.wasm is ~4.6MB) must never be allowed to sink the whole install,
// since caches.addAll() is atomic and one failed fetch used to abort
// skipWaiting() entirely, leaving the OLD service worker in control forever.
const VENDOR_ASSETS = ['./vendor/embedpdf/embedpdf.js', './vendor/embedpdf/embedpdf-7TNsu-EA.js', './vendor/embedpdf/browser-BKLM0ThC-CkSOgtCM.js', './vendor/embedpdf/direct-engine-BA2WfEti.js', './vendor/embedpdf/worker-engine-BkD2-rJn.js', './vendor/embedpdf/pdfium.wasm'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(CORE_ASSETS).then(() =>
        Promise.all(VENDOR_ASSETS.map(url => c.add(url).catch(err => {
          console.warn('[sw] optional asset failed to precache, will fetch at runtime:', url, err);
        })))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // blob: (and data:) URLs are only resolvable in the context that created
  // them. Re-fetching a blob: URL from inside the service worker's own
  // context always fails, which used to fall through to the catch() below
  // and silently serve back index.html in place of the actual PDF bytes —
  // causing the PDF viewer to hang forever on "Loading document...".
  // Let these pass straight through to the network/browser instead.
  if (e.request.url.startsWith('blob:') || e.request.url.startsWith('data:')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
