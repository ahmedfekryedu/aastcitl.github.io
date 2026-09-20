const RELEASE = '20260920-r4';
const CACHE_NAME = 'citl-smart-interface-' + RELEASE;

// 2. قائمة الملفات المحدثة بالمسارات الجديدة "النظيفة"
const ASSETS_TO_CACHE = [
  '/assets/site-updates.js',
  '/assets/news-ticker.js',
  '/assets/fonts.css',
  '/assets/fonts/cairo-arabic.woff2',
  '/assets/fonts/cairo-latin-ext.woff2',
  '/assets/fonts/cairo-latin.woff2',
  '/assets/fonts/roboto-latin-ext.woff2',
  '/assets/fonts/roboto-latin.woff2',

  '/assets/interface-controls.css',
  '/assets/control-panel.svg',
  '/assets/interface-controls.js',
  '/assets/loading-placeholders.js',
  '/',
  '/index.html',
  '/manifest.json',
  '/study/',
  '/study/study.css',
  '/study/study.js',
  '/tv_display/',
  '/assets/study-model.js',
  '/assets/tv-study.js',
  '/assets/tv-media-player.js',
  '/assets/tv-media-storage.js',
  '/assets/academic-booking.js',
  '/assets/tv-study.css',
  '/assets/study-settings.js',
  '/vendor/qrcode-1.5.4.min.js',
  '/security-core.js',
  '/assets/auth-session.js',
  '/assets/data-client.js',
  '/assets/permissions.js',
  '/assets/read-timeout.js',
  '/assets/admin-permissions-ui.js',
  '/registration-secure.js',
  '/assets/ui-fixes.css',
  '/vendor/supabase-js-2.45.4.min.js',
  '/CITL_Logo-32.png',
  '/CITL_Logo-192.png',
  '/CITL_Logo-512.png'
];

// 1. مرحلة التثبيت: تخزين الملفات الأساسية
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching essential assets...');
      return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(/\.(css|js)$/.test(url) ? url + '?v=' + RELEASE : url, {cache: 'reload'})));
    })
  );
  self.skipWaiting();
});

// 2. مرحلة التفعيل: مسح الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => /^(citl-smart-|citl-app-)/.test(key) && key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. استراتيجية جلب البيانات: جلب من النت أولاً، ولو مفيش نت هات من الكاش
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || ['/dashboard/','/schedules/','/smrm/','/management/','/attendance/'].some(p => url.pathname.startsWith(p))) {
    e.respondWith(fetch(e.request, url.origin === self.location.origin ? {cache: 'no-cache'} : undefined));
    return;
  }
  e.respondWith((async () => {
    // Versioned, same-origin fonts are reused immediately even on a slow connection.
    if(url.pathname.startsWith('/assets/fonts/') || url.pathname==='/assets/fonts.css'){const cachedFont=await caches.match(e.request);if(cachedFont)return cachedFont;}
    try {
      // Revalidate public HTML and scripts instead of accepting a stale HTTP cache entry.
      const response = await fetch(e.request, {cache: 'no-cache'});
      if (response.ok) {
        const cachedResponse = response.clone();
        try { await caches.open(CACHE_NAME).then(cache => cache.put(e.request, cachedResponse)); }
        catch (_) { /* A full cache must not hide a successful server response. */ }
      }
      return response;
    } catch (_) {
      const exact = await caches.match(e.request);
      if (exact) return exact;
      // Room/day/search parameters change filters, not the public study page shell.
      if (e.request.mode === 'navigate' && ['/study/', '/study/index.html'].includes(url.pathname)) {
        return (await caches.match('/study/')) || Response.error();
      }
      return Response.error();
    }
  })());
});
