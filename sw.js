const APP_VERSION = '1.0.0';
const CACHE = 'docman-v93';
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
// The app registers a unique URL: /path/__pdf__/<token>/<filename.pdf>
// The SW intercepts it, fetches the blob from the page via MessageChannel,
// and responds with a proper HTTP PDF response.
// Using same-tab navigation (no _blank) forces Android default browser to show
// the "Open with..." chooser rather than its download interceptor.

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.pathname.includes('/__pdf__/')) {
    e.respondWith(handlePdfServe(e.request, url));
    return;
  }

  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

async function handlePdfServe(request, url) {
  const parts = url.pathname.split('/__pdf__/')[1]?.split('/');
  const token = parts?.[0];
  const fileName = parts?.[1] ? decodeURIComponent(parts[1]) : 'document.pdf';

  if (!token) return new Response('Bad PDF URL', { status: 400 });

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (!clients.length) return new Response('No client', { status: 503 });

  try {
    const { buffer, type } = await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e) => {
        if (e.data?.buffer) resolve(e.data);
        else reject(new Error('No buffer'));
      };
      setTimeout(() => reject(new Error('Timeout')), 10000);
      clients[0].postMessage({ type: 'FETCH_PDF_BLOB', token }, [channel.port2]);
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': type || 'application/pdf',
        // inline = tell the OS to open it, not download it
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      }
    });
  } catch (err) {
    return new Response('PDF serve error: ' + err.message, { status: 500 });
  }
}
