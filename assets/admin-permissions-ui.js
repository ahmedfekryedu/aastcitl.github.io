(function (root) {
  'use strict';
  const permissions = root.CITLPermissions;
  const current = () => root.currentUser;
  const can = capability => permissions.can(current(), capability);
  function tabAllowed(tab) {
    if (tab === 'room-monitor') return can('can_monitor_rooms');
    if (tab === 'service-availability') return can('can_manage_settings');
    if (tab === 'registration-codes') return false;
    if (tab === 'announcements') return permissions.full(current());
    if (tab === 'activity-history') return !!current() && !root.CITLAuth.facultyPending(current());
    if (tab === 'academic-actions') return !!root.CITLOversight?.canAcademicActions();
    if (tab === 'academic-review') return !!root.CITLOversight?.canReviewRegistration();
    if (tab === 'my-bookings') return !!current() && !permissions.full(current()) && !root.CITLAuth.facultyPending(current());
    if (permissions.full(current()) || tab === 'profile') return true;
    if (tab === 'users') return can('can_manage_users') || can('can_manage_registration_codes');
    if (tab === 'meetings') return can('can_approve') || can('can_delete');
    const module={'registration-codes':'can_manage_registration_codes',directory:'can_manage_structure','term-schedules':'can_manage_schedules',settings:'can_manage_settings',rooms:'can_manage_rooms',news:'can_manage_news',reports:'can_view_reports'};
    if(module[tab])return can(module[tab]);
    return false;
  }

  // Reconcile visibility from the signed-in profile, never the account being edited.
  function refreshTabs() {
    const modal=document.getElementById('admin-panel-modal');if(!modal)return;
    modal.querySelectorAll('.admin-tab').forEach(tab=>{tab.style.display=tabAllowed(tab.dataset.tab)?'flex':'none';});
  }
  root.addEventListener('citl-profile-loaded',refreshTabs);
  // Order shared static and lazily mounted tabs without changing their permissions.
  const tabOrder=['users','directory','settings','meetings','rooms','room-monitor','news','term-schedules','announcements','academic-review','academic-actions','activity-history','my-bookings'];
  function orderTabs(){
    const parent=document.querySelector('#admin-panel-modal .admin-tab')?.parentElement;if(!parent)return;
    const tabs=[...parent.children].filter(e=>e.classList.contains('admin-tab'));
    const rank=e=>e.dataset.tab==='service-availability'?999:e.dataset.tab==='profile'?1000:e.dataset.tab==='reports'?1001:tabOrder.includes(e.dataset.tab)?tabOrder.indexOf(e.dataset.tab):100;
    const wanted=[...tabs].sort((a,b)=>rank(a)-rank(b));
    if(wanted.every((e,i)=>e===tabs[i]))return;
    for(const tab of wanted)parent.append(tab);
  }
  const tabHost=document.querySelector('#admin-panel-modal .admin-tab')?.parentElement;
  if(tabHost){new MutationObserver(()=>{orderTabs();refreshTabs();}).observe(tabHost,{childList:true});orderTabs();refreshTabs();}
  const oldApply = root.applyUserPermissions;
  if (oldApply) root.applyUserPermissions = function (...args) {
    const button = document.getElementById('admin-panel-btn') || document.querySelector('header .citl-header-control');
    if(button)button.id='admin-panel-btn';
    const result = oldApply.apply(this, args);
    if(button&&current())button.onclick=()=>root.openAdminPanel();
    if (permissions.any(current()) || root.CITLOversight?.canAcademicActions() || root.CITLOversight?.canReviewRegistration()) {
      if (button) { button.innerHTML = '<img src="/assets/control-panel.svg" width="18" height="18" alt="" class="citl-control-icon" style="display:inline-block;vertical-align:middle;flex-shrink:0"><span>لوحة التحكم</span>'; button.onclick = () => root.openAdminPanel(); }
    }
    refreshTabs();
    return result;
  };
  const oldOpen = root.openAdminPanel;
  if (oldOpen) root.openAdminPanel = function (...args) {
    if(root.CITLControlPage?.navigate(args[0]))return;
    if (permissions.full(current())) {const result=oldOpen.apply(this,args);refreshTabs();return result;}
    root.updateSidebarProfile?.();
    const modal=document.getElementById('admin-panel-modal');root.CITLFacultyAdmin?.mountCodes(modal,modal?.querySelector('.admin-tab[data-tab=profile]'));
    document.querySelectorAll('.admin-tab').forEach(tab => { tab.style.display = tabAllowed(tab.dataset.tab) ? 'flex' : 'none'; });
    const preferred=(typeof args[0]==='string'&&tabAllowed(args[0])?args[0]:null)||['users','meetings','term-schedules','rooms','room-monitor','directory','news','settings','reports','registration-codes'].find(tabAllowed)||'profile';
    root.switchAdminTab(preferred);
    document.getElementById('admin-panel-modal')?.classList.add('show');
    root.CITLOversight?.mountAdmin();
  };
  const oldSwitch = root.switchAdminTab;
  if (oldSwitch) root.switchAdminTab = function (tab) {
    if (!tabAllowed(tab)) { root.showNotification?.('هذا القسم غير متاح لصلاحيات حسابك', 'error'); return; }
    const entry=root.CITLServices?.decisionByTab?.(tab);if(entry&&!entry.allowed){root.CITLServices.enter(entry.key);return;}
    return oldSwitch.call(this, tab);
  };
  const guards = {
    approveMeeting:'can_approve',rejectMeeting:'can_approve',approveModification:'can_approve',rejectModification:'can_approve',
    rejectDeleteRequest:'can_approve',confirmDeleteRequest:'can_delete',bulkDeleteMeetings:'can_delete',
    openPermissionsModal:'full',saveRoom:'can_manage_rooms',deleteRoom:'can_manage_rooms',saveFacultyDirectoryEntry:'can_manage_structure',deleteFacultyDirectoryEntry:'can_manage_structure',saveSystemSettings:'can_manage_settings',
    saveTvDisplayConfig:'can_manage_news',saveTvPosterGlobalConfig:'can_manage_news',saveNewsConfig:'can_manage_news',updatePosterQuickSettings:'can_manage_news'
  };
  for (const [name, capability] of Object.entries(guards)) {
    const original = root[name]; if (!original) continue;
    root[name] = function (...args) {
      if (!can(capability)) { root.showNotification?.('لا تملك صلاحية تنفيذ هذا الإجراء', 'error'); return; }
      return original.apply(this, args);
    };
  }
  root.addEventListener('citl-permissions-changed',async()=>{
    root.applyUserPermissions?.();
    document.querySelectorAll('[data-manager-only]').forEach(el=>el.classList.toggle('hidden',!permissions.full(current())));
    await root.CITLOversight?.mountAdmin();
    document.querySelectorAll('.admin-tab').forEach(tab=>tab.style.display=tabAllowed(tab.dataset.tab)?'flex':'none');
    const active=document.querySelector('.admin-tab.active');
    if(active&&!tabAllowed(active.dataset.tab))root.switchAdminTab('profile');
    if(!permissions.full(current()))document.getElementById('citl-account-permissions')?.close();if(!can('can_manage_structure'))document.getElementById('citl-head-dialog')?.close();
    root.CITLAnnouncements?.mount();
  });
})(window);
