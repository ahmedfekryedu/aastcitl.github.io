const CACHE_NAME = 'citl-smart-v2'; // 1. قمنا بتغيير الإصدار لضمان تحديث الكاش عند المستخدمين

// 2. قائمة الملفات المحدثة بالمسارات الجديدة "النظيفة"
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/schedules/', // تم التغيير للمجلد الجديد
  '/smrm/',      // تم التغيير للمجلد الجديد
  '/manifest.json',
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
});

// 2. مرحلة التفعيل: مسح الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// 3. استراتيجية جلب البيانات: جلب من النت أولاً، ولو مفيش نت هات من الكاش
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});