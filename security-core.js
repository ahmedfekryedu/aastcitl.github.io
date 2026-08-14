(function () {
  'use strict';

  const htmlEscape = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  async function session() {
    if (!window.sb?.auth) throw new Error('عميل تسجيل الدخول غير جاهز');
    const { data, error } = await window.sb.auth.getSession();
    if (error || !data.session) throw new Error('يلزم تسجيل الدخول');
    return data.session;
  }

  async function invoke(action, payload = {}) {
    await session();
    const request = window.sb.rpc('citl_secure_api', { p_action: action, p_payload: payload });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة الاتصال؛ حاول مرة أخرى')), 15000));
    const { data, error } = await Promise.race([request, timeout]);
    if (error) throw new Error(error.message || 'تعذر إتمام العملية');
    if (!data || data.ok === false) throw new Error(data?.error || 'تعذر إتمام العملية');
    return data;
  }

  async function validateProtectedPage() {
    if (!['/dashboard/', '/smrm/', '/schedules/', '/management/'].some((p) => location.pathname.startsWith(p))) return;
    try {
      const current = await session();
      const { data: profile, error } = await window.sb.from('profiles').select('*').eq('id', current.user.id).single();
      if (error || !profile) throw new Error('profile');
      const safeUser = { ...profile, id: current.user.id, email: current.user.email };
      localStorage.setItem('currentUser', JSON.stringify(safeUser));
      localStorage.removeItem('sessionToken');
      window.currentUser = safeUser;
      document.querySelectorAll('[data-manager-only]').forEach((el) => el.classList.toggle('hidden', safeUser.role !== 'manager'));
    } catch {
      localStorage.removeItem('currentUser'); localStorage.removeItem('sessionToken');
      location.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    }
  }

  function setBadge(count) {
    for (const id of ['notif-badge', 'notif-badge-mob']) {
      const el = document.getElementById(id); if (!el) continue;
      el.textContent = String(Math.min(count, 99)); el.classList.toggle('hidden', count === 0);
    }
  }

  function renderNotifications(items) {
    const list = document.getElementById('notif-list'); if (!list) return;
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'p-8 text-center text-sm text-gray-500 font-bold';
      empty.textContent = 'لا توجد تنبيهات'; list.appendChild(empty); return;
    }
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `w-full text-right p-3 mb-2 rounded-xl border transition ${item.read_at ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-200'}`;
      const title = document.createElement('div'); title.className = 'text-sm font-black text-[#2A3475]'; title.textContent = item.title;
      const body = document.createElement('div'); body.className = 'text-xs text-gray-600 mt-1 leading-5'; body.textContent = item.body || '';
      const date = document.createElement('div'); date.className = 'text-[10px] text-gray-400 mt-2'; date.textContent = new Date(item.created_at).toLocaleString('ar-EG');
      button.append(title, body, date);
      button.addEventListener('click', async () => {
        try { if (!item.read_at) await invoke('notifications.read', { ids: [item.id] }); } catch (error) { console.error(error); }
        if (item.route && /^\/[a-z0-9_/?=&.-]*$/i.test(item.route)) location.href = item.route;
        else await checkUserNotifications();
      });
      list.appendChild(button);
    }
  }

  async function checkUserNotifications() {
    try {
      const result = await invoke('notifications.list'); const items = result.notifications || [];
      window.__citlNotifications = items; renderNotifications(items); setBadge(items.filter((x) => !x.read_at).length);
    } catch (error) { console.error('notifications:', error); }
  }

  async function markAllNotificationsRead() {
    try { await invoke('notifications.read'); await checkUserNotifications(); }
    catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  async function toggleNotifications() {
    const menu = document.getElementById('notif-menu'); if (!menu) return;
    const opening = menu.classList.contains('hidden'); menu.classList.toggle('hidden');
    if (opening) {
      const anchor = document.getElementById(innerWidth < 1024 ? 'notif-btn-wrapper' : 'notif-btn-wrapper-pc');
      const rect = anchor?.getBoundingClientRect();
      menu.style.top = `${Math.min((rect?.bottom || 70) + 8, innerHeight - 420)}px`;
      menu.style[document.dir === 'rtl' ? 'right' : 'left'] = `${Math.max(10, innerWidth - (rect?.right || innerWidth - 10))}px`;
      await checkUserNotifications();
      const unread = (window.__citlNotifications || []).filter((x) => !x.read_at).map((x) => x.id);
      if (unread.length) { await invoke('notifications.read', { ids: unread }); await checkUserNotifications(); }
    }
  }

  async function secureLogout() {
    try { await window.presenceTracker?.logout?.(); } catch {}
    try { await window.sb?.auth?.signOut(); } catch {}
    localStorage.removeItem('currentUser'); localStorage.removeItem('sessionToken'); localStorage.removeItem('seen_notifications');
    sessionStorage.clear(); location.replace('/');
  }

  async function secureScheduleAction() {
    const scheduleId = document.getElementById('sa-schedule-id')?.value;
    const actionDate = document.getElementById('sa-action-date')?.value; const type = document.getElementById('sa-type')?.value;
    const reason = document.getElementById('sa-reason')?.value.trim() || '';
    const replacementInstructor = document.getElementById('sa-replacement-instructor')?.value.trim() || '';
    const replacementRoom = document.getElementById('sa-replacement-room')?.value.trim() || '';
    if (!scheduleId || !actionDate || !type || !reason) return window.showNotification?.('بيانات الإجراء والسبب مطلوبة', 'error');
    if (['replace', 'replace_and_move'].includes(type) && !replacementInstructor) return window.showNotification?.('اختر المحاضر البديل', 'error');
    if (['move_room', 'replace_and_move'].includes(type) && !replacementRoom) return window.showNotification?.('اختر القاعة البديلة', 'error');
    try {
      const current = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const result = await invoke('schedule_action.save', { data: { schedule_id: scheduleId, action_date: actionDate,
        action_type: type, reason, replacement_instructor: replacementInstructor || null, replacement_room: replacementRoom || null,
        department_key: current.department || null } });
      window.closeScheduleActionModal?.(); window.showNotification?.(`تم حفظ الإجراء وإرسال ${result.notified || 0} تنبيه ✅`, 'success');
      if (current.linked_instructors) await window.showMyScheduleView?.(current.linked_instructors);
      if (document.getElementById('schedule-reports-modal')?.classList.contains('flex')) await window.loadScheduleReports?.();
    } catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  async function secureDeleteUser(userId, userName) {
    const confirmFn = window.showConfirmDialog || (async (message) => confirm(message));
    if (!await confirmFn(`هل أنت متأكد من حذف العضو «${userName || 'المستخدم'}»؟\nسيُحذف حسابه نهائياً.`)) return;
    try { await invoke('user.delete', { id: userId }); window.showNotification?.('تم حذف المستخدم بنجاح', 'success'); await window.updateAdminUsersList?.(); }
    catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  async function secureAddUser(event) {
    event?.preventDefault?.(); event?.stopImmediatePropagation?.(); const form = event?.target; const button = form?.querySelector('button[type="submit"]');
    const original = button?.innerHTML; if (button) { button.disabled = true; button.innerHTML = 'جاري الإنشاء…'; }
    try {
      const data = { email: document.getElementById('new-user-email')?.value, password: document.getElementById('new-user-password')?.value,
        full_name: document.getElementById('new-user-name')?.value, department: document.getElementById('new-user-dept')?.value,
        permissions: { can_approve: !!document.getElementById('new-perm-approve')?.checked,
          can_manage_users: !!document.getElementById('new-perm-users')?.checked, can_delete: !!document.getElementById('new-perm-delete')?.checked } };
      const prepared = await invoke('registration.manager_ticket', { data: { ...data, password: undefined } });
      const response = await fetch(`${window.PRESENCE_SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: window.PRESENCE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: data.email, password: data.password, data: { registration_ticket: prepared.ticket } })
      });
      const created = await response.json().catch(() => ({}));
      if (!response.ok || created.error || !created.user || created.user.identities?.length === 0) {
        throw new Error(created.msg || created.message || created.error_description || 'البريد مستخدم بالفعل أو تعذر إنشاء المستخدم');
      }
      window.showNotification?.('تم إنشاء المستخدم بنجاح', 'success');
      window.closeModal?.('add-user-modal'); form?.reset(); await window.updateAdminUsersList?.();
    } catch (error) { window.showNotification?.(error.message, 'error'); }
    finally { if (button) { button.disabled = false; button.innerHTML = original || 'إضافة'; } }
  }

  async function secureDeleteLecture(id) {
    const confirmFn = window.showCustomConfirm || (async (message) => confirm(message));
    if (!await confirmFn('هل أنت متأكد من حذف هذه المحاضرة نهائياً؟')) return;
    try { await invoke('schedule.delete', { id }); try { await invoke('sessions.sync'); } catch {}
      window.showNotification?.('تم حذف المحاضرة بنجاح', 'success');
      window.closeAdminEditModal?.(); await window.refreshCache?.(); window.applyFilters?.(); }
    catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  async function secureDeleteScheduleAction(id) {
    const confirmFn = window.showCustomConfirm || (async (message) => confirm(message));
    if (!await confirmFn('هل أنت متأكد من حذف هذا الإجراء من التقرير؟')) return;
    try { await invoke('schedule_action.delete', { id }); window.showNotification?.('تم حذف الإجراء بنجاح', 'success');
      await window.loadScheduleReports?.(); const current = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (current.linked_instructors) await window.showMyScheduleView?.(current.linked_instructors); }
    catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  window.CITLSecure = { invoke, session, htmlEscape, validateProtectedPage };
  window.checkUserNotifications = checkUserNotifications;
  window.markAllNotificationsRead = markAllNotificationsRead;
  window.toggleNotifications = toggleNotifications;
  window.submitScheduleAction = secureScheduleAction;
  window.deleteUser = secureDeleteUser;
  window.handleAddUser = secureAddUser;
  window.deleteLecture = secureDeleteLecture;
  window.deleteScheduleReportAction = secureDeleteScheduleAction;
  window.openSchedulePresenceModal = function () { location.href = '/management/#reports'; };
  const legacySaveAdminChanges = window.saveAdminChanges;
  if (typeof legacySaveAdminChanges === 'function') window.saveAdminChanges = async function (...args) {
    const result = await legacySaveAdminChanges.apply(this, args);
    try { await invoke('sessions.sync'); } catch (error) { console.info('schedule sync:', error.message); }
    return result;
  };
  window.logout = secureLogout;

  validateProtectedPage();
  addEventListener('load', async () => {
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm && !addUserForm.dataset.secureBound) {
      addUserForm.dataset.secureBound = 'true'; addUserForm.addEventListener('submit', secureAddUser, true);
    }
    if (!document.getElementById('notif-list')) return;
    await checkUserNotifications();
    try {
      const current = await session();
      window.sb.channel(`notifications:${current.user.id}`).on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${current.user.id}`
      }, checkUserNotifications).subscribe();
    } catch (error) { console.error('notification realtime:', error); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('notif-list')) checkUserNotifications(); });
})();
