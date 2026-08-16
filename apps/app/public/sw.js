/*
 * Minimal service worker — its job is installability, not caching.
 *
 * Chrome only offers "Install app" when a service worker with a fetch
 * handler is registered, and that install is our store-free distribution
 * path: the app lands on the home screen with its own icon and no browser
 * chrome, no review queue, no developer account.
 *
 * It deliberately caches NOTHING. A verified-places map must never serve a
 * stale answer, and a stale JS bundle is the classic PWA failure. Every
 * request goes to the network; only a failed navigation gets a fallback,
 * so a dead connection shows our page instead of the browser's dinosaur.
 */
const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guaca</title>
<style>
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;background:#0D8B8B;color:#fff;font-family:system-ui,sans-serif;
    text-align:center;padding:32px}
  h1{font-size:44px;font-weight:900;letter-spacing:-2px;margin:0}
  p{margin:14px 0 0;font-weight:600;opacity:.85;line-height:1.5}
  button{margin-top:26px;padding:14px 28px;border:0;border-radius:14px;background:#fff;
    color:#0A1F24;font-weight:900;font-size:15px}
</style></head>
<body>
  <h1>Guaca</h1>
  <p>Sin conexión · Offline<br>El Caribe en tiempo real te espera.</p>
  <button onclick="location.reload()">Reintentar · Retry</button>
</body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    ),
  );
});
