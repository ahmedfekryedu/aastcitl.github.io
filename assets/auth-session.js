(function (root) {
  'use strict';
  let pending, recoveryTimer, recovering = false, verifiedOnce = false;
  let recoveryAttempts = 0;
  const fault = (message, code) => Object.assign(new Error(message), { code });
  async function session() {
    if (!root.sb?.auth) throw fault('عميل تسجيل الدخول غير جاهز', 'CLIENT_NOT_READY');
    const { data, error } = await root.sb.auth.getSession();
    if (error) throw error;
    if (!data.session) throw fault('يلزم تسجيل الدخول', 'AUTH_REQUIRED');
    return data.session;
  }
  function loadProfile() {
    if (pending) return pending;
    pending = (async () => {
      const current = await session();
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { result = await root.sb.from('profiles').select('*').eq('id', current.user.id).single(); }
        catch (error) { result = {error}; }
        if (!result.error || [400,401,403,404,406].includes(result.status) || attempt === 2 || navigator.onLine === false) break;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
      const { data, error } = result;
      if (error) throw error;
      if (!data) throw fault('تعذر العثور على الملف الشخصي؛ تواصل مع المسؤول', 'PROFILE_MISSING');
      const profile = { ...data, id: current.user.id, email: current.user.email };
      root.currentUser = profile;
      verifiedOnce = true;
      document.getElementById('citl-connection-recovery')?.remove();
      clearTimeout(recoveryTimer); recoveryAttempts = 0;
      // Storage is a convenience; a full/disabled browser store must not break login.
      try { localStorage.setItem('currentUser', JSON.stringify(profile)); localStorage.removeItem('sessionToken'); } catch (_) {}
      return profile;
    })().finally(() => { pending = null; });
    return pending;
  }
  function redirectIfSignedOut(error) {
    if (error?.code !== 'AUTH_REQUIRED') return false;
    try { localStorage.removeItem('currentUser'); localStorage.removeItem('sessionToken'); } catch (_) {}
    location.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    return true;
  }
  function showFailure(error) {
    if (redirectIfSignedOut(error)) return;
    let box = document.getElementById('citl-connection-recovery');
    if (!box) {
      box = document.createElement('div'); box.id = 'citl-connection-recovery'; box.setAttribute('role', 'alert');
      box.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:999999;background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-radius:12px;padding:14px;max-width:90vw;direction:rtl;font:14px sans-serif';
      const label = document.createElement('span'); label.textContent = 'تعذر الاتصال بخدمة الحساب مؤقتًا. سنعيد المحاولة تلقائيًا. ';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'إعادة المحاولة';
      button.style.cssText = 'padding:6px 12px;margin:4px;border:1px solid;border-radius:6px;cursor:pointer';
      button.addEventListener('click', () => { recoveryAttempts = 0; recover(); }); box.append(label, button); document.body.appendChild(box);
    }
    scheduleRecovery();
  }
  function scheduleRecovery() {
    clearTimeout(recoveryTimer);
    if (recoveryAttempts < 5 && navigator.onLine !== false && document.visibilityState !== 'hidden') recoveryTimer = setTimeout(recover, Math.min(60000, 5000 * (recoveryAttempts + 1)));
  }
  async function recover() {
    if (recovering || !document.getElementById('citl-connection-recovery')) return;
    recovering = true; recoveryAttempts++;
    const wasInitialized = verifiedOnce;
    try {
      const profile = await loadProfile();
      document.querySelectorAll('[data-manager-only]').forEach(el => el.classList.toggle('hidden', !root.CITLPermissions?.full(profile)));
      // Initial boot has no initialized controls. A verified recovery can safely restart it once.
      if (!wasInitialized) location.reload();
      else root.dispatchEvent(new CustomEvent('citl:auth-recovered'));
    } catch (error) { if (!redirectIfSignedOut(error)) scheduleRecovery(); }
    finally { recovering = false; }
  }
  root.addEventListener('online', () => { recoveryAttempts = 0; recover(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { recoveryAttempts = 0; recover(); } });
  root.CITLAuth = Object.freeze({ session, loadProfile, redirectIfSignedOut, showFailure });
})(window);
