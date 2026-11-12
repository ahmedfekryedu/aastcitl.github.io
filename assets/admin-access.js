(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=k=>root.CITLDepartmentHeads?.label(k)||k;
 const flags=[['can_approve_registrations','اعتماد ربط أعضاء الجهة'],['can_review_academic','تنفيذ ومراجعة إجراءات أعضاء الجهة والطباعة'],['can_view_visitors','متابعة المنتدبين المختارين يدويًا']];
 const general=root.CITLPermissions.catalog;
 const skeleton=()=>'<div class="citl-admin-placeholder" role="status"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';
 async function rpc(name,args){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,name,args);}
 function dialog(title){const d=document.createElement('dialog');d.className='citl-head-dialog citl-ac-dialog';d.dir='rtl';d.innerHTML='<header><strong>'+E(title)+'</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body">'+skeleton()+'</div>';d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};document.body.append(d);d.showModal();return d;}
 async function openPermissions(id){
  if(!root.CITLPermissions.full(root.currentUser))return;
  const d=dialog('صلاحيات الحساب'),body=d.querySelector('.citl-ac-body');d.id='citl-account-permissions';
  try{const data=await root.CITLDepartmentHeads.rpc('list');if(!d.isConnected)return;const person=data.profiles.find(p=>p.id===id);if(!person)throw Error('الحساب غير موجود أو لم تُعتمد هويته بعد');const heads=data.heads.filter(h=>h.profile_id===id);
   body.innerHTML='<h3>'+E(person.full_name||person.email)+'</h3><p class="citl-ac-muted">صلاحيات الحساب العامة لا تُعيّنه رئيس قسم. إدارة رؤساء الجهات من الهيكل الأكاديمي فقط.</p><form><fieldset class="citl-head-rights"><legend>مستوى الوصول</legend><label><input type="checkbox" data-full> مدير كامل الصلاحيات — تحديد الجميع</label><p class="citl-ac-muted">يشمل كل لوحات الإدارة، الأقسام، الإجراءات والتقارير، المستخدمين، الجداول والحجوزات والإعلانات والإعدادات.</p></fieldset><fieldset class="citl-head-rights citl-module-rights"><legend>اختر مهام الحساب</legend>'+general.map(([k,t])=>'<label><input type="checkbox" name="'+k+'"> <span><b>'+E(t)+'</b><small style="display:block;font-weight:400;font-size:12px;line-height:1.8;color:#64748b;margin-top:4px">'+E(root.CITLPermissions.descriptions[k]||'')+'</small></span></label>').join('')+'</fieldset><p data-level class="citl-ac-muted"></p><section class="citl-head-permission-summary"><strong>تعيينات الجهات المستقلة</strong><p>'+E(heads.length?heads.map(h=>label(h.department_key)+': '+flags.filter(([k])=>h[k]).map(([,v])=>v).join('، ')).join(' · '):'لا يوجد تعيين لرئاسة جهة. المدير الكامل لا يحتاج تعيينًا للاطلاع على الكلية.')+'</p></section><button class="citl-ac-button" type="submit">حفظ الصلاحيات</button><p data-status role="status"></p></form>';
   const form=body.querySelector('form'),full=form.querySelector('[data-full]');let saving=false;const expected={role:person.role,permissions:person.permissions};
   full.checked=root.CITLPermissions.full(person);general.forEach(([k])=>form.elements[k].checked=full.checked||person.permissions?.[k]===true);
   const status=()=>{form.querySelector('[data-level]').textContent=full.checked?'المستوى: مدير كامل الصلاحيات':general.some(([k])=>form.elements[k].checked)?'المستوى: صلاحيات محددة فقط':'المستوى: عضو — تعيينات الجهات محفوظة إن وجدت';};status();
   full.onchange=()=>{general.forEach(([k])=>form.elements[k].checked=full.checked);status();};general.forEach(([k])=>form.elements[k].onchange=()=>{full.checked=general.every(([key])=>form.elements[key].checked);status();});
   form.onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;const save=form.querySelector('[type=submit]'),msg=form.querySelector('[data-status]');save.disabled=true;const rights=Object.fromEntries(general.map(([k])=>[k,form.elements[k].checked]));try{await rpc('citl_account_permissions',{p_target:id,p_mode:full.checked?'full':Object.values(rights).some(Boolean)?'custom':'member',p_permissions:rights,p_expected:expected});d.close();root.showNotification?.('تم تحديث صلاحيات الحساب؛ تعيينات الجهات محفوظة','success');await root.updateAdminUsersList?.();if(id===root.currentUser?.id){await root.CITLAuth.loadProfile();root.applyUserPermissions?.();}root.checkUserNotifications?.();}catch(error){msg.textContent=error.message;}finally{saving=false;save.disabled=false;}};
  }catch(error){body.textContent=error.message;}
 }
 async function openHeads(person){
  if(!root.CITLPermissions.can(root.currentUser,'can_manage_structure'))return;
  if(person.source!=='structure'){location.href='/dashboard/?open=structure';return;}
  const d=dialog('تعيين مسؤول قسم أو أكثر'),body=d.querySelector('.citl-ac-body');d.id='citl-head-dialog';
  try{const data=await root.CITLDepartmentHeads.rpc('list');if(!d.isConnected)return;
   const depts=Object.entries(typeof departments!=='undefined'?departments:{}).filter(([k])=>k!=='visitor');
   body.innerHTML='<h3>'+E(person.full_name||person.email)+'</h3><p class="citl-ac-muted">اختر جهة أو أكثر وحدد صلاحيات كل جهة. الجهات غير المحددة تظل كما هي. لتغيير المسؤول الحالي سيظهر اسمه قبل الحفظ. إلغاء التعيين بالكامل من زر «إلغاء التعيين» في الهيكل.</p><form><div class="citl-head-selections">'+depts.map(([key,value])=>{const h=data.heads.find(x=>x.department_key===key);return '<section class="citl-head-selection" data-department="'+E(key)+'"><label><input type="checkbox" data-selected '+(key===person.department?'checked':'')+'> <b>'+E(value.name||key)+'</b></label><p class="citl-ac-muted">'+E(h?'المسؤول الحالي: '+(h.full_name||h.email):'بدون مسؤول حالي')+'</p><fieldset class="citl-head-rights" '+(key===person.department?'':'hidden')+'><legend>صلاحيات الجهة</legend>'+flags.map(([k,t])=>'<label><input type="checkbox" name="'+k+'" '+((h?h[k]:k!=='can_approve_registrations')?'checked':'')+'><span><b>'+E(t)+'</b><small style="display:block;font-weight:400;font-size:12px;line-height:1.8;color:#64748b;margin-top:4px">'+E(root.CITLPermissions.descriptions[k]||'')+'</small></span></label>').join('')+'</fieldset></section>';}).join('')+'</div><button class="citl-ac-button" type="submit">حفظ الجهات المختارة</button><p data-status role="status"></p></form>';
   const form=body.querySelector('form');form.querySelectorAll('[data-selected]').forEach(input=>{const section=input.closest('section');const update=()=>{section.querySelector('fieldset').hidden=!input.checked;section.classList.toggle('selected',input.checked);};input.onchange=update;update();});let saving=false;
   form.onsubmit=async e=>{e.preventDefault();if(saving)return;const msg=form.querySelector('[data-status]'),button=form.querySelector('[type=submit]');const selected=[...form.querySelectorAll('[data-selected]:checked')].map(input=>{const section=input.closest('section'),key=section.dataset.department,h=data.heads.find(x=>x.department_key===key);return {department_key:key,expected:h?[h.profile_id,h.assigned_at,...flags.map(([k])=>h[k])]:null,...Object.fromEntries(flags.map(([k])=>[k,section.querySelector('[name='+k+']').checked]))};});if(!selected.length){msg.textContent='اختر جهة واحدة على الأقل.';return;}
    const replacements=selected.filter(x=>data.heads.some(h=>h.department_key===x.department_key&&h.profile_id!==person.id));
    if(replacements.length){const signature=JSON.stringify(selected);let confirmBox=form.querySelector('[data-replace-confirm]');if(!confirmBox||confirmBox.dataset.signature!==signature){confirmBox?.remove();confirmBox=document.createElement('label');confirmBox.className='citl-head-replace';confirmBox.dataset.replaceConfirm='';confirmBox.dataset.signature=signature;confirmBox.innerHTML='<input type="checkbox"> أؤكد استبدال المسؤول الحالي في: '+E(replacements.map(x=>label(x.department_key)).join('، '));button.before(confirmBox);msg.textContent='راجع الجهات وأكّد استبدال مسؤولها، ثم اضغط حفظ.';return;}if(!confirmBox.querySelector('input').checked){msg.textContent='أكد تغيير المسؤول قبل الحفظ.';return;}}
    saving=true;button.disabled=true;try{const result=await rpc('citl_assign_department_heads',{p_profile:person.id,p_assignments:selected});d.close();root.showNotification?.(result.message,'success');await root.updateAdminUsersList?.();await root.loadFacultyDirectoryTab?.();}catch(error){msg.textContent=error.message;button.disabled=false;}finally{saving=false;}
   };
  }catch(error){body.textContent=error.message;}
 }
 let page=0,historySerial=0,historyItems=[],historyMore=false,historyTotal=0,historyBusy=false;
 const strings=values=>[...new Set(values.flat().filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))];
 function eventDepartments(n){const p=n.payload||{},v=p.event||{};return strings([p.department_key,p.department,v.department_key,v.department,p.department_keys||[],p.departments||[]]);}
 function eventPeople(n){const p=n.payload||{},v=p.event||{};return strings([p.instructor,p.instructor_name,p.full_name,p.actor_name,p.requester_name,p.teacher_name,p.replacement_instructor,p.replacement_name,v.instructor,v.instructor_name,v.full_name,v.actor_name,v.requester_name]);}
 function mountHistory(modal,sample){
  if(document.getElementById('admin-activity-history-tab'))return;
  const tab=sample.cloneNode(true);tab.dataset.tab='activity-history';tab.removeAttribute('onclick');tab.classList.remove('active');tab.querySelector('span').textContent='سجل الإشعارات والأحداث';tab.querySelector('i').className='fas fa-history';tab.onclick=()=>root.switchAdminTab('activity-history');sample.after(tab);
  const panel=document.createElement('section');panel.id='admin-activity-history-tab';panel.className='admin-tab-content hidden';
  panel.innerHTML='<section class="citl-admin-section"><div class="citl-admin-section-head"><div><h3>سجل الإشعارات والأحداث</h3><p>الإشعارات الموجهة لحسابك فقط، حسب صلاحياتك. تصفية الشخص تتعلق بالاسم المذكور في الإشعار ولا تفتح سجل حساب آخر.</p></div><button type="button" class="citl-ac-button" data-refresh>تحديث السجل</button></div><div class="citl-ac-work-body"><div class="citl-history-filters"><label>القسم<select data-history-department><option value="">كل الأقسام في السجل المحمّل</option></select></label><label>الشخص المذكور<select data-history-person><option value="">كل الأسماء في السجل المحمّل</option></select></label><label>حالة القراءة<select data-history-read><option value="">الكل</option><option value="unread">غير مقروء</option><option value="read">تمت القراءة</option></select></label><label>البحث بالاسم أو نص الإشعار<input type="search" data-history-search placeholder="اكتب الاسم أو المادة أو القاعة"></label></div><div class="citl-history-summary"><p data-summary role="status"></p><button type="button" class="citl-ac-button secondary" data-clear>مسح التصفية</button></div><div data-events>'+skeleton()+'</div><div class="citl-history-more"><button type="button" class="citl-ac-button secondary" data-next>تحميل إشعارات أقدم</button><small>التصفية تشمل الإشعارات المحمّلة. حمّل الأقدم لتوسيع البحث؛ لا يُعتبر فتح السجل قراءة.</small></div><p data-status role="alert"></p></div></section>';
  modal.querySelector('.admin-tab-content').parentElement.append(panel);
  panel.querySelector('[data-refresh]').onclick=()=>loadHistory();
  panel.querySelector('[data-next]').onclick=()=>loadHistory(true);
  panel.querySelector('[data-clear]').onclick=()=>{panel.querySelectorAll('.citl-history-filters input,.citl-history-filters select').forEach(i=>i.value='');renderHistory();};
  panel.querySelectorAll('.citl-history-filters select').forEach(i=>i.onchange=renderHistory);panel.querySelector('[data-history-search]').oninput=renderHistory;
 }
 function historyOptions(panel){
  for(const [key,items,title]of [['department',strings(historyItems.flatMap(eventDepartments)),'كل الأقسام في السجل المحمّل'],['person',strings(historyItems.flatMap(eventPeople)),'كل الأسماء في السجل المحمّل']]){
   const select=panel.querySelector('[data-history-'+key+']'),selected=select.value;
   select.replaceChildren(new Option(title,''),...items.sort((a,b)=>a.localeCompare(b,'ar')).map(v=>new Option(key==='department'?label(v):v,v)),new Option(key==='department'?'إشعارات بلا قسم محدد':'إشعارات بلا اسم محدد','__unspecified__'));
   if([...select.options].some(o=>o.value===selected))select.value=selected;
  }
 }
 function renderHistory(){
  const panel=document.getElementById('admin-activity-history-tab');if(!panel)return;
  const rows=panel.querySelector('[data-events]'),msg=panel.querySelector('[data-status]'),dept=panel.querySelector('[data-history-department]').value,person=panel.querySelector('[data-history-person]').value,read=panel.querySelector('[data-history-read]').value,q=panel.querySelector('[data-history-search]').value.trim().toLocaleLowerCase();
  const include=(values,filter)=>!filter||(filter==='__unspecified__'?values.length===0:values.includes(filter));
  const shown=historyItems.filter(n=>include(eventDepartments(n),dept)&&include(eventPeople(n),person)&&(!read||(read==='read'?!!n.read_at:!n.read_at))&&(!q||[n.title,n.body,...eventPeople(n),...eventDepartments(n).map(label)].join(' ').toLocaleLowerCase().includes(q)));
  const data={notifications:historyItems};
  panel.querySelector('[data-summary]').textContent='يظهر '+shown.length+' من '+historyItems.length+' إشعارًا محمّلًا'+(Number.isFinite(historyTotal)?' · إجمالي السجل المتاح '+historyTotal:'')+(historyMore?' · توجد إشعارات أقدم':' · اكتمل تحميل السجل');
  rows.innerHTML=shown.map(n=>{const body=(n.body||'').replaceAll('مدير كامل الصلاحيات','المدير'),ds=eventDepartments(n),people=eventPeople(n),stamp=new Date(n.created_at);return '<article class="citl-event-card '+(!n.read_at?'citl-event-unread ':'')+(n.kind==='admin_announcement'?'citl-administrative-notice':'')+'"><header><span class="citl-event-symbol" aria-hidden="true">'+(n.read_at?'✓':'●')+'</span><strong>'+E(n.title||'إشعار')+'</strong><span class="citl-event-read">'+(n.read_at?'تمت القراءة':'غير مقروء')+'</span></header><div class="citl-event-meta"><span>'+E(ds.length?ds.map(label).join('، '):'بلا قسم محدد')+'</span><time>'+E(Number.isNaN(stamp.getTime())?'التاريخ غير متاح':stamp.toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}))+'</time></div>'+(people.length?'<small>'+E(people.join(' · '))+'</small>':'')+'<p>'+E(body.length>220?body.slice(0,220)+'…':body)+'</p>'+(body.length>220?'<details><summary>عرض النص كاملًا</summary><p>'+E(body)+'</p></details>':'')+'<footer class="citl-ac-buttons"><button type="button" class="citl-ac-button" data-event="'+E(n.id)+'">فتح التفاصيل</button>'+(root.CITLPermissions.full(root.currentUser)?'<button type="button" class="citl-ac-button danger" data-delete-event="'+E(n.id)+'">حذف من سجلي</button>':'')+'</footer></article>';}).join('')||'<div class="citl-admin-empty">'+(historyItems.length?'لا توجد نتائج تطابق التصفية في السجل المحمّل. يمكنك مسح التصفية أو تحميل الأقدم.':'لا توجد إشعارات محفوظة لهذا الحساب.')+'</div>';
   rows.querySelectorAll('[data-delete-event]').forEach(button=>button.onclick=async()=>{
    if(button.disabled||!root.CITLPermissions.full(root.currentUser))return;
    button.disabled=true;msg.textContent='';let removed=false;
    try{
     const text='حذف هذا الإشعار من سجل حسابك والجرس؟ سجلات الإجراءات وقراءات الإعلانات محفوظة.';
     const ok=root.showConfirmDialog?await root.showConfirmDialog(text,{title:'حذف الإشعار',confirmText:'حذف الإشعار'}):confirm(text);
     if(!ok)return;
     await rpc('citl_remove_own_notification',{p_id:button.dataset.deleteEvent,p_confirm:true});removed=true;
     page=0;await loadHistory();await root.checkUserNotifications?.();
     root.showNotification?.('تم حذف الإشعار من سجل حسابك.','success');
    }catch(error){msg.textContent=removed?'تم الحذف؛ تعذر تحديث العرض، اضغط تحديث.':error.message||'تعذر حذف الإشعار.';}
    finally{button.disabled=false;}
   });
   rows.querySelectorAll('[data-event]').forEach(b=>b.onclick=async()=>{const n=data.notifications.find(x=>x.id===b.dataset.event);if(n.kind==='admin_announcement'){await root.CITLAnnouncements.open(n.payload.announcement_id,false,n.payload.revision);return;}b.disabled=true;try{await rpc('citl_secure_api',{p_action:'notifications.read',p_payload:{ids:[n.id]}});await root.checkUserNotifications?.();if(root.CITLOversight?.openRegistrationNotice(n)){b.disabled=false;return;}if(await root.CITLOpenSpecialNotice?.(n)){b.disabled=false;return;}if(n.entity_type==='meetings'&&root.CITLMeetingUI){await root.CITLMeetingUI.open(n.entity_id,true);b.disabled=false;return;}if(n.route&&/^\/[a-z0-9_/?=&.-]*$/i.test(n.route)&&!n.route.includes('open=activity'))location.href=n.route;else await loadHistory();}catch(error){msg.textContent=error.message;b.disabled=false;}});
  panel.querySelector('[data-next]').disabled=historyBusy||!historyMore||historyItems.length>=5000;
 }
 async function loadHistory(append=false){
  const panel=document.getElementById('admin-activity-history-tab');if(!panel||historyBusy)return;
  const serial=++historySerial,target=append?page+1:0,rows=panel.querySelector('[data-events]'),msg=panel.querySelector('[data-status]');historyBusy=true;
  rows.setAttribute('aria-busy','true');msg.textContent='';panel.querySelector('[data-refresh]').disabled=true;panel.querySelector('[data-next]').disabled=true;
  try{
   const data=await rpc('citl_notifications_view',{p_mode:'history',p_page:target});if(serial!==historySerial)return;
   const map=new Map((append?historyItems:[]).map(n=>[n.id,n]));for(const n of data.notifications||[])map.set(n.id,n);
   historyItems=[...map.values()];page=target;historyMore=data.has_more===true;historyTotal=Number(data.total);historyOptions(panel);renderHistory();
   if(historyItems.length>=5000&&historyMore)msg.textContent='تم بلوغ حد العرض الآمن (5000 إشعار). السجل الأقدم محفوظ؛ لم يُحذف شيء.';
  }catch(error){if(serial===historySerial){if(!historyItems.length)rows.innerHTML='<div class="citl-admin-empty">تعذر تحميل السجل.</div>';msg.textContent=error.message||'تعذر تحميل السجل. أعد المحاولة.';}}
  finally{if(serial===historySerial){historyBusy=false;panel.querySelector('[data-refresh]').disabled=false;panel.querySelector('[data-next]').disabled=!historyMore||historyItems.length>=5000;rows.setAttribute('aria-busy','false');}}
 }
 async function openHistory(){if(root.CITLControlPage?.navigate('activity-history'))return;if(!root.openAdminPanel){location.href='/dashboard/?open=activity';return;}root.openAdminPanel();await root.CITLOversight.mountAdmin();root.switchAdminTab('activity-history');}
 root.CITLAdminAccess=Object.freeze({openPermissions,openHeads,mountHistory,loadHistory,openHistory});root.openPermissionsModal=openPermissions;
 const historyProfileKey=p=>JSON.stringify([p?.id,p?.role,p?.permissions,p?.department,p?.faculty_verification_status]);
 let historyProfile=historyProfileKey(root.currentUser);
 root.addEventListener('citl-profile-loaded',()=>{
  const next=historyProfileKey(root.currentUser);if(next===historyProfile)return;historyProfile=next;
  page=0;historySerial++;historyItems=[];historyMore=false;historyTotal=0;historyBusy=false;const panel=document.getElementById('admin-activity-history-tab');panel?.querySelector('[data-events]')?.replaceChildren();if(panel){panel.querySelectorAll('.citl-history-filters input,.citl-history-filters select').forEach(i=>i.value='');historyOptions(panel);panel.querySelector('[data-summary]').textContent='';}
  if(panel&&!panel.classList.contains('hidden'))loadHistory();
 });
})(window);
