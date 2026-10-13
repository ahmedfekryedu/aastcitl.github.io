(function (root) {
  'use strict';
  const catalog=[['can_approve','الحجوزات: الاعتماد والرفض'],['can_delete','الحجوزات: الحذف'],['can_manage_users','إدارة المستخدمين وبيانات الحسابات'],['can_manage_schedules','الجداول: الرفع والتحديث والتعديل والحذف'],['can_manage_rooms','إدارة القاعات وربطها بالجداول'],['can_manage_structure','الهيكل الأكاديمي وتعيين مسؤولي الجهات'],['can_manage_news','الأخبار وإعلانات الشاشة والصور والفيديو'],['can_manage_settings','إعدادات النظام ومواعيد الحجز'],['can_view_reports','التقارير والطباعة ومتابعة إجراءات الكلية'],['can_review_registrations','اعتماد طلبات ربط أعضاء الكلية'],['can_manage_registration_codes','إدارة أكواد التسجيل']];
  const keys = catalog.map(([k])=>k);
  function full(user) {
    const p = user?.permissions || {};
    if (user?.permissions != null && (typeof user.permissions !== 'object' || Array.isArray(user.permissions))) return false;
    return user?.role === 'manager' && (Object.prototype.hasOwnProperty.call(p,'full_access') ? p.full_access===true : Object.keys(p).length === 0 || ['can_approve','can_manage_users','can_delete'].every(k => p[k] === true));
  }
  function can(user, capability) {
    return full(user) || (user?.role === 'manager' && keys.includes(capability) && user.permissions?.[capability] === true);
  }
  root.CITLPermissions = Object.freeze({ full, can, catalog, any: user=>full(user)||keys.some(k=>can(user,k)) });
})(window);
