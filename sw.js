const CACHE_NAME = 'citl-app-repair-20260908-1';
const ASSETS_TO_CACHE = ['/', '/index.html', '/tv_display/', '/manifest.json', '/citl-runtime.js', '/security-core.js', '/registration-secure.js', '/assets/ui-fixes.css', '/vendor/supabase-js-2.45.4.min.js', '/CITL_Logo-32.png', '/CITL_Logo-192.png', '/CITL_Logo-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => /^(citl-app-|citl-smart-)/.test(key) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only public application files: never cache authenticated pages or API responses.
  const allowed = ASSETS_TO_CACHE.includes(url.pathname) || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/vendor/');
  if (!allowed) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        try { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); } catch (_) { /* Storage limits must not discard a successful response. */ }
      }
      return response;
    } catch (_) { return (await caches.match(request)) || Response.error(); }
  })());
});
