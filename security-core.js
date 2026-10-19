(function () {
  'use strict';

  const htmlEscape = (value) => String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  const session = () => window.CITLAuth.session();

  async function invoke(action, payload = {}) {
    await session();
    return window.CITLRequests.rpc(window.sb, 'citl_secure_api', { p_action: action, p_payload: payload });
  }

  async function validateProtectedPage() {
    if (!['/dashboard/', '/smrm/', '/schedules/', '/management/', '/courses/'].some((p) => location.pathname.startsWith(p))) return;
    try {
      const safeUser = await window.CITLAuth.loadProfile();
      document.querySelectorAll('[data-manager-only]').forEach((el) => el.classList.toggle('hidden', !window.CITLPermissions.full(safeUser)));
      return safeUser;
    } catch (error) {
      window.CITLAuth.showFailure(error);
      return null;
    }
  }

  function setBadge(count) {
    for (const id of ['notif-badge', 'notif-badge-mob']) {
      const el = document.getElementById(id); if (!el) continue;
      el.textContent = String(Math.min(count, 99)); el.classList.toggle('hidden', count === 0);
    }
    document.querySelectorAll('#notif-btn-wrapper .citl-mobile-bell,#notif-btn-wrapper-pc button').forEach((button) => button.classList.toggle('citl-has-unread', count > 0));
  }

  function syncUnreadPulse(){for(const id of ['notif-badge','notif-badge-mob']){const badge=document.getElementById(id),button=badge?.closest('button');if(button)button.classList.toggle('citl-has-unread',!badge.classList.contains('hidden')&&Number(badge.textContent)>0);}}
  for(const id of ['notif-badge','notif-badge-mob']){const badge=document.getElementById(id);if(badge)new MutationObserver(syncUnreadPulse).observe(badge,{attributes:true,attributeFilter:['class'],childList:true,characterData:true,subtree:true});}
  syncUnreadPulse();

  let notificationMode='unread',notificationPage=0;
  function renderNotifications(items, result={}) {
    const list = document.getElementById('notif-list'); if (!list) return;
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'p-8 text-center text-sm text-gray-500 font-bold';
      empty.textContent = 'لا توجد إشعارات غير مقروءة'; list.appendChild(empty);
    }
    if(notificationMode==='overdue'){
      const info=document.createElement('p');info.className='p-3 text-sm font-bold text-[#2A3475]';info.textContent='إشعارات أقدم من ٢٤ ساعة — الأقدم أولًا';list.append(info);
      const all=document.createElement('button');all.type='button';all.className='citl-ac-button secondary';all.textContent='عرض جميع الإشعارات';all.onclick=()=>{notificationMode='unread';notificationPage=0;void checkUserNotifications();};list.append(all);
    }
    for (const item of items) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `w-full text-right p-3 mb-2 rounded-xl border transition ${item.read_at ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-200'}`;
      if(item.kind==='admin_announcement'){button.classList.add('citl-administrative-notice');const badge=document.createElement('span');badge.className='citl-administrative-label';badge.textContent='إشعار إداري';button.append(badge);}
      const title = document.createElement('div'); title.className = 'text-sm font-black text-[#2A3475]'; title.textContent = item.title;
      const body = document.createElement('div'); body.className = 'text-xs text-gray-600 mt-1 leading-5'; body.textContent = item.kind==='admin_announcement'&&item.body?.length>180?item.body.slice(0,180)+'…':item.body || '';
      const date = document.createElement('div'); date.className = 'text-[10px] text-gray-400 mt-2'; date.textContent = new Date(item.created_at).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'});
      button.append(title, body, date);
      if(item.kind==='schedule_action' && item.payload?.review){const status=document.createElement('div');status.className='text-xs text-[#2A3475] mt-2';status.textContent=window.CITLOversight?.reviewLabel(item.payload.review)||'';button.append(status);} 
      button.addEventListener('click', async () => {
        if(button.disabled)return;
        button.disabled=true;button.setAttribute('aria-busy','true');
        const wait=setTimeout(()=>window.showLoader?.('جاري فتح الإشعار...'),180);
        let navigating=false;
        try {
          if(item.kind==='admin_announcement'){document.getElementById('notif-menu')?.classList.add('hidden');await window.CITLAnnouncements.open(item.payload.announcement_id,false,item.payload.revision);return;}
          if (!item.read_at) await invoke('notifications.read', { ids: [item.id] });
          document.getElementById('notif-menu')?.classList.add('hidden');
          await checkUserNotifications();
          if(window.CITLOversight?.openRegistrationNotice(item))return;
          if(await openSpecialNotice(item))return;
          if(item.entity_type==='meetings'&&window.CITLMeetingUI){await window.CITLMeetingUI.open(item.entity_id,true);return;}
          if (item.route && /^\/[a-z0-9_/?=&.-]*$/i.test(item.route)) {navigating=true;location.href = item.route;}
        } catch (error) { window.showNotification?.('تعذر فتح الإشعار؛ أعد المحاولة','error'); }
        finally {clearTimeout(wait);if(!navigating)window.hideLoader?.();button.disabled=false;button.removeAttribute('aria-busy');}
      });
      list.appendChild(button);
    }
    if(notificationMode==='overdue'&&(notificationPage>0||result.has_more))for(const [step,label] of [[-1,'الصفحة السابقة'],[1,'المزيد من الإشعارات المتأخرة']]){const b=document.createElement('button');b.type='button';b.className='citl-ac-button secondary';b.textContent=label;b.disabled=step<0?notificationPage===0:!result.has_more;b.onclick=()=>{notificationPage+=step;void checkUserNotifications();};list.append(b);}
    const history=document.createElement('button');history.type='button';history.className='citl-ac-button secondary';history.textContent='سجل الإشعارات والأحداث';history.onclick=()=>{document.getElementById('notif-menu')?.classList.add('hidden');window.CITLAdminAccess?.openHistory();};list.append(history);
  }

  async function openSpecialNotice(item){
    if(item.kind==='lecture_room_reserved'){
      const p=item.payload||{},d=document.createElement('dialog');d.className='citl-head-dialog citl-ac-dialog';d.dir='rtl';
      const fields=[['المحاضرة',p.lecture?.course_name],['المحاضر',p.lecture?.instructor],['عنوان الحجز',p.booking_title],['القاعة',p.room_name],['تاريخ الحجز',p.booking_date],['التوقيت',String(p.start_time||'').slice(0,5)+' – '+String(p.end_time||'').slice(0,5)],['مقدم الحجز',p.booked_by],['سبب الحجز',p.reason],['التفاصيل',p.description]];
      d.innerHTML='<header><strong>'+htmlEscape(item.title)+'</strong><button type="button" aria-label="إغلاق">×</button></header><div class="citl-ac-body"><dl class="citl-claim-details">'+fields.filter(([,v])=>v).map(([k,v])=>'<div><dt>'+htmlEscape(k)+'</dt><dd style="white-space:pre-wrap;overflow-wrap:anywhere">'+htmlEscape(v)+'</dd></div>').join('')+'</dl><p>تفاصيل الحجز وقت إرسال الإشعار. راجع جدول القاعات لمعرفة حالته الحالية.</p></div>';
      d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();return true;
    }
    if(!item.route||!window.CITLOversight?.openWorkboard)return false;
    const url=new URL(item.route,location.origin);if(url.origin!==location.origin)return false;
    if(url.searchParams.get('open')==='academic'){await window.CITLOversight.openWorkboard({action:url.searchParams.get('action'),term:url.searchParams.get('term')});return true;}
    if(url.searchParams.get('open')==='approvals'&&window.CITLOversight.openApprovals){await window.CITLOversight.openApprovals();return true;}
    return false;
  }
  window.CITLOpenSpecialNotice=openSpecialNotice;

  let lastRightsNotice = '';
  async function checkUserNotifications() {
    try {
      await session();const result = notificationMode==='overdue'?await window.CITLRequests.rpc(window.sb,'citl_overdue_notifications',{p_page:notificationPage}):await window.CITLRequests.rpc(window.sb,'citl_notifications_view',{p_mode:'unread',p_page:0}); const items = (result.notifications || []).filter(x=>!x.read_at);
      window.__citlNotifications = items; renderNotifications(items,result); setBadge(result.unread_total ?? result.total ?? items.length);window.CITLNotificationReminder?.check();
      const rightsNotice=items.find(n=>['department_head_assignment','account_permissions'].includes(n.kind));
      if(rightsNotice&&lastRightsNotice!==rightsNotice.id){lastRightsNotice=rightsNotice.id;await window.CITLAuth.loadProfile();window.dispatchEvent(new CustomEvent('citl-permissions-changed'));}
      return true;
    } catch (error) { console.error('notifications:', error);return false; }
  }

  async function markAllNotificationsRead() {
    try { await invoke('notifications.read'); document.getElementById('notif-menu')?.classList.add('hidden'); await checkUserNotifications(); }
    catch (error) { window.showNotification?.(error.message, 'error'); }
  }

  async function toggleNotifications(options) {
    const menu = document.getElementById('notif-menu'); if (!menu) return;
    const opening = menu.classList.contains('hidden'); menu.classList.toggle('hidden');
    if (opening) {
      notificationMode=options?.overdue===true?'overdue':'unread';notificationPage=0;
      const anchor = document.getElementById(innerWidth < 1024 ? 'notif-btn-wrapper' : 'notif-btn-wrapper-pc');
      const rect = anchor?.getBoundingClientRect();
      menu.style.top = `${Math.max(8,Math.min((rect?.bottom || 70) + 8, innerHeight - 160))}px`;
      menu.style.maxHeight=`${Math.max(120,innerHeight-parseFloat(menu.style.top)-12)}px`;
      menu.style[document.dir === 'rtl' ? 'right' : 'left'] = `${Math.max(10, innerWidth - (rect?.right || innerWidth - 10))}px`;
      const loaded=await checkUserNotifications();
      if(options?.overdue===true&&!loaded)throw new Error('تعذر تحميل الإشعارات المتأخرة؛ أعد المحاولة.');
    }
  }

  async function secureLogout() {
    try { await window.presenceTracker?.logout?.(); } catch {}
    try { await window.sb?.auth?.signOut(); } catch {}
    localStorage.removeItem('currentUser'); localStorage.removeItem('sessionToken'); localStorage.removeItem('seen_notifications');
    sessionStorage.clear(); location.replace('/');
  }

  let scheduleSaving = false;
  async function secureScheduleAction() {
    if (scheduleSaving) return;
    const scheduleId = document.getElementById('sa-schedule-id')?.value;
    const actionDate = document.getElementById('sa-action-date')?.value; const type = document.getElementById('sa-type')?.value;
    const reason = document.getElementById('sa-reason')?.value.trim() || '';
    const replacementInstructor = document.getElementById('sa-replacement-instructor')?.value.trim() || '';
    const replacementRoom = document.getElementById('sa-replacement-room')?.value.trim() || '';
    if (!scheduleId || !actionDate || !type || !reason) return window.showNotification?.('بيانات الإجراء والسبب مطلوبة', 'error');
    if (['replace', 'replace_and_move'].includes(type) && !replacementInstructor) return window.showNotification?.('اختر المحاضر البديل', 'error');
    if (['move_room', 'replace_and_move'].includes(type) && !replacementRoom) return window.showNotification?.('اختر القاعة البديلة', 'error');
    scheduleSaving = true;
    const button = document.getElementById('sa-save-btn');
    if (button) button.disabled = true;
    try {
      if (!await window.CITLLectureDates.confirm(actionDate,type)) return;
      const current = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const result = await invoke('schedule_action.save', { data: { schedule_id: scheduleId, action_date: actionDate,
        action_type: type, reason, replacement_instructor: replacementInstructor || null, replacement_room: replacementRoom || null,
        department_key: current.department || null } });
      window.closeScheduleActionModal?.(); window.showNotification?.(`تم حفظ الإجراء وإرسال ${result.notified || 0} تنبيه ✅`, 'success');
      if (current.linked_instructors) await window.showMyScheduleView?.(current.linked_instructors);
      if (document.getElementById('schedule-reports-modal')?.classList.contains('flex')) await window.loadScheduleReports?.();
    } catch (error) { window.showNotification?.(error.message, 'error'); }
    finally { scheduleSaving = false; if (button) button.disabled = false; }
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
  const legacySaveAdminChanges = window.saveAdminChanges;
  if (typeof legacySaveAdminChanges === 'function') window.saveAdminChanges = async function (...args) {
    const result = await legacySaveAdminChanges.apply(this, args);
    try { await invoke('sessions.sync'); } catch (error) { console.info('schedule sync:', error.message); }
    return result;
  };
  window.logout = secureLogout;

  const protectedPageReady = validateProtectedPage();
  addEventListener('load', async () => {
    if (!await protectedPageReady) return;
    if (location.pathname.startsWith('/schedules/') && new URLSearchParams(location.search).get('open') === 'attendance') {
      await window.openSchedulePresenceModal?.();
      if(new URLSearchParams(location.search).get('tab')==='qr')window.amSwitchTab?.('qr');
    }
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm && !addUserForm.dataset.secureBound) {
      addUserForm.dataset.secureBound = 'true'; addUserForm.addEventListener('submit', secureAddUser, true);
    }
    await checkUserNotifications();
    try {
      const current = await session();
      if (window.__citlNotificationChannel) return;
      window.__citlNotificationChannel = window.sb.channel(`notifications:${current.user.id}`).on('postgres_changes', {
        event: '*', schema: 'public', table: 'citl_notifications', filter: `recipient_id=eq.${current.user.id}`
      }, async (payload) => {
        await checkUserNotifications();
        if (payload?.eventType === 'INSERT' && !document.getElementById('notif-list')) {
          window.showNotification?.(payload.new?.title || 'وصلك تنبيه جديد', 'success');
        }
      }).subscribe();
    } catch (error) { console.error('notification realtime:', error); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUserNotifications(); });
  setInterval(()=>{if(!document.hidden&&navigator.onLine)checkUserNotifications();},30000);
})();
