(function(root){
 'use strict';
 const rpc=(action,payload={})=>root.CITLRequests.rpc(root.sb,'citl_lecture_date_grant_admin',{p_action:action,p_payload:payload});
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function open(){
  if(!root.CITLPermissions.full(root.currentUser))return;
  const d=document.createElement('dialog');d.className='citl-correction-dialog';d.dir='rtl';d.innerHTML='<header><strong>إتاحة موعد سابق لعضو</strong><button type="button" aria-label="إغلاق">×</button></header><div data-body><p class="citl-correction-loading">جاري تحميل الأعضاء والإتاحات…</p></div>';document.body.append(d);d.showModal();d.querySelector('header button').onclick=()=>d.close();d.onclose=()=>d.remove();const body=d.querySelector('[data-body]');let busy=false;
  async function load(){const data=await rpc('list');if(!d.isConnected)return;
   body.innerHTML='<form class="citl-correction-form"><p>افتح تاريخًا سابقًا محددًا لهذا العضو في الترم الحالي. الإتاحة تشمل محاضراته المصرح له بإجراء عليها في هذا اليوم فقط، ولا تمنحه صلاحيات مدير. إلغاؤها لا يحذف إجراءً سبق تسجيله.</p><label>عضو هيئة التدريس<select name="member" required><option value="">اختر العضو</option>'+data.members.map(p=>'<option value="'+E(p.id)+'">'+E(p.name)+' — '+E(p.department)+'</option>').join('')+'</select></label><label>التاريخ السابق<input type="date" name="date" required min="'+E(data.term?.starts_on||'')+'" max="'+E(data.today)+'"></label><button type="submit" '+(!data.term?'disabled':'')+'>إتاحة هذا اليوم للعضو</button><p role="status"></p><section><strong>الإتاحات الحالية في الترم</strong><div data-grants></div></section></form>';
   const f=body.querySelector('form'),status=f.querySelector('[role=status]'),list=f.querySelector('[data-grants]');
   if(!data.grants.length)list.textContent='لا توجد إتاحات استثنائية.';
   for(const g of data.grants){const row=document.createElement('div');row.className='citl-correction-person';row.innerHTML='<div><strong>'+E(g.full_name)+'</strong><bdi>'+E(g.action_date)+'</bdi></div><button type="button">إلغاء الإتاحة</button>';row.querySelector('button').onclick=()=>mutate('revoke',{id:g.id});list.append(row);}
   async function mutate(action,payload){if(busy)return;busy=true;f.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='جاري الحفظ…';try{await rpc(action,payload);await load();root.showNotification?.(action==='grant'?'تم فتح الموعد للعضو في إجراءات محاضراته':'تم إلغاء إتاحة الموعد','success');}catch(e){status.textContent=e.message;}finally{busy=false;if(f.isConnected)f.querySelectorAll('button').forEach(b=>b.disabled=false);}}
   f.onsubmit=e=>{e.preventDefault();if(!f.reportValidity())return;if(f.elements.date.value>=data.today){status.textContent='اختر يومًا سابقًا، وليس اليوم أو تاريخًا قادمًا.';f.elements.date.focus();return;}mutate('grant',{profile_id:f.elements.member.value,date:f.elements.date.value});};
  }
  try{await load();}catch(e){body.textContent=e.message;}
 }
 function mount(){const panel=document.getElementById('admin-academic-actions-tab');let card=document.getElementById('citl-past-date-access');if(!root.CITLPermissions?.full(root.currentUser)){card?.remove();return;}if(!panel||card)return;card=document.createElement('section');card.id='citl-past-date-access';card.className='citl-admin-section';card.innerHTML='<div class="citl-admin-section-head"><div><h3><i class="fas fa-calendar-plus" aria-hidden="true"></i> إتاحة موعد سابق لعضو</h3><p>استثناء لتاريخ واحد داخل الترم الحالي — للمدير كامل الصلاحيات فقط.</p></div><button type="button" class="citl-ac-button">إدارة الإتاحة</button></div>';card.querySelector('button').onclick=open;panel.prepend(card);}
 root.CITLPastDates={mount,open};root.addEventListener('citl-profile-loaded',mount);root.addEventListener('citl-permissions-changed',mount);mount();
})(window);
