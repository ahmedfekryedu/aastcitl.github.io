(function (root) {
  'use strict';
  const permissions = root.CITLPermissions;
  const current = () => root.currentUser;
  const can = capability => permissions.can(current(), capability);
  function tabAllowed(tab) {
    if (permissions.full(current()) || tab === 'profile') return true;
    if (tab === 'users') return can('can_manage_users');
    if (tab === 'meetings') return can('can_approve') || can('can_delete');
    return false;
  }
  const oldApply = root.applyUserPermissions;
  if (oldApply) root.applyUserPermissions = function (...args) {
    const result = oldApply.apply(this, args);
    if (can('can_manage_users') || can('can_approve') || can('can_delete')) {
      const button = document.getElementById('admin-panel-btn');
      if (button) { button.innerHTML = '<img src="/assets/control-panel.svg" width="18" height="18" alt="" class="citl-control-icon" style="display:inline-block;vertical-align:middle;flex-shrink:0"><span>لوحة التحكم</span>'; button.onclick = () => root.openAdminPanel(); }
    }
    return result;
  };
  const oldOpen = root.openAdminPanel;
  if (oldOpen) root.openAdminPanel = function (...args) {
    if (permissions.full(current())) return oldOpen.apply(this, args);
    root.updateSidebarProfile?.();
    document.querySelectorAll('.admin-tab').forEach(tab => { tab.style.display = tabAllowed(tab.dataset.tab) ? 'flex' : 'none'; });
    root.switchAdminTab(can('can_manage_users') ? 'users' : (can('can_approve') || can('can_delete')) ? 'meetings' : 'profile');
    document.getElementById('admin-panel-modal')?.classList.add('show');
  };
  const oldSwitch = root.switchAdminTab;
  if (oldSwitch) root.switchAdminTab = function (tab) {
    if (!tabAllowed(tab)) { root.showNotification?.('هذا القسم غير متاح لصلاحيات حسابك', 'error'); return; }
    return oldSwitch.call(this, tab);
  };
  const guards = {
    approveMeeting:'can_approve',rejectMeeting:'can_approve',approveModification:'can_approve',rejectModification:'can_approve',
    rejectDeleteRequest:'can_approve',confirmDeleteRequest:'can_delete',bulkDeleteMeetings:'can_delete',
    openPermissionsModal:'full',saveRoom:'full',deleteRoom:'full',saveFacultyDirectoryEntry:'full',deleteFacultyDirectoryEntry:'full',saveSystemSettings:'full',
    saveTvDisplayConfig:'full',saveTvPosterGlobalConfig:'full',saveNewsConfig:'full',updatePosterQuickSettings:'full'
  };
  for (const [name, capability] of Object.entries(guards)) {
    const original = root[name]; if (!original) continue;
    root[name] = function (...args) {
      if (!can(capability)) { root.showNotification?.('لا تملك صلاحية تنفيذ هذا الإجراء', 'error'); return; }
      return original.apply(this, args);
    };
  }
})(window);
