(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  let checking = false;
  let lastAttempt = -Infinity;

  // Refresh the worker without reloading a page or touching account/QR storage.
  // Updated HTML and versioned assets are used on the next ordinary navigation.
  async function checkUpdates() {
    if (checking || document.hidden || navigator.onLine === false || Date.now() - lastAttempt < 60000) return;
    checking = true;
    lastAttempt = Date.now();
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) await registration.update();
      else await navigator.serviceWorker.register('/sw.js', {updateViaCache: 'none'});
    } catch (_) {
      // A temporary outage must not interrupt forms or the TV rotation.
    } finally {
      checking = false;
    }
  }

  function start() {
    setTimeout(checkUpdates, 10000);
    setInterval(checkUpdates, 300000);
  }
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, {once: true});
  addEventListener('online', checkUpdates);
  addEventListener('focus', checkUpdates);
  document.addEventListener('visibilitychange', checkUpdates);
})();
