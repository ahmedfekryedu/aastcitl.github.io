/* Presentation-only toast; no notification reads or business requests. */
(function (root) {
  'use strict';
  if (root.CITLToast) return;
  const icons = {
    success: ['fa-check-circle', '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'],
    error: ['fa-times-circle', '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'],
    warning: ['fa-exclamation-triangle', '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.5"/>'],
    info: ['fa-info-circle', '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>']
  };
  let timer = null, previousFocus = null;
  function severity(type) {
    if (type === undefined) return 'success'; // Existing one-argument success calls.
    const key = String(type ?? '').trim().toLowerCase().replace(/^bg-/, '');
    if (key === 'warn') return 'warning';
    if (key === 'danger' || key === 'fail' || key === 'failure') return 'error';
    return Object.hasOwn(icons, key) ? key : 'info'; // Unknown types never imply success.
  }
  function hide() {
    clearTimeout(timer); timer = null;
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    if (toast.contains(document.activeElement) && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    toast.classList.remove('show');
    toast.setAttribute('aria-hidden', 'true');
    toast.inert = true;
  }
  function ensure() {
    let toast = document.getElementById('notification-toast');
    if (!toast) {
      toast = document.createElement('div'); toast.id = 'notification-toast';
      document.body.appendChild(toast);
    }
    if (!toast.querySelector('[data-citl-toast-close]')) {
      clearTimeout(toast._hideTimeout);
      toast.removeAttribute('role'); toast.removeAttribute('aria-live');
      toast.innerHTML = '<span class="citl-toast-symbol" aria-hidden="true"></span><span id="notification-message" class="notification-text" role="status" aria-live="polite" aria-atomic="true"></span><button type="button" class="citl-toast-close" data-citl-toast-close aria-label="إغلاق التنبيه">×</button>';
      toast.querySelector('[data-citl-toast-close]').addEventListener('click', hide);
    }
    return toast;
  }
  function show(message, type) {
    const toast = ensure(), state = severity(type), visible = toast.classList.contains('show');
    clearTimeout(timer); clearTimeout(toast._hideTimeout);
    if (!toast.contains(document.activeElement)) previousFocus = document.activeElement;
    toast.className = 'notification-toast bg-' + state + (visible ? ' show' : '');
    toast.dataset.severity = state;
    const icon = icons[state];
    // Local vectors keep state symbols visible without a CDN/font dependency.
    toast.querySelector('.citl-toast-symbol').innerHTML = '<svg class="'+icon[0]+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+icon[1]+'</svg>';
    const text = toast.querySelector('#notification-message');
    text.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
    // Plain text only; legacy breaks and decorative symbols do not select severity.
    text.textContent = String(message ?? '').replace(/<br\s*\/?>/gi, '\n')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}\uFE0F]/gu, '').trim();
    toast.inert = false; toast.setAttribute('aria-hidden', 'false');
    if (!visible) { void toast.offsetWidth; toast.classList.add('show'); }
    timer = setTimeout(hide, 3000);
  }
  root.CITLToast = Object.freeze({show, hide});
})(window);
