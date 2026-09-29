(function(root){
 'use strict';
 const pendingText='تم إنشاء الحساب، ويجري انتظار اعتماد ربط حسابك بعضو هيئة التدريس من الإدارة.';
 const key=value=>String(value||'').replace(/[\u00a0\u202f\ufeff]/g,' ').trim().replace(/\s+/g,' ');
 const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const departmentLabel=value=>(typeof departments!=='undefined'?departments[value]?.name:null)||value||'غير محدد';
 const buttonClass='px-3 py-2 rounded-lg text-xs font-bold bg-[#2A3475] text-white';
 const fieldClass='w-full p-2 border border-gray-200 rounded-lg text-sm bg-white';
 let adminBusy=false;
 async function rpc(name,action,payload={}){
  await root.CITLAuth.session();
  return root.CITLRequests.rpc(root.sb,name,{p_action:action,p_payload:payload});
 }
 async function names(){
  const found=new Set();
  for(let offset=0;;offset+=500){
   const {data,error}=await root.sb.from('academic_schedule').select('id,instructor').order('id').range(offset,offset+499);
   if(error)throw error;
   (data||[]).forEach(row=>{const n=key(row.instructor);if(n&&n!=='غير محدد')found.add(n);});
   if(!data||data.length<500)break;
  }
  return [...found].sort((a,b)=>a.localeCompare(b,'ar'));
 }
 async function requestName(name){
  const result=await rpc('citl_faculty_links','request',{instructor:key(name)});
  await root.CITLAuth.loadProfile();
  return result;
 }
 function showStatus(profile){
  if(!profile||profile.account_type!=='faculty')return;
  let host=document.getElementById('faculty-identity-status');
  const needs=profile.faculty_verification_status!=='approved';
  if(!needs){host?.remove();return;}
  if(!host){
   host=document.createElement('section');host.id='faculty-identity-status';host.className='mx-4 my-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm';
   host.setAttribute('aria-live','polite');
   const main=document.querySelector('main')||document.querySelector('header')?.parentElement||document.body;
   const header=main.querySelector(':scope > header');if(header)header.after(host);else main.prepend(host);
  }
  host.replaceChildren();
  const text=document.createElement('p');text.className='font-bold text-[#2A3475]';
  text.textContent=profile.faculty_verification_status==='pending'?pendingText:profile.faculty_verification_status==='rejected'?'لم تعتمد الإدارة طلب ربط الاسم. حسابك متاح، ويمكنك اختيار اسمك الصحيح وإرسال طلب جديد.':'اختر اسمك من الجدول الحالي لإرسال طلب اعتماد الربط إلى الإدارة.';
  const action=document.createElement('button');action.type='button';action.className=buttonClass+' mt-2';action.textContent=profile.faculty_verification_status==='pending'?'متابعة طلب الربط':'طلب ربط الاسم';
  action.addEventListener('click',()=>renderClaimEditor(host).catch(error=>root.showNotification?.(error.message,'error')));
  host.append(text,action);
 }
 async function renderClaimEditor(host){
  let editor=host.querySelector('[data-claim-editor]');if(editor){editor.remove();return;}
  editor=document.createElement('div');editor.dataset.claimEditor='';editor.className='mt-3 space-y-2';editor.textContent='جاري تحميل طلبك وأسماء الجدول…';host.append(editor);
  try{
   const [mine,available]=await Promise.all([rpc('citl_faculty_links','mine'),names()]);
   editor.replaceChildren();
   const latest=mine.requests[0],status=document.createElement('p');
   status.textContent=latest?`الاسم المطلوب: ${latest.instructor_name} — ${({pending:'بانتظار الاعتماد',approved:'معتمد',rejected:'مرفوض',cancelled:'مستبدل بطلب آخر'})[latest.status]}`:'لا يوجد طلب سابق.';
   const label=document.createElement('label');label.textContent='الاسم الأكاديمي من الجدول الحالي';label.className='block text-xs font-bold';
   const select=document.createElement('select');select.className=fieldClass;select.required=true;select.setAttribute('aria-label','الاسم الأكاديمي من الجدول الحالي');
   select.add(new Option('اختر اسمك…',''));available.forEach(n=>select.add(new Option(n,n)));
   if(latest&&available.includes(latest.instructor_name))select.value=latest.instructor_name;
   const save=document.createElement('button');save.type='button';save.className=buttonClass;save.textContent=latest?.status==='pending'?'تعديل طلب الربط':'إرسال طلب الاعتماد';save.disabled=!available.length;
   const notice=document.createElement('p');notice.className='text-xs';notice.setAttribute('role','status');
   save.onclick=async()=>{if(!select.value)return select.reportValidity();save.disabled=true;notice.textContent='جاري إرسال الطلب…';try{const result=await requestName(select.value);notice.textContent=result.already_approved?'الاسم معتمد لحسابك بالفعل.':pendingText;root.showNotification?.(notice.textContent,'success');}catch(error){notice.textContent=error.message;}finally{save.disabled=false;}};
   label.append(select);editor.append(status,label,save,notice);
   if(!available.length)notice.textContent='لا توجد أسماء في الجدول الحالي؛ حسابك متاح ويمكنك العودة بعد رفع الجدول.';
  }catch(error){editor.textContent=error.message;}
 }
 function adminShell(){
  const tab=document.getElementById('admin-users-tab');if(!tab||!root.CITLPermissions.full(root.currentUser))return null;
  let host=document.getElementById('faculty-admin');
  if(!host){
   host=document.createElement('section');host.id='faculty-admin';host.className='citl-identity-admin';
   host.innerHTML='<div data-code-host class="citl-admin-section"></div><section class="citl-admin-section"><div class="citl-admin-section-head"><div><h3><i class="fas fa-user-check" aria-hidden="true"></i> طلبات ربط أعضاء هيئة التدريس</h3><p>مراجعة الحساب والاسم الأكاديمي قبل اعتماد الربط.</p></div><button type="button" data-refresh class="'+buttonClass+'">تحديث</button></div><div data-claims class="citl-claims-list" aria-busy="true">'+skeleton()+'</div><p data-status role="status" class="text-xs px-4 my-2"></p></section>';
   host.querySelector('[data-code-host]').innerHTML='<div class="p-4"><h3>تغيير كود التسجيل</h3>'+skeleton()+'</div>';
   tab.append(host);host.querySelector('[data-refresh]').onclick=loadAdmin;
  }
  return host;
 }
 function skeleton(){return '<div class="citl-admin-placeholder" role="status" aria-label="جاري تحميل طلبات الربط"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div>';}
 async function loadAdmin(){
  const tab=document.getElementById('admin-users-tab');if(!tab||adminBusy)return;
  if(!root.CITLPermissions.full(root.currentUser))return;
  adminBusy=true;
  const host=adminShell(),list=host.querySelector('[data-claims]');
  list.setAttribute('aria-busy','true');host.querySelector('[data-refresh]').disabled=true;
  host.querySelector('[data-status]').textContent='';
  try{
   const [claims,codes]=await Promise.all([rpc('citl_faculty_links','list'),rpc('citl_registration_codes','list')]);
   list.replaceChildren();
   if(!claims.requests.length)list.innerHTML='<div class="citl-admin-empty"><i class="fas fa-check-circle" aria-hidden="true"></i><span>لا توجد طلبات بانتظار الاعتماد.</span></div>';
   claims.requests.forEach(item=>{
    const card=document.createElement('article');card.className='p-3 border border-gray-100 rounded-lg';
    card.innerHTML=`<strong>${e(item.account_name)}</strong><span class="block text-xs" dir="ltr">${e(item.account_email)}</span><p class="text-sm my-1">الاسم الأكاديمي: <b>${e(item.instructor_name)}</b></p><p class="text-xs text-gray-500">القسم: ${e(departmentLabel(item.department_key))} · ${e(new Date(item.created_at).toLocaleString('ar-EG'))}</p><div class="flex gap-2 mt-2"><button type="button" data-review="approve" class="${buttonClass}">اعتماد الربط</button><button type="button" data-review="reject" class="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-700">رفض الطلب</button></div>`;
    card.querySelectorAll('[data-review]').forEach(button=>button.onclick=async()=>{
     const confirmFn=root.showConfirmDialog||root.showCustomConfirm|| (async message=>confirm(message));
     if(!await confirmFn(button.dataset.review==='approve'?`اعتماد ربط حساب «${item.account_name}» بالاسم «${item.instructor_name}»؟`:'رفض طلب الربط مع الاحتفاظ بحساب المستخدم؟'))return;
     card.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{await rpc('citl_faculty_links',button.dataset.review,{id:item.id});await loadAdmin();}
     catch(error){host.querySelector('[data-status]').textContent=error.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}
    });list.append(card);
   });
   if(!host.querySelector('[data-code-host] form')){
   const form=document.createElement('form');form.className='p-4 citl-code-form';
   form.innerHTML=`<h4 class="font-bold text-[#2A3475] text-sm">تغيير كود التسجيل</h4><p class="text-xs text-gray-500">يتوقف الكود السابق فور الحفظ. تظل الصلاحيات وحدود الاستخدام والصلاحية كما هي.</p><label class="block text-xs font-bold">الكود المراد تغييره<select name="code-id" class="${fieldClass}" required aria-label="الكود المراد تغييره"></select></label><label class="block text-xs font-bold">الكود الجديد<input name="new-code" type="password" autocomplete="new-password" minlength="8" maxlength="128" required class="${fieldClass}"></label><label class="block text-xs font-bold">تأكيد الكود الجديد<input name="confirm-code" type="password" autocomplete="new-password" required class="${fieldClass}"></label><button type="submit" class="${buttonClass}">حفظ الكود الجديد</button><p role="status" data-code-status class="text-xs"></p>`;
   codes.codes.forEach(c=>form.elements['code-id'].add(new Option(`#${c.id} · ${c.account_type==='faculty'?'أعضاء هيئة التدريس':c.role==='manager'?'إدارة':'تسجيل'} · ${c.is_active?'مفعّل':'متوقف'} · استخدام ${c.uses_count}/${c.max_uses??'بلا حد'}`,c.id)));
   form.querySelector('button').disabled=!codes.codes.length;
   form.onsubmit=async event=>{event.preventDefault();const status=form.querySelector('[data-code-status]'),button=form.querySelector('button');const raw=form.elements['new-code'].value;
    if(raw!==form.elements['confirm-code'].value){status.textContent='الكود وتأكيده غير متطابقين';return;}
    button.disabled=true;status.textContent='جاري حفظ الكود…';
    try{await rpc('citl_registration_codes','rotate',{id:form.elements['code-id'].value,code:raw});form.elements['new-code'].value='';form.elements['confirm-code'].value='';status.textContent='تم تغيير الكود. استخدم الكود الجديد للتسجيل.';}
    catch(error){status.textContent=error.message;}finally{button.disabled=false;}
   };host.querySelector('[data-code-host]').replaceChildren(form);
   }
  }catch(error){host.querySelector('[data-status]').textContent=error.message+' — اضغط تحديث لإعادة المحاولة.';}
  finally{adminBusy=false;list.setAttribute('aria-busy','false');host.querySelector('[data-refresh]').disabled=false;}
 }
 root.CITLFaculty=Object.freeze({key,names,requestName,showStatus,renderClaimEditor,pendingText});
 root.CITLFacultyAdmin=Object.freeze({load:loadAdmin,mount:adminShell});
 root.addEventListener('citl-profile-loaded',event=>showStatus(event.detail));
 if(root.currentUser)showStatus(root.currentUser);
 adminShell();
})(window);
