const CACHE_NAME = 'citl-smart-v3-secure-20260814';

// 2. قائمة الملفات المحدثة بالمسارات الجديدة "النظيفة"
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/security-core.js',
  '/registration-secure.js',
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
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. مرحلة التفعيل: مسح الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. استراتيجية جلب البيانات: جلب من النت أولاً، ولو مفيش نت هات من الكاش
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || ['/dashboard/','/schedules/','/smrm/','/management/','/attendance/'].some(p => url.pathname.startsWith(p))) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
