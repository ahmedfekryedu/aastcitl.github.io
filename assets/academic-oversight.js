/* Scoped academic oversight. All decisions and visibility are revalidated by server RPCs. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=k=>root.CITLDepartmentHeads?.label(k)||k||'غير محدد';
 const types={cancel:'إلغاء محاضرة',replace:'إحلال محاضر',move_room:'تغيير قاعة',replace_and_move:'إحلال وتغيير قاعة'};
 const btn='citl-ac-button';
 const skeleton=()=>'<div class="citl-admin-placeholder" role="status" aria-label="جاري التحميل"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span><span class="citl-skeleton-line short"></span></div>';
 const stamp=v=>v?new Date(v).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'—';
 async function rpc(name,args={}){await root.CITLAuth.session();return root.CITLRequests.rpc(root.sb,name,args);}
 const op=(name,action,payload={})=>rpc(name,{p_action:action,p_payload:payload});
 let access=null,accessUser='',accessPending=null,appliedAccessKey='',approvalSerial=0,structureSerial=0,dashboardSerial=0;
 function reviewLabel(r){if(!r||r.decision==='unassigned')return 'لم يُعيّن مسؤول للمراجعة';if(r.decision==='approved')return 'تمت القراءة واعتماد المراجعة';if(r.decision==='not_approved')return 'تمت القراءة — لم تُعتمد المراجعة';return r.read_at?'قرأها رئيس الجهة — بانتظار قراره':'لم يقرأها رئيس الجهة بعد';}
 function reviewBadge(r){const state=['approved','not_approved','pending','unassigned'].includes(r?.decision)?r.decision:'unassigned';const icon={approved:'fa-check-circle',not_approved:'fa-times-circle',pending:'fa-clock',unassigned:'fa-user-clock'}[state];return '<span class="citl-review-badge '+state+'"><i class="fas '+icon+'" aria-hidden="true"></i>'+E(reviewLabel(r))+'</span>';}
 async function loadAccess(){
  if(accessPending)return accessPending;
  accessPending=rpc('citl_oversight_access').then(data=>{access=data;accessUser=root.currentUser?.id||'';return data;}).finally(()=>{accessPending=null;});return accessPending;
 }
 function makeDialog(title){
  const d=document.createElement('dialog');d.className='citl-head-dialog citl-ac-dialog';d.dir='rtl';
  d.innerHTML='<header><strong>'+E(title)+'</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body"></div>';
  d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};
  document.body.append(d);d.showModal();return d;
 }
 async function mountAdmin(){
  if(!root.currentUser)return;
  const modal=document.getElementById('admin-panel-modal'),sample=modal?.querySelector('.admin-tab[data-tab="profile"]');if(!sample)return;
  let tab=modal.querySelector('[data-tab="academic-review"]');
  if(!tab){
   tab=sample.cloneNode(true);tab.dataset.tab='academic-review';tab.removeAttribute('onclick');tab.classList.remove('active');tab.querySelector('span').textContent='طلبات اعتماد الأعضاء';tab.querySelector('i').className='fas fa-user-check';tab.style.display='none';sample.after(tab);tab.onclick=()=>root.switchAdminTab('academic-review');
   const panel=document.createElement('section');panel.id='admin-academic-review-tab';panel.className='admin-tab-content hidden';panel.innerHTML='<section class="citl-admin-section"><div class="citl-admin-section-head"><div><h3>طلبات اعتماد الأعضاء</h3><p>طلبات الجهات المصرّح لك بمراجعتها فقط.</p></div><button type="button" data-refresh class="'+btn+'">تحديث</button></div><div data-claims class="citl-claims-list">'+skeleton()+'</div><p data-status class="citl-ac-status" role="status"></p></section>';modal.querySelector('.admin-tab-content').parentElement.append(panel);panel.querySelector('[data-refresh]').onclick=loadApprovals;
  }
  root.CITLFacultyAdmin?.mountCodes(modal,sample);mountWorkboard(modal,sample);root.CITLAdminAccess?.mountHistory(modal,sample);
  try{const a=await loadAccess();const key=JSON.stringify([root.currentUser?.id,root.currentUser?.role,root.currentUser?.permissions,root.currentUser?.faculty_verification_status,a]);
   // Applying permissions refreshes the dashboard/profile; unchanged access must not restart that cycle.
   if(key!==appliedAccessKey){appliedAccessKey=key;root.applyUserPermissions?.();}tab.style.display=a.registration?'flex':'none';
   modal.querySelector('[data-tab="academic-actions"]').style.display=canAcademicActions()?'flex':'none';if(!a.registration){document.getElementById('admin-academic-review-tab').querySelector('[data-claims]').replaceChildren();}}
  catch(_){tab.style.display='none';}
 }
 const work={term:null,department:'',status:'',search:'',action:null,data:null,serial:0,initialized:false};
 function canAcademicActions(){return accessUser===root.currentUser?.id&&!root.CITLAuth.facultyPending?.(root.currentUser)&&!!(access?.full||root.CITLPermissions.can(root.currentUser,'can_view_reports')||root.CITLPermissions.can(root.currentUser,'can_monitor_academic_reviews')||access?.heads?.some(h=>h.can_review_academic)||root.currentUser?.faculty_verification_status==='approved');}
 function mountWorkboard(modal,sample){
  if(document.getElementById('admin-academic-actions-tab'))return;
  const tab=sample.cloneNode(true);tab.dataset.tab='academic-actions';tab.removeAttribute('onclick');tab.classList.remove('active');tab.querySelector('span').textContent='متابعة إجراءات المحاضرات';tab.querySelector('i').className='fas fa-tasks';tab.style.display='none';sample.after(tab);tab.onclick=()=>root.switchAdminTab('academic-actions');
  const panel=document.createElement('section');panel.id='admin-academic-actions-tab';panel.className='admin-tab-content hidden';
  panel.innerHTML='<section class="citl-admin-section"><div class="citl-admin-section-head"><div><h3>متابعة إجراءات المحاضرات</h3><p>مسار القراءة والقرار لكل إجراء. الإجراء ينفذ فورًا، والاعتماد يوثّق المراجعة.</p></div><button type="button" data-refresh class="'+btn+'">تحديث</button></div><div class="citl-ac-work-body"><div class="citl-ac-toolbar"><label>الترم الحالي<select data-term disabled></select></label><label>القسم أو الوكالة<select data-department></select></label><label>حالة المراجعة<select data-state><option value="">كل الحالات</option><option value="pending">معلّقة</option><option value="approved">معتمدة</option><option value="not_approved">غير معتمدة</option><option value="unassigned">بلا مسؤول مراجعة</option></select></label><label>بحث<input data-search placeholder="العضو أو المادة"></label></div><div data-counts class="citl-ac-counts"></div><div data-rows>'+skeleton()+'</div><p data-status role="status"></p><section id="citl-ac-work-detail" class="citl-ac-work-detail" hidden></section></div></section>';
  modal.querySelector('.admin-tab-content').parentElement.append(panel);panel.querySelector('[data-refresh]').onclick=loadWorkboard;
  for(const [selector,key,event]of [['[data-department]','department','onchange'],['[data-state]','status','onchange'],['[data-search]','search','oninput']])panel.querySelector(selector)[event]=e=>{work[key]=e.target.value;work.action=null;drawWorkboard();};
 }
 function drawWorkboard(){
  const panel=document.getElementById('admin-academic-actions-tab');if(!panel||!work.data)return;
  const rows=work.data.rows.filter(x=>(!work.department||x.department===work.department)&&(!work.search||[x.instructor,x.course,x.actor].join(' ').toLowerCase().includes(work.search.toLowerCase())));
  const state=x=>x.review?.decision||'unassigned';
  panel.querySelector('[data-counts]').innerHTML=[['pending','معلّقة'],['approved','معتمدة'],['not_approved','غير معتمدة'],['unassigned','بلا مسؤول']].map(([k,t])=>'<span>'+t+' <b>'+rows.filter(x=>state(x)===k).length+'</b></span>').join('');
  const shown=rows.filter(x=>!work.status||state(x)===work.status);
  panel.querySelector('[data-rows]').innerHTML=shown.length?'<div class="citl-ac-table-wrap"><table class="citl-ac-table"><thead><tr><th>المحاضرة / الإجراء</th><th>العضو / الجهة</th><th>حالة المراجعة</th><th>تاريخ القرار</th><th></th></tr></thead><tbody>'+shown.map(x=>'<tr><td><b>'+E(x.course)+'</b><small>'+E(x.date)+' · '+E(types[x.action_type])+'</small><small>بواسطة '+E(x.actor||'—')+'</small></td><td>'+E(x.instructor)+'<small>'+E(label(x.department))+'</small></td><td>'+reviewBadge(x.review)+'<small>'+E(x.review?.head||'')+'</small></td><td>'+E(stamp(x.review?.decision_at))+'</td><td><button type="button" class="'+btn+' secondary" data-open-action="'+E(x.id)+'">المسار والتفاصيل</button></td></tr>').join('')+'</tbody></table></div>':'<div class="citl-admin-empty">لا توجد إجراءات مطابقة للاختيارات الحالية.</div>';
  panel.querySelectorAll('[data-open-action]').forEach(b=>b.onclick=()=>{if(work.action===b.dataset.openAction){collapseAction();return;}work.action=b.dataset.openAction;openAction(work.data.rows.find(x=>String(x.id)===String(work.action)),loadWorkboard);});
  const detail=panel.querySelector('#citl-ac-work-detail');detail.hidden=!work.action;if(!work.action){detail.dataset.action='';detail.replaceChildren();}
 }
 async function loadWorkboard(){
  const panel=document.getElementById('admin-academic-actions-tab');if(!panel)return;
  const serial=++work.serial,rows=panel.querySelector('[data-rows]'),status=panel.querySelector('[data-status]');
  rows.innerHTML=skeleton();rows.setAttribute('aria-busy','true');panel.querySelector('[data-refresh]').disabled=true;status.textContent='';panel.querySelector('#citl-ac-work-detail').hidden=true;
  try{const data=await rpc('citl_current_academic_actions');if(serial!==work.serial)return;if(!data.allowed)throw Error('هذه المتابعة غير متاحة لحسابك.');work.data=data;work.term=data.term?.id||null;
   if(!work.initialized){work.initialized=true;work.status=data.scope==='personal'?'':'pending';}
   panel.querySelector('[data-term]').innerHTML=data.term?'<option value="'+E(data.term.id)+'">'+E(data.term.name)+' · حالي</option>':'<option value="">لا يوجد ترم دراسي حالي</option>';panel.querySelector('[data-term]').value=work.term||'';
   const departments=[...new Set([...(access?.full?['dean','transport-logistics','trade-logistics','supply-chain','energy-logistics','admin-followup','training-agency','postgrad-agency','education-agency','students-agency','assistants-office','computer-lab']:[]),...data.rows.map(x=>x.department),...(access?.heads||[]).filter(h=>h.can_review_academic).map(h=>h.department_key)])].filter(Boolean).sort();
   panel.querySelector('[data-department]').innerHTML='<option value="">كل الجهات المتاحة</option>'+departments.map(k=>'<option value="'+E(k)+'">'+E(label(k))+'</option>').join('');if(!departments.includes(work.department))work.department='';
   const target=data.rows.find(x=>String(x.id)===String(work.action));if(target){work.department='';work.status='';work.search='';}else if(work.action){status.textContent='الإجراء غير موجود في هذا الترم أو خارج نطاق صلاحياتك.';work.action=null;}
   panel.querySelector('[data-department]').value=work.department;panel.querySelector('[data-state]').value=work.status;panel.querySelector('[data-search]').value=work.search;drawWorkboard();if(target)await openAction(target,loadWorkboard);return true;
  }catch(error){if(serial===work.serial){work.data=null;rows.innerHTML='<div class="citl-admin-empty">تعذر تحميل الإجراءات. يمكنك إعادة المحاولة.</div>';panel.querySelector('[data-counts]').replaceChildren();status.textContent=error.message;}return false;}
  finally{if(serial===work.serial){rows.setAttribute('aria-busy','false');panel.querySelector('[data-refresh]').disabled=false;}}
 }
 async function openWorkboard(options={}){
  if(root.CITLControlPage?.navigate('academic-actions',options))return;
  if(!root.openAdminPanel){location.href='/dashboard/?'+new URLSearchParams({open:'academic',...(options.action?{action:options.action}:{}),...(options.term?{term:options.term}:{})});return;}
  if(options.term!==undefined)work.term=options.term;if(options.action!==undefined)work.action=options.action;
  if(!root.currentUser)await root.CITLAuth.loadProfile();
  await loadAccess();await mountAdmin();
  if(canAcademicActions()){root.openAdminPanel('academic-actions');return await loadWorkboard();}else {root.showNotification?.('لا تملك صلاحية الوصول لهذه المتابعة','error');return false;}
 }
 let requestedApproval=null;
 async function openApprovals(options={}){
  if(root.CITLControlPage?.navigate('academic-review',options))return;
  requestedApproval=options.request||new URLSearchParams(location.search).get('request');
  if(!root.openAdminPanel){location.href='/dashboard/?open=approvals';return;}
  if(!root.currentUser)await root.CITLAuth.loadProfile();
  const verified=await loadAccess();await mountAdmin();if(accessUser===root.currentUser?.id&&verified.registration){root.openAdminPanel('academic-review');return await loadApprovals();}else {root.showNotification?.('لا تملك صلاحية اعتماد طلبات الأعضاء','error');return false;}
 }
 // Completed notices describe a decision; they must not open the pending-approval action.
 // The item is supplied by the recipient-scoped notification RPC, not an account lookup.
 function openRegistrationNotice(item){
  if(item?.kind!=='faculty_registration'||!['approved','rejected'].includes(item.payload?.status))return false;
  document.getElementById('notif-menu')?.classList.add('hidden');
  document.getElementById('citl-registration-decision')?.close();
  const d=makeDialog(item.title||'نتيجة اعتماد الحساب');d.id='citl-registration-decision';
  const status=item.payload.status==='approved'?'تم الاعتماد':'لم يتم الاعتماد';
  d.querySelector('.citl-ac-body').innerHTML='<article class="citl-faculty-claim"><div class="citl-claim-person"><span class="citl-claim-avatar"><i class="fas fa-user-check" aria-hidden="true"></i></span><strong>'+E(status)+'</strong></div><p>'+E(item.body||'')+'</p><dl class="citl-claim-details"><div><dt>القسم / الجهة</dt><dd>'+E(label(item.payload.department_key)||'—')+'</dd></div><div><dt>تاريخ الإشعار</dt><dd>'+E(stamp(item.created_at))+'</dd></div></dl><p class="citl-ac-muted">هذا إشعار بنتيجة المراجعة في التاريخ الموضح، ولا يتطلب اعتمادًا جديدًا.</p></article>';
  return true;
 }
 async function loadApprovals(){
  const panel=document.getElementById('admin-academic-review-tab');if(!panel)return;root.CITLRegistrationReview?.load(panel);root.CITLRegistrationCorrection?.mount(panel,'approvals');
  const serial=++approvalSerial,list=panel.querySelector('[data-claims]'),status=panel.querySelector('[data-status]'),refresh=panel.querySelector('[data-refresh]');list.innerHTML=skeleton();list.setAttribute('aria-busy','true');refresh.disabled=true;status.textContent='';
  try{
   const data=await op('citl_faculty_links','list');if(serial!==approvalSerial)return;list.replaceChildren();
   if(!data.requests.length)list.innerHTML='<div class="citl-admin-empty"><i class="fas fa-check-circle" aria-hidden="true"></i><span>لا توجد طلبات بانتظار الاعتماد.</span></div>';
   for(const item of data.requests){
    const administrative=item.request_kind==='administrative';
    const card=document.createElement('article');card.className='citl-faculty-claim';card.dataset.claimId=item.id;
    card.innerHTML='<div class="citl-claim-person"><span class="citl-claim-avatar"><i class="fas fa-user-graduate" aria-hidden="true"></i></span><div><strong>'+E(item.account_name||'عضو هيئة تدريس')+'</strong><span class="citl-claim-email" dir="ltr">'+E(item.account_email)+'</span></div><span class="citl-claim-badge">'+(administrative?'تسجيل إداري':'تسجيل عضو هيئة تدريس')+' · بانتظار الاعتماد</span></div><dl class="citl-claim-details"><div><dt>نوع التسجيل / الاسم الأكاديمي</dt><dd dir="auto">'+E(administrative?'حساب إداري':item.instructor_name)+'</dd></div><div><dt>القسم أو الوكالة</dt><dd>'+E(label(item.department_key))+'</dd></div><div><dt>تاريخ الطلب</dt><dd>'+E(stamp(item.created_at))+'</dd></div></dl><div class="citl-claim-actions"><button type="button" data-decision="approve" class="citl-claim-approve">اعتماد الربط</button><button type="button" data-decision="reject" class="citl-claim-reject">رفض الطلب</button></div><p data-card-status role="status"></p>';
    if(administrative)card.querySelector('[data-decision=approve]').textContent='اعتماد الحساب الإداري';
    if(root.CITLPermissions.full(root.currentUser)){const correct=document.createElement('button');correct.type='button';correct.className='citl-claim-approve';correct.textContent='تصحيح واعتماد';correct.onclick=()=>root.CITLRegistrationCorrection.openAdmin(item.profile_id);card.querySelector('.citl-claim-actions').append(correct);}
    for(const button of card.querySelectorAll('[data-decision]'))button.onclick=async()=>{
     const approve=button.dataset.decision==='approve',message=administrative?(approve?'اعتماد تسجيل الحساب الإداري؟':'رفض تسجيل الحساب الإداري مع الاحتفاظ به؟'):approve?'اعتماد ربط الحساب بالاسم الأكاديمي المحدد؟':'رفض طلب الربط مع الاحتفاظ بالحساب؟';
     const reason=approve?null:await root.CITLRegistrationCorrection.rejectionReason();
     const confirmed=!approve?Boolean(reason):root.showConfirmDialog?await root.showConfirmDialog(message,{title:approve?'اعتماد ربط الهوية':'رفض طلب الربط',confirmText:approve?'اعتماد الربط':'رفض الطلب',icon:approve?'fa-user-check':'fa-user-times',color:approve?'bg-[#2A3475]':'bg-red-600'}):confirm(message);if(!confirmed)return;
     card.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{await op('citl_faculty_links',button.dataset.decision,{id:item.id,...(!approve?{reason}:{})});root.showNotification?.(approve?(administrative?'تم اعتماد الحساب الإداري':'تم اعتماد ربط الحساب بعضو هيئة التدريس'):'تم رفض الطلب مع الاحتفاظ بالحساب');await loadApprovals();root.CITLFacultyAdmin?.load();root.checkUserNotifications?.();}
     catch(error){card.querySelector('[data-card-status]').textContent=error.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}
    };list.append(card);
    if(root.CITLPermissions.full(root.currentUser)&&!administrative){
     root.CITLRequests.rpc(root.sb,'citl_duplicate_registration',{p_action:'inspect',p_request:item.id}).then(info=>{
      if(!card.isConnected||!info?.duplicate)return;
      const warning=document.createElement('p');warning.className='citl-ac-muted';warning.textContent='الاسم مرتبط بالفعل بحساب معتمد: '+info.owner_name+'. اختر الطلب الذي سيبقى؛ لا يُنقل الربط تلقائيًا.';
      card.querySelector('.citl-claim-details').after(warning);
      const approveButton=card.querySelector('[data-decision=approve]');approveButton.disabled=true;approveButton.title='الاسم مملوك لحساب معتمد؛ راجع الحسابين قبل الاعتماد';
      const remove=document.createElement('button');remove.type='button';remove.className='citl-claim-reject';remove.textContent='رفض نهائي وحذف الحساب المكرر';
      remove.onclick=async()=>{
       if(remove.disabled)return;
       const ok=await root.showConfirmDialog?.('سيُحذف الحساب المكرر وطلبه نهائيًا. سيظل الحساب المعتمد وصاحب الاسم كما هو.',{title:'حذف حساب مكرر',confirmText:'حذف الحساب المكرر',icon:'fa-trash',color:'bg-red-600'});
       if(!ok)return;remove.disabled=true;
       try{await root.CITLRequests.rpc(root.sb,'citl_duplicate_registration',{p_action:'delete',p_request:item.id});root.showNotification?.('تم حذف الحساب المكرر وطلبه نهائيًا','success');await loadApprovals();}
       catch(error){card.querySelector('[data-card-status]').textContent=error.message;remove.disabled=false;}
      };
      card.querySelector('.citl-claim-actions').append(remove);
     }).catch(()=>{});
    }
   }
   const request=requestedApproval||new URLSearchParams(location.search).get('request');if(request){const card=[...list.children].find(c=>c.dataset.claimId===request);if(card){card.classList.add('citl-ac-highlight');card.scrollIntoView({block:'center'});}else status.textContent='قد يكون الطلب المشار إليه تمت مراجعته بالفعل، أو لم يعد ضمن صلاحياتك.';}
   return true;
  }catch(error){if(serial===approvalSerial){list.innerHTML='<div class="citl-admin-empty">تعذر تحميل الطلبات.</div>';status.textContent=error.message;}return false;}
  finally{if(serial===approvalSerial){refresh.disabled=false;list.setAttribute('aria-busy','false');}}
 }
 async function renderStructure(department,entries){
  const tab=document.getElementById('admin-directory-tab');if(!tab||!root.CITLPermissions.can(root.currentUser,'can_manage_structure'))return;
  let host=document.getElementById('citl-ac-structure');if(!host){host=document.createElement('section');host.id='citl-ac-structure';host.className='citl-admin-section';const chooser=document.getElementById('faculty-directory-active-department')?.closest('.native-select-shell')?.parentElement?.parentElement?.parentElement;if(chooser?.parentElement===tab)chooser.after(host);else tab.prepend(host);}
  const serial=++structureSerial;host.innerHTML='<div class="citl-admin-section-head"><div><h3>مسؤولو الأقسام والوكالات</h3><p>اختر مسؤول الجهة مرة واحدة؛ أعضاؤها المعتمدون يتبعونه تلقائيًا في إجراءات المحاضرات.</p></div></div>'+skeleton();
  try{
   const data=await root.CITLDepartmentHeads.rpc('list');if(serial!==structureSerial)return;
   root.CITLFacultyAdmin?.mountManualLink(tab,data.profiles);
   root.CITLRegistrationCorrection?.mount(tab,'structure');
   if(!department){root.CITLRegistrationReview?.department(host,'');host.innerHTML='<div class="citl-admin-section-head"><div><h3>مسؤول القسم أو الجهة</h3><p>اختر القسم من القائمة بالأعلى لعرض مسؤوله وتعديل مهام المتابعة والاعتماد.</p></div></div>';return;}
   const head=data.heads.find(h=>h.department_key===department),profile=data.profiles.find(p=>p.id===head?.profile_id);
   host.innerHTML='<div class="citl-admin-section-head"><div><h3><i class="fas fa-sitemap" aria-hidden="true"></i> رئاسة '+E(label(department))+'</h3><p>تعيين مسؤول الجهة وتحديد مهام المتابعة والاعتماد.</p></div><span class="citl-structure-state '+(head?'assigned':'')+'">'+(head?'مسؤول معيّن':'بانتظار التعيين')+'</span></div><div class="citl-ac-structure-body"><div class="citl-structure-current"><span class="citl-structure-avatar"><i class="fas fa-user-tie" aria-hidden="true"></i></span><div><small>المسؤول الحالي</small><strong>'+E(head?(head.full_name||head.email):'لم يُعيّن مسؤول بعد')+'</strong><div data-info class="citl-structure-badges"></div></div></div><div class="citl-structure-editor"><label>الحساب المسؤول<select data-profile><option value="">اختر حسابًا معتمدًا</option>'+data.profiles.map(p=>'<option value="'+E(p.id)+'">'+E((p.full_name||'حساب')+' — '+p.email)+'</option>').join('')+'</select></label><div class="citl-ac-buttons"><button type="button" data-permissions class="'+btn+'"><i class="fas fa-user-cog" aria-hidden="true"></i> '+(head?'تعديل التعيين والصلاحيات':'تعيين المسؤول والصلاحيات')+'</button>'+(head?'<button type="button" data-remove class="'+btn+' secondary">إلغاء التعيين</button>':'')+'</div></div><details><summary>نطاق التعيين وارتباط الأعضاء</summary><p class="citl-ac-muted">أعضاء الجهة المعتمدون يتبعون مسؤولها تلقائيًا في إجراءات المحاضرات، وتظهر له الإجراءات السابقة المعلّقة عند تعيينه. يمكن تعيين الحساب نفسه لأكثر من جهة بصلاحيات مستقلة.</p><p class="citl-ac-muted">صلاحيات الحساب العامة مستقلة عن هذا التعيين. حضور المنتدبين يظل بالقائمة اليدوية في صفحة الجداول.</p></details><p data-status role="status"></p></div>';
   root.CITLRegistrationReview?.department(host,department);
   const select=host.querySelector('[data-profile]');select.value=profile?.id||'';
   const info=host.querySelector('[data-info]');
   const grants=head?['can_approve_registrations','can_review_academic','can_view_visitors'].filter(k=>head[k]).map(k=>({can_approve_registrations:'اعتماد التسجيل',can_review_academic:'تنفيذ ومراجعة إجراءات أعضاء الجهة',can_view_visitors:'متابعة المنتدبين'})[k]):[];
   info.innerHTML=grants.length?grants.map(t=>'<span>'+E(t)+'</span>').join(''):'<small>'+E(head?'لا توجد مهام مفعّلة لهذه الجهة':'اختر الحساب ثم حدد الجهات والصلاحيات.')+'</small>';
   host.querySelector('[data-permissions]').disabled=!department;
   host.querySelector('[data-permissions]').onclick=()=>{const p=data.profiles.find(x=>x.id===select.value);if(p)root.CITLDepartmentHeads.open({...p,department,source:'structure'});else host.querySelector('[data-status]').textContent='اختر الحساب أولًا.';};
   host.querySelector('[data-remove]')?.addEventListener('click',async e=>{
    // currentTarget is cleared after event dispatch; retain it before awaiting confirmation.
    const button=e.currentTarget,status=host.querySelector('[data-status]');
    if(button.disabled)return;
    button.disabled=true;status.textContent='';let removed=false;
    try{
     const ok=root.showConfirmDialog?await root.showConfirmDialog('إلغاء تعيين مسؤول هذه الجهة وصلاحياتها فقط؟',{title:'إلغاء التعيين',confirmText:'إلغاء التعيين'}):confirm('إلغاء التعيين؟');
     if(!ok)return;
     status.textContent='جارٍ إلغاء التعيين…';
     await root.CITLDepartmentHeads.rpc('remove',{department_key:department,profile_id:head.profile_id});removed=true;
     root.showNotification?.('تم إلغاء تعيين مسؤول الجهة؛ صلاحيات الحساب العامة محفوظة.','success');
     await root.loadFacultyDirectoryTab();
     if(root.CITLPermissions.can(root.currentUser,'can_manage_users'))await root.updateAdminUsersList?.();
     await mountAdmin();
     root.checkUserNotifications?.();
    }catch(error){
     const message=removed?'تم إلغاء التعيين، لكن تعذر تحديث العرض؛ حدّث القائمة.':error.message||'تعذر إلغاء التعيين؛ أعد المحاولة.';
     if(status.isConnected)status.textContent=message;
     else root.showNotification?.(message,'error');
    }finally{button.disabled=false;}
   });

  }catch(error){if(serial===structureSerial){host.innerHTML='<div class="citl-admin-empty"></div>';host.firstElementChild.textContent=error.message;}}
 }
 async function renderDashboard(){
  const content=document.getElementById('dh-content');if(!content)return;
  const faculty=document.getElementById('dashboard-home')?.dataset.view==='faculty';
  const grid=faculty?document.getElementById('dh-metrics'):content.querySelector('.dh-summary-grid');if(!grid)return;
  let host=document.getElementById('citl-ac-summary');if(!host){host=document.createElement('article');host.id='citl-ac-summary';}
  host.className=faculty?'dh-metric dh-action-metric':'dh-summary-card dh-action-summary';
  if(host.parentElement!==grid)grid.insertBefore(host,faculty?null:grid.querySelector('.dh-admin-summary'));
  grid.classList.add('dh-with-actions');host.setAttribute('aria-busy','true');
  const context=JSON.stringify([root.currentUser?.id,root.currentUser?.role,root.currentUser?.permissions,root.currentUser?.faculty_verification_status,access,faculty]);
  if(host.dataset.context!==context||!host.children.length){host.dataset.context=context;host.hidden=false;host.innerHTML='<div class="dh-action-loading" role="status" aria-label="جاري تحميل إجراءات المحاضرات"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';}
  const serial=++dashboardSerial;
  try{
   const data=await rpc('citl_current_academic_actions');if(serial!==dashboardSerial||!host.isConnected)return;
   host.hidden=!data.allowed;grid.classList.toggle('dh-with-actions',data.allowed);if(host.hidden)return;
   const scope=({college:'الكلية',department:'الجهات التابعة لك',personal:'محاضراتك'})[data.scope]||'';
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const dailyRows=(data.rows||[]).filter(x=>x.date===today);
   const note=data.term?'اليوم · '+scope:'لا يوجد ترم دراسي حالي';
   const total=E(dailyRows.filter(x=>x.action_type==='cancel').length),link='<button type="button" class="dh-button" data-workboard aria-label="تفاصيل إجراءات المحاضرات في لوحة التحكم">التفاصيل</button>';
   let markup;
   if(faculty){
    markup='<div class="dh-metric-label">ملغاة اليوم</div><div class="dh-metric-value" data-cancel>'+total+'</div>'+link;
    host.title=note;
   }else{
    const metric=(label,value)=>'<div class="dh-metric"><div class="dh-metric-label">'+E(label)+'</div><div class="dh-metric-value">'+E(value)+'</div></div>';
    const rows=dailyRows,replaced=rows.filter(x=>['replace','replace_and_move'].includes(x.action_type)).length,moved=rows.filter(x=>['move_room','replace_and_move'].includes(x.action_type)).length,pending=rows.filter(x=>!x.review||['pending','unassigned'].includes(x.review.decision)).length;
    markup='<div class="dh-summary-head"><h3>إجراءات المحاضرات</h3><div class="dh-metric"><div class="dh-metric-label">ملغاة اليوم</div><div class="dh-metric-value" data-cancel>'+total+'</div></div></div><div class="dh-facts">'+metric('إحلال محاضر',replaced)+metric('تغيير قاعة',moved)+metric('بانتظار المراجعة',pending)+'</div><div class="dh-summary-foot"><span>'+E(note)+'</span>'+link+'</div>';
   }
   if(host._citlMarkup!==markup||!host.querySelector('[data-workboard]')){host.innerHTML=markup;host._citlMarkup=markup;}
   host.querySelector('[data-workboard]').onclick=()=>openWorkboard({action:null});
  }catch(error){
   if(serial===dashboardSerial&&host.isConnected){host.hidden=false;host.innerHTML='<div class="dh-metric-label">تعذر تحديث إجراءات المحاضرات</div><button type="button" class="dh-button" data-retry>إعادة المحاولة</button>';host.title=error.message;host.querySelector('[data-retry]').onclick=renderDashboard;}
  }finally{if(serial===dashboardSerial)host.setAttribute('aria-busy','false');}
 }
 async function openReport(options={}){
  const d=makeDialog('إجراءات المحاضرات — متابعة الترم'),body=d.querySelector('.citl-ac-body');
  let data,selectedTerm=options.term||null,selectedType=options.type||'',search='',serial=0;
  body.innerHTML='<div class="citl-ac-toolbar"><label>الترم<select data-term></select></label><label>نوع الإجراء<select data-type><option value="">كل الإجراءات</option>'+Object.entries(types).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label>بحث<input data-search placeholder="المحاضر أو المادة أو القاعة"></label><button type="button" class="'+btn+' secondary" data-refresh>تحديث</button><button type="button" class="'+btn+'" data-print>طباعة</button></div><p data-scope class="citl-ac-muted"></p><div data-rows>'+skeleton()+'</div><p data-status role="status"></p>';
  const $=s=>body.querySelector(s);$('[data-type]').value=selectedType;
  const filtered=()=>data.rows.filter(x=>(!selectedType||x.action_type===selectedType)&&(!search||[x.instructor,x.course,x.room,x.actor].join(' ').toLowerCase().includes(search.toLowerCase())));
  function draw(){
   const rows=filtered();$('[data-rows]').innerHTML=rows.length?'<div class="citl-ac-table-wrap"><table class="citl-ac-table"><thead><tr><th>التاريخ / المحاضرة</th><th>المحاضر / الجهة</th><th>الإجراء</th><th>مراجعة رئيس الجهة</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr data-action="'+E(x.id)+'"><td><b>'+E(x.date)+'</b><br>'+E(x.course)+'<small>'+E(x.time)+' · '+E(x.room)+'</small></td><td>'+E(x.instructor)+'<small>'+E(label(x.department))+'</small></td><td>'+E(types[x.action_type])+'<small>بواسطة '+E(x.actor||'—')+'</small></td><td>'+reviewBadge(x.review)+'</td><td><button type="button" data-detail="'+E(x.id)+'" class="'+btn+' secondary">تفاصيل</button></td></tr>').join('')+'</tbody></table></div>':'<div class="citl-admin-empty">لا توجد إجراءات في هذا العرض.</div>';
   body.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{d.close();openWorkboard({action:b.dataset.detail,term:selectedTerm});});
  }
  async function load(){const mine=++serial;$('[data-refresh]').disabled=true;$('[data-print]').disabled=true;$('[data-rows]').innerHTML=skeleton();$('[data-status]').textContent='';try{const result=await rpc('citl_academic_report',{p_term_id:selectedTerm});if(mine!==serial||!d.isConnected)return;if(!result.allowed)throw Error('هذا التقرير غير متاح لحسابك');data=result;selectedTerm=data.term?.id||null;$('[data-term]').innerHTML=data.terms.map(t=>'<option value="'+E(t.id)+'">'+E(t.name)+(t.is_active?' · نشط':' · أرشيف')+'</option>').join('');$('[data-term]').value=selectedTerm||'';$('[data-scope]').textContent='الإجراءات تنفذ فورًا. الاعتماد أو عدم الاعتماد يوثّق مراجعة رئيس الجهة فقط.';draw();$('[data-print]').disabled=!data.can_print;
    if(options.action){const target=data.rows.find(x=>x.id===options.action);options.action=null;if(target){d.close();await openWorkboard({action:target.id,term:selectedTerm});}else $('[data-status]').textContent='الإجراء غير موجود في هذا الترم أو خارج نطاق صلاحياتك.';}
   }catch(error){if(mine===serial){$('[data-rows]').replaceChildren();$('[data-status]').textContent=error.message;}}finally{if(mine===serial)$('[data-refresh]').disabled=false;}}
  $('[data-term]').onchange=e=>{selectedTerm=e.target.value||null;load();};$('[data-type]').onchange=e=>{selectedType=e.target.value;if(data)draw();};$('[data-search]').oninput=e=>{search=e.target.value;if(data)draw();};$('[data-refresh]').onclick=load;
  $('[data-print]').onclick=()=>{if(!data)return;const w=open('','_blank');if(!w){$('[data-status]').textContent='اسمح بفتح نافذة الطباعة.';return;}w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير إجراءات المحاضرات</title><link rel="stylesheet" href="'+location.origin+'/assets/academic-oversight.css"></head><body class="citl-ac-print"><h1>CITL Smart System</h1><h2>إجراءات المحاضرات — '+E(data.term?.name||'')+'</h2><table class="citl-ac-table"><thead><tr><th>التاريخ</th><th>المادة والمحاضر</th><th>الإجراء والسبب</th><th>المراجعة</th></tr></thead><tbody>'+filtered().map(x=>'<tr><td>'+E(x.date)+'<br>'+E(x.time)+'</td><td>'+E(x.course)+'<br>'+E(x.instructor)+'<br>'+E(x.room)+'</td><td>'+E(types[x.action_type])+'<br>'+E(x.reason)+'<br>'+E(x.replacement_instructor||'')+' '+E(x.replacement_room||'')+'</td><td>'+reviewBadge(x.review)+'<br>'+E(x.review?.note||'')+'</td></tr>').join('')+'</tbody></table></body></html>');w.document.close();w.addEventListener('load',()=>{w.focus();w.print();},{once:true});};
  await load();
 }
 function collapseAction(){
  work.action=null;const body=document.getElementById('citl-ac-work-detail');if(body){body.hidden=true;body.dataset.action='';body.replaceChildren();}
  document.querySelectorAll('[data-open-action]').forEach(b=>b.setAttribute('aria-expanded','false'));
 }
 async function openAction(item,refresh){
  const body=document.getElementById('citl-ac-work-detail');if(!body)return;body.hidden=false;body.dataset.action=item.id;requestAnimationFrame(()=>{if(body.isConnected&&!body.hidden)body.scrollIntoView({block:'nearest'});});
  body.innerHTML='<dl class="citl-ac-details">'+[['المادة',item.course],['المحاضر',item.instructor],['التاريخ والوقت',item.date+' · '+item.time],['القاعة',item.room],['الإجراء',types[item.action_type]],['بواسطة',item.actor],['السبب',item.reason],['المحاضر البديل',item.replacement_instructor],['القاعة البديلة',item.replacement_room]].filter(x=>x[1]).map(([k,v])=>'<div><dt>'+E(k)+'</dt><dd>'+E(v)+'</dd></div>').join('')+'</dl><p data-review class="citl-ac-review"></p><p class="citl-ac-muted">الإجراء نافذ؛ قرار المراجعة لا يغيّر الجدول.</p><div data-decisions></div><p data-status role="status"></p>';
  const timeline=document.createElement('ol');timeline.className='citl-ac-timeline';body.prepend(timeline);const close=document.createElement('button');close.type='button';close.className='citl-ac-button secondary citl-action-collapse';close.textContent='طيّ التفاصيل −';close.onclick=collapseAction;body.prepend(close);document.querySelectorAll('[data-open-action]').forEach(b=>{b.setAttribute('aria-controls','citl-ac-work-detail');b.setAttribute('aria-expanded',String(b.dataset.openAction===String(item.id)));});
  const status=body.querySelector('[data-status]'),draw=()=>{body.querySelector('[data-review]').innerHTML=reviewBadge(item.review)+(item.review?.head?' <span>'+E(item.review.head)+'</span>':'')+(item.review?.note?' <span>'+E(item.review.note)+'</span>':'');timeline.innerHTML=[['تسجيل الإجراء',item.created_at,item.actor],['قراءة المسؤول',item.review?.read_at,item.review?.head],['قرار المراجعة',item.review?.decision_at,item.review?.decision==='approved'?'معتمد':item.review?.decision==='not_approved'?'غير معتمد':'بانتظار القرار']].map(([name,date,who])=>'<li class="'+(date?'done':'')+'"><strong>'+E(name)+'</strong><span>'+E(date?stamp(date):'لم يتم بعد')+'</span><small>'+E(who||'')+'</small></li>').join('');};draw();
  if(!item.can_review)return;
  try{const result=await op('citl_academic_review','read',{id:item.id,revision:item.revision});if(body.dataset.action!==String(item.id)||body.hidden)return;item.review=result.review;draw();root.checkUserNotifications?.();if(item.review.decision!=='pending')return;
   const controls=body.querySelector('[data-decisions]');controls.innerHTML='<label class="citl-ac-note">ملاحظة المراجعة<textarea maxlength="1000" rows="2" placeholder="السبب مطلوب عند عدم الاعتماد"></textarea></label><div class="citl-ac-buttons"><button class="'+btn+'" data-review-action="approve">اعتماد المراجعة</button><button class="'+btn+' danger" data-review-action="not_approve">عدم الاعتماد</button></div>';
   controls.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const note=controls.querySelector('textarea').value.trim();if(b.dataset.reviewAction==='not_approve'&&!note){status.textContent='اكتب سبب عدم الاعتماد.';return;}controls.querySelectorAll('button').forEach(x=>x.disabled=true);try{await op('citl_academic_review',b.dataset.reviewAction,{id:item.id,revision:item.revision,note});await refresh();renderDashboard();root.checkUserNotifications?.();}catch(error){status.textContent=error.message;controls.querySelectorAll('button').forEach(x=>x.disabled=false);}});
  }catch(error){status.textContent=error.message;}
 }

 let nameSerial=0;
 async function checkScheduleName(){
  const serial=++nameSerial,user=root.currentUser;
  const existing=document.getElementById('citl-ac-name-status');
  if(user?.faculty_verification_status!=='approved'){existing?.remove();return;}
  try{const status=await rpc('citl_faculty_schedule_status');if(serial!==nameSerial||root.currentUser?.id!==user.id)return;
   if(!status.needs_name){existing?.remove();return;}
   let host=existing;if(!host){host=document.createElement('section');host.id='citl-ac-name-status';host.className='citl-ac-summary';host.style.margin='12px 24px';const header=document.querySelector('header');if(!header)return;header.after(host);}
   host.innerHTML='<div><strong>مراجعة الاسم في الجدول الحالي</strong><span>'+(status.pending_request?'طلب ربط الاسم الجديد بانتظار الاعتماد.':'اسمك المرتبط غير موجود حاليًا. حسابك وربطك السابق محفوظان؛ اختر الاسم الموجود في الجدول إذا تغيّرت كتابته.')+'</span></div><button type="button" class="'+btn+'">'+(status.pending_request?'متابعة الطلب':'اختيار الاسم الحالي')+'</button>';
   host.querySelector('button').onclick=async()=>{const d=makeDialog('طلب ربط الاسم الحالي');try{await root.CITLFaculty.renderClaimEditor(d.querySelector('.citl-ac-body'));}catch(error){d.querySelector('.citl-ac-body').textContent=error.message;}};
  }catch(_){/* A network failure is never treated as a missing instructor name. */}
 }

 let reviewCheckAt=0,reviewCheckUser=null,reviewChecking=false;
 async function checkLateReviews(){
  const user=root.currentUser;if(!user||document.hidden||reviewChecking||!root.CITLPermissions.can(user,'can_monitor_academic_reviews'))return;
  if(reviewCheckUser===user.id&&Date.now()-reviewCheckAt<3600000)return;
  reviewChecking=true;try{const result=await rpc('citl_lecture_review_alert_sweep');reviewCheckAt=Date.now();reviewCheckUser=user.id;if(result.sent)root.checkUserNotifications?.();}catch(error){console.warn('تعذر تحديث تنبيهات تأخر المراجعة',error.message);}finally{reviewChecking=false;}
 }
 setInterval(checkLateReviews,3600000);
 document.addEventListener('visibilitychange',checkLateReviews);
 let deepLinkHandled=false;
 async function initialize(){
  if(!root.currentUser||root.CITLAuth.facultyPending?.(root.currentUser))return;
  try{await mountAdmin();checkLateReviews();checkScheduleName();if(deepLinkHandled)return;const params=new URLSearchParams(location.search),target=params.get('open');if(target==='profile'){deepLinkHandled=true;root.openAdminPanel('profile');}else if(target==='control'||target==='services'){if(!root.currentUser||(target==='services'&&!root.CITLServiceAdmin))return;deepLinkHandled=true;root.openAdminPanel();if(target==='services'&&root.CITLPermissions.can(root.currentUser,'can_manage_settings')){root.CITLServiceAdmin?.mount();root.switchAdminTab('service-availability');}}else if(target==='activity'){deepLinkHandled=true;await root.CITLAdminAccess?.openHistory();if(params.get('broadcast'))await root.CITLAnnouncements?.open(params.get('broadcast'));}else if(target==='structure'&&root.CITLPermissions.can(root.currentUser,'can_manage_structure')){deepLinkHandled=true;root.openAdminPanel();root.switchAdminTab('directory');const dept=document.getElementById('faculty-directory-active-department');if(dept&&params.get('department')){dept.value=params.get('department');root.handleFacultyDirectoryDepartmentChange?.();}}else if(target==='approvals'){await openApprovals();deepLinkHandled=true;}else if(target==='academic'){deepLinkHandled=true;await openWorkboard({term:params.get('term'),action:params.get('action')});}}catch(error){root.showNotification?.(error.message,'error');}
 }
 root.CITLOversight=Object.freeze({mountAdmin,loadApprovals,openApprovals,openRegistrationNotice,renderStructure,renderDashboard,openReport,openWorkboard,loadWorkboard,canAcademicActions,reviewLabel,checkScheduleName,canReviewRegistration:()=>accessUser===root.currentUser?.id&&access?.registration===true});
 root.addEventListener('citl-profile-loaded',e=>{if(accessUser&&accessUser!==e.detail?.id){access=null;approvalSerial++;dashboardSerial++;work.serial++;work.data=null;work.action=null;work.term=null;work.initialized=false;document.getElementById('citl-ac-work-detail')?.replaceChildren();document.querySelector('#admin-academic-actions-tab [data-rows]')?.replaceChildren();document.getElementById('citl-ac-summary')?.remove();document.getElementById('admin-academic-review-tab')?.querySelector('[data-claims]')?.replaceChildren();}initialize();});
 root.addEventListener('load',initialize);
 function scheduleChanged(){checkScheduleName();renderDashboard();const panel=document.getElementById('admin-academic-actions-tab');if(panel&&!panel.classList.contains('hidden'))loadWorkboard();}
 root.addEventListener('citl-schedule-update',scheduleChanged);
 root.addEventListener('storage',e=>{if(e.key==='citl-schedule-update')scheduleChanged();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkScheduleName();});
})(window);
