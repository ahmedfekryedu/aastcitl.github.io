self.addEventListener('install', (e) => {
  console.log('Service Worker Registered');
});

self.addEventListener('fetch', (e) => {
  // هذا الكود يسمح للتطبيق بالعمل بسلاسة
  e.respondWith(fetch(e.request));
});