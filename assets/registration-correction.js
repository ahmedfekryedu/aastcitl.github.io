(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=(action,payload={})=>root.CITLRequests.rpc(root.sb,'citl_registration_correction',{p_action:action,p_payload:payload});
 function dialog(title){
  const d=document.createElement('dialog');d.className='citl-correction-dialog';d.setAttribute('aria-label',title);
  d.innerHTML='<header><strong>'+E(title)+'</strong><button type="button" aria-label="إغلاق" data-close>×</button></header><div data-content></div>';
  document.body.append(d);const previous=document.activeElement;
  d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('click',event=>{if(event.target===d){const b=d.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)d.close();}});
  d.addEventListener('close',()=>{d.remove();previous?.focus();},{once:true});d.showModal();return d;
 }
 function rejectionReason(options={}){return new Promise(resolve=>{
  const d=dialog(options.title||'رفض الطلب وإعادته للتصحيح');let reason=null;
  d.querySelector('[data-content]').innerHTML='<form class="citl-correction-form"><p>'+E(options.description||'سيظهر السبب لصاحب الحساب. يستطيع تصحيح بياناته وإعادة الطلب، ويظل الدخول لخدمات النظام متوقفًا لحين الاعتماد.')+'</p><label>سبب الإجراء<textarea name="reason" required minlength="3" maxlength="2000" rows="4" placeholder="وضح البيانات المطلوب تصحيحها…"></textarea></label><div class="citl-correction-actions"><button type="submit">'+E(options.confirmText||'رفض وإرسال السبب')+'</button><button type="button" data-cancel>رجوع</button></div></form>';
  const f=d.querySelector('form');f.querySelector('[data-cancel]').onclick=()=>d.close();f.onsubmit=event=>{event.preventDefault();const field=f.elements.reason;if(field.value.trim().length<3){field.setCustomValidity('اكتب سببًا واضحًا من ثلاثة أحرف على الأقل');field.reportValidity();return;}reason=field.value.trim();d.close();};
  f.elements.reason.oninput=()=>f.elements.reason.setCustomValidity('');d.addEventListener('close',()=>resolve(reason),{once:true});f.elements.reason.focus();
 });}
 async function editor(host,profileId,onSaved){
  host.innerHTML='<div class="citl-correction-loading" role="status" aria-label="جاري تحميل بيانات التصحيح"><span></span><span></span><span></span></div>';
  try{
   const data=await api('get',profileId?{profile_id:profileId}:{}),p=data.profile,r=data.request;
   const self=!profileId||profileId===root.currentUser?.id,directApproval=!self&&root.CITLPermissions?.full(root.currentUser);let faculty=['faculty','visiting_lecturer'].includes(p.account_type);
   const available=(faculty||directApproval)?await root.CITLFaculty.names():[];
   host.innerHTML='<form class="citl-correction-form"><div class="citl-correction-reason"><strong>سبب الرفض</strong><p data-reason></p></div><p>تصحيح بيانات '+(faculty?'عضو هيئة التدريس':'الحساب الإداري')+(directApproval?' واعتماد الحساب بعد حفظها.':' وإرسالها للمراجعة، دون إنشاء حساب جديد أو اعتماد تلقائي.')+'</p><div class="citl-correction-grid"><label>الاسم الكامل<input name="full_name" required minlength="3" maxlength="150" autocomplete="name"></label><label>المسمى الوظيفي<input name="position" required minlength="2" maxlength="150" autocomplete="organization-title"></label><label>رقم الموبايل<input name="mobile" required inputmode="numeric" pattern="[0-9٠-٩۰-۹]{11}" maxlength="11" autocomplete="tel"></label><label>بريد تسجيل الدخول<input name="email" type="email" required dir="ltr" autocomplete="email" '+(self||directApproval?'':'readonly')+'></label></div>'+(self?'<div class="citl-correction-email"><button type="button" data-email>طلب تأكيد البريد الجديد</button><p>لتغيير البريد: اكتب البريد الصحيح واضغط طلب التأكيد. أكمل التأكيد المطلوب على البريد الجديد والحالي حسب إعدادات الأمان، ثم أرسل الطلب للمراجعة. إذا لم تتمكن من الوصول للبريد القديم، تواصل مع الإدارة لتصحيحه من لوحة التحكم بعد التحقق من هويتك.</p><p data-email-status role="status"></p></div>':directApproval?'<p>كمدير كامل الصلاحيات، يمكنك تصحيح بيانات الدخول واعتماد الحساب مباشرة. اترك كلمة المرور فارغة للاحتفاظ بالحالية.</p>':'<p>بريد الدخول يصححه صاحب الحساب من صفحة التصحيح مع تأكيد البريد؛ لا يتغير عبر تعديل بياناته هنا.</p>')+((faculty||directApproval)?'<label data-academic>الاسم الأكاديمي من الجدول الحالي<select name="instructor" required><option value="">اختر الاسم الصحيح</option></select></label>':'')+'<div class="citl-correction-actions"><button type="submit">حفظ التصحيح وإعادة الطلب للمراجعة</button></div><p data-result role="status"></p></form>';
   const form=host.querySelector('form'),status=form.querySelector('[data-result]'),submit=form.querySelector('[type=submit]');
   if(directApproval){
    const area=document.createElement('div');area.className='citl-correction-grid';area.innerHTML='<label>نوع التسجيل<select name="account_type"><option value="user">إداري</option><option value="faculty">عضو هيئة تدريس</option></select></label><label>القسم / الجهة<select name="department" required></select></label><label>كلمة مرور جديدة (اختياري)<input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label><label>تأكيد كلمة المرور<input name="password_confirmation" type="password" autocomplete="new-password"></label>';
    form.querySelector('.citl-correction-actions').before(area);
    if(p.account_type==='visiting_lecturer')area.querySelector('[name=account_type]').add(new Option('عضو هيئة تدريس / منتدب','visiting_lecturer'));
    form.elements.account_type.value=faculty?p.account_type:'user';
    const deptKeys=['dean','transport-logistics','trade-logistics','supply-chain','energy-logistics','admin-followup','training-agency','postgrad-agency','education-agency','students-agency','assistants-office','computer-lab'];if(p.department&&!deptKeys.includes(p.department))deptKeys.push(p.department);
    deptKeys.forEach(k=>form.elements.department.add(new Option((typeof departments!=='undefined'?departments[k]?.name:null)||k,k)));form.elements.department.value=p.department;
    submit.textContent='حفظ التصحيح واعتماد الحساب فورًا';
    form.elements.account_type.onchange=()=>{faculty=form.elements.account_type.value!=='user';form.querySelector('[data-academic]').hidden=!faculty;form.elements.instructor.required=faculty;submit.disabled=faculty&&!available.length;};
   }
   form.querySelector('[data-reason]').textContent=r.rejection_reason||'لم يُسجل سبب رفض لهذا الطلب. راجع البيانات المطلوبة.';
   for(const name of ['full_name','position','mobile','email'])form.elements[name].value=p[name]||'';
   if(faculty||directApproval){available.forEach(n=>form.elements.instructor.add(new Option(n,n)));form.elements.instructor.value=available.includes(r.instructor_name)?r.instructor_name:'';if(faculty&&!available.length){status.textContent='لا توجد أسماء في الجدول الحالي. انتظر رفع الجدول أو راجع الإدارة.';submit.disabled=true;}}
   if(directApproval)form.elements.account_type.onchange();
   if(self)form.querySelector('[data-email]').onclick=async()=>{
    const field=form.elements.email,button=form.querySelector('[data-email]'),notice=form.querySelector('[data-email-status]');
    if(!field.reportValidity())return;const email=field.value.trim();if(email.toLowerCase()===String(p.email).toLowerCase()){notice.textContent='اكتب البريد الجديد أولًا، أو اترك البريد الحالي وأرسل التصحيح.';return;}
    button.disabled=true;submit.disabled=true;notice.textContent='جاري طلب تأكيد تغيير البريد…';
    try{const result=await root.sb.auth.updateUser({email},{emailRedirectTo:location.origin+'/account/'});if(result.error)throw result.error;notice.textContent='تم إرسال طلب تغيير البريد. أكمل التأكيد من رسائل Supabase ثم أرسل التصحيح. لن يتغير اعتماد حسابك بمجرد تأكيد البريد.';}
    catch(error){notice.textContent='تعذر طلب تغيير البريد: '+error.message;}finally{button.disabled=false;submit.disabled=faculty&&!available.length;}
   };
   let attempt=null;
   form.onsubmit=async event=>{event.preventDefault();if(submit.disabled||!form.reportValidity())return;
    const payload={profile_id:p.id,request_id:r.id,instructor:faculty?form.elements.instructor.value:''};
    for(const name of ['full_name','position','mobile','email'])payload[name]=form.elements[name].value.trim();
    if(directApproval){payload.account_type=form.elements.account_type.value;payload.department=form.elements.department.value;const password=form.elements.password.value;if(password!==form.elements.password_confirmation.value){status.textContent='كلمة المرور وتأكيدها غير متطابقين';return;}if(password)payload.password=password;const signature=JSON.stringify(payload);if(attempt&&attempt!==signature){status.textContent='أعد فتح التصحيح للتحقق من نتيجة المحاولة السابقة قبل تغيير بياناتها.';return;}attempt=signature;}
    form.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=directApproval?'جاري تصحيح بيانات الدخول واعتماد الحساب…':'جاري حفظ التصحيح وإعادة الطلب…';
    try{
     if(directApproval){await root.CITLAuth.session();const response=await root.sb.functions.invoke('citl-account-correction',{body:payload});if(response.error){let message=response.error.message;try{const detail=await response.error.context?.json();message=detail?.message||message;}catch(_){}throw new Error(message);}if(!response.data?.ok)throw new Error(response.data?.message||'تعذر تأكيد الاعتماد');}
     else await api('resubmit',payload);
     host.innerHTML='<div class="citl-correction-success" role="status">'+(directApproval?'تم تصحيح الحساب واعتماده وإرسال إشعار الاعتماد. يمكن للعضو الدخول ببياناته الصحيحة.':'تم حفظ التصحيح وإرسال الطلب للمراجعة. يظل الحساب بانتظار الاعتماد.')+'</div>';if(self)await root.CITLAuth.loadProfile();await onSaved?.();
    }
    catch(error){status.textContent=error.message;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
   };
  }catch(error){host.replaceChildren();const p=document.createElement('p');p.className='citl-correction-error';p.textContent=error.message;host.append(p);}
 }
 async function mount(parent,suffix='structure'){
  if(!parent)return;const id='citl-rejected-corrections-'+suffix;
  let section=document.getElementById(id);if(section?.dataset.loading==='true')return;
  if(!section){section=document.createElement('section');section.id=id;section.className='citl-admin-section citl-rejected-corrections';parent.append(section);}
  section.dataset.loading='true';section.innerHTML='<div class="citl-admin-section-head"><div><h3>حسابات مرفوضة للتصحيح</h3><p>تظهر هنا للتصحيح فقط؛ لا تدخل في الأسماء المعتمدة أو مسؤولي الأقسام.</p></div><button type="button" data-refresh class="citl-ac-button">تحديث</button></div><div data-list class="citl-correction-list"><div class="citl-correction-loading"><span></span><span></span></div></div>';
  section.querySelector('[data-refresh]').onclick=()=>mount(parent,suffix);
  const list=section.querySelector('[data-list]');
  try{const data=await api('list');list.replaceChildren();
   if(!data.accounts.length){list.innerHTML='<div class="citl-admin-empty">لا توجد حسابات مرفوضة تحتاج إلى تصحيح ضمن صلاحياتك.</div>';}
   for(const p of data.accounts){const card=document.createElement('article');card.className='citl-correction-person';card.innerHTML='<div><strong>'+E(p.full_name||p.email)+'</strong><small dir="ltr">'+E(p.email)+'</small><span>'+(['faculty','visiting_lecturer'].includes(p.account_type)?'عضو هيئة تدريس':'حساب إداري')+'</span><p>'+E(p.rejection_reason||'طلب قديم بدون سبب مسجل')+'</p></div><button type="button" class="citl-ac-button">تصحيح وإعادة للمراجعة</button>';
    if(root.CITLPermissions?.full(root.currentUser))card.querySelector('button').textContent='تصحيح واعتماد الحساب';card.querySelector('button').onclick=()=>{const d=dialog('تصحيح بيانات الحساب');editor(d.querySelector('[data-content]'),p.id,async()=>{await mount(parent,suffix);await root.CITLOversight?.loadApprovals();await root.updateAdminUsersList?.();});};list.append(card);}
  }catch(error){list.textContent=error.message;}finally{section.dataset.loading='false';}
 }
 function openAdmin(profileId){const d=dialog(root.CITLPermissions?.full(root.currentUser)?'تصحيح بيانات العضو واعتماد الحساب':'تصحيح بيانات الحساب المرفوض');editor(d.querySelector('[data-content]'),profileId,async()=>{await root.CITLOversight?.loadApprovals();await root.updateAdminUsersList?.();root.checkUserNotifications?.();});}
 root.CITLRegistrationCorrection=Object.freeze({rejectionReason,editor,mount,openAdmin});
})(window);
