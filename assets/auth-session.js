(function (root) {
  'use strict';
  let pending;
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
      const { data, error } = await root.sb.from('profiles').select('*').eq('id', current.user.id).single();
      if (error) throw error;
      if (!data) throw fault('تعذر العثور على الملف الشخصي؛ تواصل مع المسؤول', 'PROFILE_MISSING');
      const profile = { ...data, id: current.user.id, email: current.user.email };
      root.currentUser = profile;
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
      const label = document.createElement('span'); label.textContent = 'تعذر التحقق من الحساب الآن. اتصالك قد يكون متوقفًا؛ أعد المحاولة. ';
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'إعادة المحاولة';
      button.style.cssText = 'padding:6px 12px;margin:4px;border:1px solid;border-radius:6px;cursor:pointer';
      button.addEventListener('click', () => location.reload()); box.append(label, button); document.body.appendChild(box);
    }
  }
  root.CITLAuth = Object.freeze({ session, loadProfile, redirectIfSignedOut, showFailure });
})(window);
