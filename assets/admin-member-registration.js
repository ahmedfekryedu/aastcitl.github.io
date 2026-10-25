(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const depts=[['dean','مكتب العميد'],['transport-logistics','قسم إدارة لوجستيات النقل'],['trade-logistics','قسم إدارة لوجستيات التجارة الدولية'],['supply-chain','قسم إدارة لوجستيات سلاسل الإمداد'],['energy-logistics','قسم إدارة لوجستيات الطاقة والبترول'],['admin-followup','قسم المتابعة الإدارية'],['training-agency','وكالة شؤون التدريب وخدمة المجتمع'],['postgrad-agency','وكالة الدراسات العليا والبحث العلمي'],['education-agency','وكالة شؤون التعليم'],['students-agency','وكالة شؤون الطلاب'],['assistants-office','مكتب المعيدين'],['computer-lab','معمل الحاسب (IT)'],['visitor','زائر خارجي']];
 const allowed=()=>root.CITLPermissions?.can(root.currentUser,'can_manage_users')&&root.CITLPermissions?.can(root.currentUser,'can_review_registrations');
 function open(){
  if(!allowed()){root.showNotification?.('تتطلب الإضافة المباشرة إدارة المستخدمين واعتماد التسجيلات','error');return;}
  if(document.getElementById('citl-admin-member'))return;
  const d=document.createElement('dialog');d.id='citl-admin-member';d.dir='rtl';d.className='citl-correction-dialog';d.setAttribute('aria-label','إضافة عضو واعتماده');
  d.innerHTML='<header><strong>إضافة عضو واعتماده</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div data-content><form class="citl-correction-form"><p>نفس بيانات التسجيل، بدون كود تسجيل. سيعتمد الحساب ويرتبط بجدوله فور إنشائه من الإدارة. الصلاحيات الإضافية تُعيّن بعد الإضافة.</p><div class="citl-correction-grid"><label>الاسم الكامل<input name="full_name" required minlength="3" maxlength="150" autocomplete="name"></label><label>رقم الموبايل<input name="mobile" required inputmode="numeric" pattern="[0-9]{11}" maxlength="11" autocomplete="tel" dir="ltr"></label><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="off" dir="ltr"></label><label>المسمى الوظيفي<input name="position" required minlength="2" maxlength="150" placeholder="مثال: معيد، دكتور، منسق تعليمي"></label><label>القسم / الجهة<select name="department" required><option value="">اختر الجهة</option>'+depts.map(([k,v])=>'<option value="'+E(k)+'">'+E(v)+'</option>').join('')+'</select></label><label>نوع التسجيل<select name="account_type" required><option value="">اختر نوع الحساب</option><option value="admin">إداري</option><option value="faculty">عضو هيئة تدريس</option></select></label></div><label data-faculty hidden>الاسم الأكاديمي من جدول الترم الحالي<select name="linked_instructor"><option value="">اختر الاسم الأكاديمي</option></select></label><div class="citl-correction-grid"><label>كلمة المرور<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label>تأكيد كلمة المرور<input name="confirmation" type="password" required autocomplete="new-password"></label></div><p data-status role="status"></p><div class="citl-correction-actions"><button type="submit">إضافة واعتماد العضو</button></div></form></div>';
  document.body.append(d);d.showModal();const f=d.querySelector('form'),status=f.querySelector('[data-status]'),submit=f.querySelector('[type=submit]');let busy=false,namesReady=false;
  root.CITLRegistrationValidation.bind(f);
  d.querySelector('[data-close]').onclick=()=>{if(!busy)d.close();};d.oncancel=e=>{if(busy)e.preventDefault();};d.onclose=()=>{f.reset();d.remove();};
  f.elements.mobile.oninput=()=>{f.elements.mobile.value=f.elements.mobile.value.replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c));};
  f.elements.account_type.onchange=async()=>{
   const faculty=f.elements.account_type.value==='faculty';f.querySelector('[data-faculty]').hidden=!faculty;f.elements.linked_instructor.required=faculty;
   if(!faculty){status.textContent='';submit.disabled=busy;return;}
   if(namesReady)return;submit.disabled=true;status.textContent='جاري تحميل الأسماء غير المسجلة من الجدول…';
   try{const names=await root.CITLRequests.rpc(root.sb,'citl_faculty_registration_names',{});if(!d.isConnected)return;f.elements.linked_instructor.replaceChildren(new Option('اختر الاسم الأكاديمي',''));names.forEach(n=>f.elements.linked_instructor.add(new Option(n,n)));namesReady=true;status.textContent=names.length?'':'لا توجد أسماء متاحة للتسجيل في الجدول الحالي.';}
   catch(e){status.textContent=e.message+' — اختر نوع التسجيل مرة أخرى لإعادة التحميل.';}
   finally{submit.disabled=busy||(f.elements.account_type.value==='faculty'&&!namesReady);}
  };
  f.onsubmit=async e=>{e.preventDefault();if(busy||!f.reportValidity())return;
   if(f.elements.password.value!==f.elements.confirmation.value){status.textContent='كلمة المرور وتأكيدها غير متطابقين';return;}
   if(new TextEncoder().encode(f.elements.password.value).length>72){status.textContent='كلمة المرور لا تتجاوز 72 بايت';return;}
   busy=true;submit.disabled=true;status.textContent='جاري إنشاء الحساب واعتماده…';const data={};for(const k of ['full_name','mobile','email','position','department','account_type','linked_instructor'])data[k]=f.elements[k].value.trim();
   try{
    const prepared=await root.CITLRequests.rpc(root.sb,'citl_prepare_manager_registration',{p_details:data});
    // Raw request intentionally avoids auth.signUp(), which could replace the administrator session.
    const response=await fetch(root.PRESENCE_SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json',apikey:root.PRESENCE_SUPABASE_ANON_KEY},body:JSON.stringify({email:data.email,password:f.elements.password.value,data:{registration_ticket:prepared.ticket}}),signal:AbortSignal.timeout(25000)});
    const result=await response.json();const user=result.user||result;
    if(!response.ok||!user.id||user.identities?.length===0)throw Error(result.msg||result.message||result.error_description||'البريد مستخدم أو تعذر إنشاء الحساب');
    f.elements.password.value='';f.elements.confirmation.value='';d.querySelector('[data-content]').innerHTML='<div class="citl-correction-success" role="status">تم إنشاء العضو واعتماد حسابه وربطه بالبيانات المختارة. يمكنك تعيين صلاحياته من إدارة المستخدمين.</div>';await root.updateAdminUsersList?.();
   }catch(error){status.textContent=error.message+' — حدّث قائمة المستخدمين للتأكد من النتيجة قبل تكرار الإنشاء.';}
   finally{busy=false;if(submit.isConnected)submit.disabled=false;}
  };
 }
 document.addEventListener('click',e=>{if(e.target.closest?.('#add-user-btn')){e.preventDefault();e.stopImmediatePropagation();open();}},true);
 root.openAddUserModal=open;root.CITLAdminMember=Object.freeze({open});
})(window);
