(function (root) {
  'use strict';
  const keys = ['can_approve', 'can_manage_users', 'can_delete'];
  function full(user) {
    const p = user?.permissions || {};
    if (user?.permissions != null && (typeof user.permissions !== 'object' || Array.isArray(user.permissions))) return false;
    return user?.role === 'manager' && (Object.keys(p).length === 0 || keys.every(k => p[k] === true));
  }
  function can(user, capability) {
    return full(user) || (user?.role === 'manager' && keys.includes(capability) && user.permissions?.[capability] === true);
  }
  root.CITLPermissions = Object.freeze({ full, can });
})(window);
