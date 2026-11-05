(function(root){'use strict';
 const departments={"dean": "مكتب العميد", "transport-logistics": "قسم إدارة لوجستيات النقل", "trade-logistics": "قسم إدارة لوجستيات التجارة الدولية", "supply-chain": "قسم إدارة لوجستيات سلاسل الإمداد", "energy-logistics": "قسم إدارة لوجستيات الطاقة والبترول", "admin-followup": "قسم المتابعة الإدارية", "training-agency": "وكالة شؤون التدريب وخدمة المجتمع", "postgrad-agency": "وكالة الدراسات العليا والبحث العلمي", "education-agency": "وكالة شؤون التعليم", "students-agency": "وكالة شؤون الطلاب", "assistants-office": "مكتب المعيدين", "visitor": "زائر خارجي", "computer-lab": "معمل الحاسب", "vice-dean-academic": "وكالة شؤون التعليم (سابقاً)", "vice-dean-graduate": "وكالة الدراسات العليا (سابقاً)", "vice-dean-community": "وكالة خدمة المجتمع (سابقاً)", "vice-dean-development": "وكالة التطوير (سابقاً)", "logistics-dept": "قسم اللوجستيات (سابقاً)", "transport-dept": "قسم النقل (سابقاً)", "supply-dept": "قسم سلاسل الإمداد (سابقاً)", "business-dept": "قسم إدارة الأعمال (سابقاً)", "assistant": "معيد (سابقاً)"};
 root.CITLAttendanceShell={profile(profile){
  const manager=!!root.CITLPermissions?.full(profile);
  document.querySelectorAll('[data-attendance-manager]').forEach(n=>n.hidden=!manager);
  const name=profile.full_name||profile.email||'الحساب',department=departments[profile.department]||profile.department||'';
  for(const id of ['profile-name','profile-name-mob']){const n=document.getElementById(id);if(n)n.textContent=(id==='profile-name'?'مرحباً، ':'')+name;}
  for(const id of ['profile-role','profile-role-mob']){const n=document.getElementById(id);if(n)n.textContent=[department,profile.position].filter(Boolean).join(' - ');}
  root.currentUser=profile;root.dispatchEvent(new CustomEvent('citl-profile-loaded',{detail:profile}));
 },scope(scope){document.querySelectorAll('[data-attendance-manager]').forEach(n=>n.hidden=!scope.manual);},eligible(value){document.querySelectorAll('[data-attendance-self]').forEach(n=>n.hidden=!value);}};
 root.logout=async()=>{try{const {error}=await root.sb.auth.signOut({scope:'local'});if(error)throw error;location.assign('/');}catch(e){document.getElementById('ar8-status').textContent='تعذر تسجيل الخروج؛ أعد المحاولة.';}};
})(window);
