(function (root) {
  'use strict';
  let pending, recoveryTimer, recovering = false, verifiedOnce = false;
  let recoveryAttempts = 0;
  let monitoring = false, checkingAccount = false, leaving = false;
  let refreshing=null;
  const fault = (message, code) => Object.assign(new Error(message), { code });
  const facultyPending = profile => ['pending','rejected'].includes(profile?.faculty_verification_status) || (['faculty','visiting_lecturer'].includes(profile?.account_type) && profile.faculty_verification_status !== 'approved');
  const protectedPage = /^\/(dashboard|smrm|schedules|management|attendance|courses)(\/|$)/.test(location.pathname);
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
        try { result = await root.sb.from('profiles').select('*').eq('id', current.user.id).maybeSingle(); }
        catch (error) { result = {error}; }
        if (!result.error || [400,401,403,404,406].includes(result.status) || attempt === 2 || navigator.onLine === false) break;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
      const { data, error } = result;
      if (error && result.status === 401) {
        await verifyAuthUser();
        const retried=await root.sb.from('profiles').select('*').eq('id',current.user.id).maybeSingle();
        if(!retried.error&&retried.data){result=retried;}else throw retried.error||fault('الحساب لم يعد متاحًا','PROFILE_MISSING');
      }
      if (result.error) throw result.error;
      if (!result.data) throw fault('تعذر العثور على الملف الشخصي؛ تواصل مع المسؤول', 'PROFILE_MISSING');
      const profile = { ...result.data, id: current.user.id, email: result.data.email||current.user.email };
      if (protectedPage && facultyPending(profile)) {
        try { localStorage.removeItem('currentUser'); } catch (_) {}
        location.replace('/account/');
        throw fault('حسابك بانتظار اعتماد الإدارة', 'FACULTY_PENDING');
      }
      if(root.CITLServices && !await root.CITLServices.checkPage())throw fault('الخدمة قيد التحديث','SERVICE_MAINTENANCE');
      document.documentElement.classList.remove('citl-auth-checking');
      root.currentUser = profile;
      verifiedOnce = true;
      startAccountMonitor();
      document.getElementById('citl-connection-recovery')?.remove();
      clearTimeout(recoveryTimer); recoveryAttempts = 0;
      // Storage is a convenience; a full/disabled browser store must not break login.
      try { localStorage.setItem('currentUser', JSON.stringify(profile)); localStorage.removeItem('sessionToken'); } catch (_) {}
      root.dispatchEvent(new CustomEvent('citl-profile-loaded',{detail:profile}));
      return profile;
    })().finally(() => { pending = null; });
    return pending;
  }
  function redirectIfSignedOut(error) {
    const missing=error?.name==='AuthSessionMissingError'||error?.code==='refresh_token_already_used'||error?.code==='bad_jwt';
    if (!missing&&!['AUTH_REQUIRED','PROFILE_MISSING','user_not_found','session_not_found','refresh_token_not_found'].includes(error?.code)) return false;
    if (leaving) return true;
    leaving = true;
    clearTimeout(recoveryTimer);
    // Local credentials must be cleared even when a deleted account cannot call logout.
    try { for (const key of ['currentUser','sessionToken','sb-main-auth','sb-main-auth-code-verifier','seen_notifications']) localStorage.removeItem(key); } catch (_) {}
    root.currentUser = null;
    location.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    return true;
  }
  async function verifyAuthUser() {
    let result = await root.sb.auth.getUser();
    if(result.error&&[401,403].includes(result.error.status)&&!['user_not_found','user_banned'].includes(result.error.code)){
      refreshing ||= root.sb.auth.refreshSession().finally(()=>{refreshing=null;});
      const renewed=await refreshing;
      if(renewed.error){if(renewed.error.status>=500||renewed.error.name==='AuthRetryableFetchError')throw renewed.error;throw fault('يلزم تسجيل الدخول مجددًا','AUTH_REQUIRED');}
      if(!renewed.data?.session)throw fault('يلزم تسجيل الدخول مجددًا','AUTH_REQUIRED');
      result=await root.sb.auth.getUser();
    }
    if (result.error) {
      if ([401,403].includes(result.error.status) || result.error.name==='AuthSessionMissingError' || ['bad_jwt','user_not_found','session_not_found'].includes(result.error.code)) throw fault('يلزم تسجيل الدخول مجددًا', 'AUTH_REQUIRED');
      throw result.error;
    }
    if (!result.data?.user) throw fault('الحساب لم يعد متاحًا', 'AUTH_REQUIRED');
  }
  async function checkAccount() {
    if (leaving || checkingAccount || !verifiedOnce || navigator.onLine === false || document.hidden) return;
    checkingAccount = true;
    try {
      const current = await session();
      const result = await root.sb.from('profiles').select('id,account_type,faculty_verification_status,linked_instructors,department,position,role,permissions').eq('id',current.user.id).maybeSingle();
      if (result.error) {
        if (result.status === 401) await verifyAuthUser();
        throw result.error;
      }
      if (!result.data) throw fault('الحساب لم يعد متاحًا', 'PROFILE_MISSING');
      if (protectedPage && facultyPending(result.data)) location.replace('/account/');
      const previous = root.currentUser;
      if (previous && (['role','permissions','account_type','faculty_verification_status','linked_instructors','department','position'].some(key => JSON.stringify(previous[key]) !== JSON.stringify(result.data[key])))) {
        await loadProfile();
        root.applyUserPermissions?.();
        root.dispatchEvent(new CustomEvent('citl-permissions-changed'));
      }
    } catch (error) { redirectIfSignedOut(error); /* Transport errors do not mean account deletion. */ }
    finally { checkingAccount = false; }
  }
  function startAccountMonitor() {
    if (monitoring) return;
    monitoring = true;
    // Realtime DELETE delivery is not guaranteed under RLS; verify against the server.
    setInterval(checkAccount, 15000);
    root.addEventListener('focus', checkAccount);
    root.addEventListener('online', checkAccount);
    document.addEventListener('visibilitychange', checkAccount);
  }
  function showFailure(error) {
    if (['FACULTY_PENDING','SERVICE_MAINTENANCE'].includes(error?.code)) return;
    if (redirectIfSignedOut(error)) return;
    root.CITLPageBoot?.failure();
    let box = document.getElementById('citl-connection-recovery');
    if (!box) {
      box = document.createElement('div'); box.id = 'citl-connection-recovery'; box.setAttribute('role', 'alert');
      box.style.cssText = 'position:fixed;top:16px;inset-inline:16px;margin:auto;z-index:999999;background:#fff;color:#2a3475;border:1px solid #e2e8f0;border-top:3px solid #f3a628;border-radius:14px;padding:16px;width:calc(100% - 32px);max-width:420px;box-sizing:border-box;box-shadow:0 8px 30px #17255422;direction:rtl;font:13px Cairo,sans-serif';
      const label = document.createElement('span'); label.textContent = navigator.onLine===false?'الاتصال بالإنترنت غير متاح. سنحاول عند عودته.':'لم يكتمل الاتصال بالحساب. بياناتك محفوظة، ونعيد المحاولة تلقائيًا.';label.style.cssText='display:block;line-height:1.9';
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
    const button=document.querySelector('#citl-connection-recovery button');if(button){button.disabled=true;button.textContent='جاري الاتصال…';}
    const wasInitialized = verifiedOnce;
    try {
      const profile = await loadProfile();
      document.querySelectorAll('[data-manager-only]').forEach(el => el.classList.toggle('hidden', !root.CITLPermissions?.full(profile)));
      // Initial boot has no initialized controls. A verified recovery can safely restart it once.
      if (!wasInitialized) location.reload();
      else root.dispatchEvent(new CustomEvent('citl:auth-recovered'));
    } catch (error) { if (!redirectIfSignedOut(error)) scheduleRecovery(); }
    finally { recovering = false; if(button){button.disabled=false;button.textContent='إعادة المحاولة';}if(recoveryAttempts>=5){const label=document.querySelector('#citl-connection-recovery span');if(label)label.textContent='لم نتمكن من الاتصال. تحقق من الإنترنت ثم اضغط إعادة المحاولة.';} }
  }
  root.addEventListener('online', () => { recoveryAttempts = 0; recover(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if(recoveryAttempts<5)recover(); } });
  root.CITLAuth = Object.freeze({ session, loadProfile, redirectIfSignedOut, showFailure, facultyPending });
})(window);
