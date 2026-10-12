(function(root){
 'use strict';
 const btn='px-3 py-2 rounded-lg bg-[#2A3475] text-white text-xs font-bold';
 const label=key=>(typeof departments!=='undefined'?departments[key]?.name:null)||key;
 async function rpc(action,payload={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,'citl_department_head_admin',{p_action:action,p_payload:payload});}
 let emailLibrary;
 async function sendEmail(data){
  if(!data?.to_email)throw new Error('لا يوجد بريد مسجل للحساب');
  if(!root.emailjs){
   if(!emailLibrary)emailLibrary=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';s.onload=resolve;s.onerror=()=>{emailLibrary=null;s.remove();reject(new Error('تعذر تحميل خدمة البريد'));};document.head.append(s);});
   await emailLibrary;
  }
  // Existing site's public EmailJS integration; no private credential is used.
  root.emailjs.init('su_jhKxAtjo-Kr-8w');
  await root.emailjs.send('service_rpu85xb','template_v4fabdd',{to_email:data.to_email,to_name:data.to_name,
   subject:'CITL Smart System — تعيين رئيس قسم',message:'تم تعيينك رئيسًا لقسم '+label(data.department_key)+'. يمكنك متابعة منتدبي القسم من: https://aastcitl.me/schedules/?open=attendance'});
 }
 async function save(department,profile){
  const result=await rpc('save',{department_key:department,profile_id:profile});
  if(result.email){try{await sendEmail(result.email);result.email_status='sent';}catch(error){result.email_status='failed';result.email_error=error.message;}}
  return result;
 }
 function feedback(result,host){
  host.replaceChildren(document.createTextNode(result.email_status==='failed'?'تم حفظ التعيين وإرسال تنبيه داخل الموقع، لكن تعذّر إرسال البريد.':result.changed?'تم حفظ التعيين وإرسال التنبيه'+(result.email_status==='sent'?' وطلب إرسال البريد.':'.'):'هذا العضو معيّن بالفعل؛ لم تتغير الصلاحيات.'));
  if(result.email_status==='failed'){
   const retry=document.createElement('button');retry.type='button';retry.className=btn+' mr-2';retry.textContent='إعادة إرسال البريد';host.append(retry);
   retry.onclick=async()=>{retry.disabled=true;try{await sendEmail(result.email);host.textContent='تم قبول طلب إرسال البريد.';}catch(error){retry.disabled=false;retry.title=error.message;}};
  }
 }
 async function open(profile){
  if(!root.CITLPermissions.full(root.currentUser))return;
  document.getElementById('citl-head-dialog')?.remove();
  const dialog=document.createElement('dialog');dialog.id='citl-head-dialog';dialog.className='citl-head-dialog';dialog.dir='rtl';
  dialog.innerHTML='<header><strong>تعيين رئيس قسم</strong><button type="button" data-close aria-label="إغلاق">×</button></header><form><p data-person class="text-sm font-bold"></p><label>القسم<select name="department" required><option value="">اختر القسم</option></select></label><p class="text-xs text-gray-500">يمنح متابعة منتدبي القسم وتنبيهاته، دون صلاحيات مدير النظام.</p><button type="submit" class="'+btn+'">حفظ التعيين</button><p data-status role="status" class="text-xs"></p></form>';
  const form=dialog.querySelector('form');dialog.querySelector('[data-person]').textContent=profile.full_name||profile.email;
  for(const [key,value] of Object.entries(typeof departments!=='undefined'?departments:{})){if(key!=='visitor')form.elements.department.add(new Option(value.name||key,key));}
  form.elements.department.value=profile.department||'';
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclick=event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}};
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;const status=form.querySelector('[data-status]');status.textContent='جاري حفظ التعيين…';
   try{const result=await save(form.elements.department.value,profile.id);feedback(result,status);await root.updateAdminUsersList?.();}
   catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
  document.body.append(dialog);dialog.showModal();
 }
 async function decorate(users){
  if(!root.CITLPermissions.full(root.currentUser))return;
  // Action controls are available immediately; badges arrive silently.
  for(const user of users){
   const row=document.querySelector('tr[data-user-id="'+user.id+'"]');if(!row||row.querySelector('[data-head-action]'))continue;
   const button=document.createElement('button');button.type='button';button.dataset.headAction='';button.className='w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-[#2A3475]';button.title='تعيين رئيس قسم';button.setAttribute('aria-label','تعيين رئيس قسم: '+(user.full_name||user.email));button.innerHTML='<i class="fas fa-user-tie text-xs" aria-hidden="true"></i>';button.onclick=()=>open(user);
   (row.lastElementChild?.firstElementChild||row.lastElementChild)?.append(button);
  }
  try{const data=await rpc('list');
   for(const user of users){const row=document.querySelector('tr[data-user-id="'+user.id+'"]');if(!row)continue;row.querySelectorAll('[data-head-badge]').forEach(n=>n.remove());
    const assigned=data.heads.filter(h=>h.profile_id===user.id);if(!assigned.length)continue;
    const badge=document.createElement('span');badge.dataset.headBadge='';badge.className='block text-[10px] text-[#2A3475] font-bold mt-1';badge.style.whiteSpace='nowrap';badge.textContent='رئيس قسم';badge.title=assigned.map(h=>label(h.department_key)).join('، ');row.children[4]?.append(badge);
   }
  }catch(error){root.showNotification?.('تعذر تحديث تعيينات رؤساء الأقسام: '+error.message,'error');}
 }
 root.CITLDepartmentHeads=Object.freeze({open,decorate,save,feedback});
 let accessBusy=false;
 async function showAttendanceLink(profile){
  if(!profile||root.CITLPermissions.full(profile)||accessBusy||document.getElementById('department-attendance-link'))return;
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
