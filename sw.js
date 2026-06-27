const APP_VERSION = '1.0.0';
const CACHE = 'docman-v92'; // bumped for PDF serve support
const ASSETS = ['./', './index.html', './app.js', './style.css', './manifest.json', './Images/settings-tray.png', './Images/settings-neon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// ── PDF blob serving ──────────────────────────────────────────────────────────
// When the app wants to open a PDF in an external viewer on Android, it creates
// a unique URL like:  /path/to/__pdf__/<token>/<filename.pdf>
// The SW intercepts that fetch, asks the page for the blob via MessageChannel,
// then responds with a real HTTP response the OS can hand to a PDF viewer.

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Intercept __pdf__ requests
  if (url.pathname.includes('/__pdf__/')) {
    e.respondWith(handlePdfServe(e.request, url));
    return;
  }

  // Normal cache-first strategy for everything else
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

async function handlePdfServe(request, url) {
  // Extract token from URL:  /__pdf__/<token>/<filename>
  const parts = url.pathname.split('/__pdf__/')[1]?.split('/');
  const token = parts?.[0];
  const fileName = parts?.[1] ? decodeURIComponent(parts[1]) : 'document.pdf';

  if (!token) {
    return new Response('Bad PDF URL', { status: 400 });
  }

  // Ask the controlling page client for the blob
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!clients.length) {
    return new Response('No client available', { status: 503 });
  }

  try {
    const { buffer, type } = await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        if (e.data?.buffer) resolve(e.data);
        else reject(new Error('No buffer received'));
      };
      setTimeout(() => reject(new Error('Blob fetch timeout')), 10000);

      // Ask the first available window client
      clients[0].postMessage(
        { type: 'FETCH_PDF_BLOB', token },
        [channel.port2]
      );
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': type || 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': buffer.byteLength,
      }
    });
  } catch (err) {
    console.warn('[SW] PDF serve failed:', err);
    return new Response('PDF not available: ' + err.message, { status: 404 });
  }
}
