(function(root){'use strict';
 const departments={'transport-logistics':'قسم إدارة لوجستيات النقل','trade-logistics':'قسم إدارة لوجستيات التجارة الدولية','supply-chain':'قسم إدارة لوجستيات سلاسل الإمداد','energy-logistics':'قسم إدارة لوجستيات الطاقة والبترول'};
 root.CITLAttendanceShell={profile(profile){
  const manager=!!root.CITLPermissions?.full(profile);
  document.querySelectorAll('[data-attendance-manager]').forEach(n=>n.hidden=!manager);
  const name=profile.full_name||profile.email||'الحساب',department=departments[profile.department]||profile.department||'';
  for(const id of ['profile-name','profile-name-mob']){const n=document.getElementById(id);if(n)n.textContent=(id==='profile-name'?'مرحباً، ':'')+name;}
  for(const id of ['profile-role','profile-role-mob']){const n=document.getElementById(id);if(n)n.textContent=[department,profile.position].filter(Boolean).join(' - ');}
  root.currentUser=profile;root.dispatchEvent(new CustomEvent('citl-profile-loaded',{detail:profile}));
 },eligible(value){document.querySelectorAll('[data-attendance-self]').forEach(n=>n.hidden=!value);}};
 root.logout=async()=>{try{const {error}=await root.sb.auth.signOut({scope:'local'});if(error)throw error;location.assign('/');}catch(e){document.getElementById('ar8-status').textContent='تعذر تسجيل الخروج؛ أعد المحاولة.';}};
})(window);
