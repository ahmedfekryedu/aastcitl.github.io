(function(root){
 'use strict';
 const btn='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 const label=key=>(typeof departments!=='undefined'?departments[key]?.name:null)||key;
 async function rpc(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_department_head_admin',{p_action:action,p_payload:payload});}
 async function save(department,profile,permissions={}){
  return rpc('save',{department_key:department,profile_id:profile,...permissions});
 }
 function feedback(result,host){host.textContent=result.changed?'تم حفظ التعيين والصلاحيات وإرسال إشعار داخل الموقع.':'التعيين والصلاحيات محفوظة بالفعل.';}
 async function open(profile){
  if(!root.CITLPermissions.full(root.currentUser))return;
  document.getElementById('citl-head-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='citl-head-dialog';dialog.className='citl-head-dialog';dialog.dir='rtl';
  dialog.innerHTML='<header><strong>مسؤول القسم وصلاحياته</strong><button type="button" data-close aria-label="إغلاق">×</button></header><form><p data-person class="text-sm font-bold"></p><label>القسم<select name="department" required><option value="">اختر القسم</option></select></label><fieldset class="citl-head-rights"><legend>صلاحيات الجهة المحددة</legend><label><input type="checkbox" name="can_approve_registrations"> مراجعة واعتماد طلبات ربط أعضائها</label><label><input type="checkbox" name="can_review_academic" checked> متابعة إجراءات المحاضرات ومراجعتها وطباعتها</label><label><input type="checkbox" name="can_view_visitors" checked> متابعة المنتدبين وتقارير الحضور</label></fieldset><p class="text-xs text-gray-500">أعضاء القسم المعتمدون يتبعونه تلقائيًا في إجراءات المحاضرات. اختيار المنتدبين للحضور يظل يدويًا؛ صلاحيات الحساب الأخرى محفوظة.</p><button type="submit" class="'+btn+'">حفظ التعيين</button><p data-status role="status" class="text-xs"></p></form>';
  const form=dialog.querySelector('form');dialog.querySelector('[data-person]').textContent=profile.full_name||profile.email;
  for(const [key,value] of Object.entries(typeof departments!=='undefined'?departments:{})){if(key!=='visitor')form.elements.department.add(new Option(value.name||key,key));}
  form.elements.department.value=profile.department||'';
  let assignments=[];form.querySelector('[type=submit]').disabled=true;
  const setRights=()=>{const h=assignments.find(x=>x.department_key===form.elements.department.value);for(const k of ['can_approve_registrations','can_review_academic','can_view_visitors'])form.elements[k].checked=h?h[k]!==false:k!=='can_approve_registrations';};
  form.elements.department.onchange=setRights;
  rpc('list').then(data=>{assignments=data.heads||[];setRights();form.querySelector('[type=submit]').disabled=false;}).catch(error=>{form.querySelector('[data-status]').textContent=error.message;});
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclick=event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}};
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;const status=form.querySelector('[data-status]');status.textContent='جاري حفظ التعيين…';
   try{const result=await save(form.elements.department.value,profile.id,Object.fromEntries(['can_approve_registrations','can_review_academic','can_view_visitors'].map(k=>[k,form.elements[k].checked])));feedback(result,status);await root.updateAdminUsersList?.();await root.loadFacultyDirectoryTab?.();}
   catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
  document.body.append(dialog);dialog.showModal();
 }
 async function decorate(users){
  if(!root.CITLPermissions.full(root.currentUser))return;
  // Action controls are available immediately; badges arrive silently.
  for(const user of users){
   const row=document.querySelector('tr[data-user-id="'+user.id+'"]');if(!row||row.querySelector('[data-head-action]'))continue;
   const button=document.createElement('button');button.type='button';button.dataset.headAction='';button.className='w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-[#2A3475]';button.title='مسؤول القسم وصلاحياته';button.setAttribute('aria-label','مسؤول القسم وصلاحياته: '+(user.full_name||user.email));button.innerHTML='<i class="fas fa-user-tie text-xs" aria-hidden="true"></i>';button.onclick=()=>open(user);
   (row.lastElementChild?.firstElementChild||row.lastElementChild)?.append(button);
  }
  try{const data=await rpc('list');
   for(const user of users){const row=document.querySelector('tr[data-user-id="'+user.id+'"]');if(!row)continue;row.querySelectorAll('[data-head-badge]').forEach(n=>n.remove());
    const assigned=data.heads.filter(h=>h.profile_id===user.id);if(!assigned.length)continue;
    const badge=document.createElement('span');badge.dataset.headBadge='';badge.className='block text-[10px] text-[#2A3475] font-bold mt-1';badge.style.whiteSpace='nowrap';badge.textContent='رئيس قسم';badge.title=assigned.map(h=>label(h.department_key)).join('، ');row.children[4]?.append(badge);
   }
  }catch(error){root.showNotification?.('تعذر تحديث تعيينات رؤساء الأقسام: '+error.message,'error');}
 }
 const originalPermissions=root.openPermissionsModal;
 if(originalPermissions)root.openPermissionsModal=function(...args){
  const result=originalPermissions.apply(this,args);if(!root.CITLPermissions.full(root.currentUser))return result;
  const modal=document.getElementById('permissions-modal');if(!modal)return result;
  let host=modal.querySelector('[data-head-permissions]');if(!host){host=document.createElement('section');host.dataset.headPermissions='';host.className='citl-head-permission-summary';(modal.querySelector('form')||modal).prepend(host);}
  const userId=args[0];host.dataset.userId=userId;host.dataset.loading='true';modal.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=true);if(!modal.dataset.headPermissionGuard){modal.dataset.headPermissionGuard='true';modal.addEventListener('submit',e=>{if(modal.querySelector('[data-head-permissions]')?.dataset.loading==='true'){e.preventDefault();e.stopImmediatePropagation();}},true);}host.innerHTML='<div class="citl-admin-placeholder" role="status" aria-label="جاري تحميل الصلاحيات الحالية"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div>';
  rpc('list').then(data=>{
   if(host.dataset.userId!==userId)return;host.replaceChildren();const user=data.profiles.find(p=>p.id===userId),assigned=data.heads.filter(h=>h.profile_id===userId);
   const title=document.createElement('strong');title.textContent='صلاحيات القسم الحالية';host.append(title);
   const text=document.createElement('p');text.textContent=assigned.length?'محفوظة تلقائيًا عند تعديل صلاحيات الحساب العامة أدناه. اعتماد الحجوزات يختلف عن اعتماد إجراءات المحاضرات.':'لا يوجد تعيين كرئيس جهة لهذا الحساب. الصلاحيات العامة أدناه مستقلة.';host.append(text);
   for(const h of assigned){const line=document.createElement('p');line.textContent=label(h.department_key)+' — '+[['can_approve_registrations','اعتماد التسجيل'],['can_review_academic','مراجعة المحاضرات والطباعة'],['can_view_visitors','متابعة قائمة المنتدبين اليدوية']].filter(([k])=>h[k]).map(([,v])=>v).join(' · ');host.append(line);}
   if(user&&root.CITLPermissions.full(user))for(const id of ['perm-approve','perm-users','perm-delete','perm-approve-2','perm-users-2','perm-delete-2']){const input=document.getElementById(id);if(input)input.checked=true;}
   host.dataset.loading='false';modal.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false);
  }).catch(error=>{if(host.dataset.userId===userId)host.textContent='تعذر تحميل الصلاحيات؛ أغلق النافذة وأعد فتحها قبل الحفظ. '+error.message;});return result;
 };
 root.CITLDepartmentHeads=Object.freeze({open,decorate,save,feedback,rpc,label});
 let accessBusy=false;
 async function showAttendanceLink(profile){
  if(!location.pathname.startsWith('/schedules/')||!profile||root.CITLPermissions.full(profile)||accessBusy||document.getElementById('department-attendance-link'))return;
  accessBusy=true;
  try{
   const result=await root.CITLRequests.rpc(root.sb,'citl_department_attendance',{p_action:'access',p_payload:{}});
   if(!result.is_head)return;
   const link=document.createElement('a');link.id='department-attendance-link';link.className=btn;link.textContent='متابعة منتدبي قسمي';link.href='/schedules/?open=attendance';
   const section=document.createElement('div');section.className='px-4 py-2 text-left';section.append(link);
   const header=document.querySelector('header');if(header)header.after(section);
  }catch(_){}finally{accessBusy=false;}
 }
 root.addEventListener('citl-profile-loaded',event=>showAttendanceLink(event.detail));
 if(root.currentUser)showAttendanceLink(root.currentUser);
})(window);
