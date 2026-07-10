const APP_VERSION = '1.0.8';
const CACHE = 'docman-v146';
// Small, critical-path files: install fails if any of these can't be cached
// (they're tiny, so a failure here means something is actually wrong).
const CORE_ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './Images/settings-tray.png', './Images/settings-neon.png', './vendor/jszip/jszip.min.js'];

// PDF engine assets (self-hosted EmbedPDF + pdfium.wasm, ~6.6 MB total).
// Cached best-effort during install so the first PDF open is already local;
// install still succeeds even if one of these fails (they'll be cached on
// first use by the fetch handler instead).
const PDF_ENGINE_ASSETS = [
  './vendor/embedpdf/embedpdf.js',
  './vendor/embedpdf/embedpdf-7TNsu-EA.js',
  './vendor/embedpdf/worker-engine-BkD2-rJn.js',
  './vendor/embedpdf/direct-engine-BA2WfEti.js',
  './vendor/embedpdf/browser-BKLM0ThC-CkSOgtCM.js',
  './vendor/embedpdf/pdfium.wasm'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(CORE_ASSETS)
        .then(() => Promise.allSettled(PDF_ENGINE_ASSETS.map(a => c.add(a))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Immutable static assets: serve from cache instantly, fetch only on a miss.
// Vendored libraries never change without a cache-version bump, so hitting
// the network first for them (the old behaviour) just added latency —
// including re-downloading the 4.6 MB pdfium.wasm on every PDF open.
function isCacheFirst(url) {
  return url.pathname.includes('/vendor/') ||
         url.pathname.includes('/Images/') ||
         url.pathname.includes('/icons/');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // blob: (and data:) URLs are only resolvable in the context that created
  // them. Re-fetching a blob: URL from inside the service worker's own
  // context always fails, which used to fall through to the catch() below
  // and silently serve back index.html in place of the actual PDF bytes —
  // causing the PDF viewer to hang forever on "Loading document...".
  // Let these pass straight through to the network/browser instead.
  if (e.request.url.startsWith('blob:') || e.request.url.startsWith('data:')) return;

  const url = new URL(e.request.url);

  if (url.origin === self.location.origin && isCacheFirst(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
        return res;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => {
      if (r) return r;
      // Only page navigations should fall back to the app shell. Serving
      // index.html for a failed script/wasm request makes the browser try
      // to parse HTML as JS — "Importing a module script failed".
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
