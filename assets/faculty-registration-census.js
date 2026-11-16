/* Read-only current-term academic-name census; never infers ownership from typed profile names. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=k=>k==='unassigned'?'لم يحدد القسم':root.CITLDepartmentHeads?.label(k)||k||'لم يحدد القسم';
 function format(rows){
  const signed=rows.filter(r=>r.status!=='unregistered'),missing=rows.filter(r=>r.status==='unregistered'),lines=['*حصر تسجيل أعضاء هيئة التدريس — الجدول الحالي*','', '*أعضاء هيئة التدريس المسجلون بالنظام ('+signed.length+')*'];
  const groups=[...new Set(signed.map(r=>r.department))].sort((a,b)=>label(a).localeCompare(label(b),'ar'));
  if(!signed.length)lines.push('لا توجد أسماء مرتبطة أو طلبات تسجيل حالية.');
  groups.forEach((key,i)=>{const people=signed.filter(r=>r.department===key);lines.push('',(i+1)+'. *'+label(key)+' ('+people.length+')*');people.forEach((r,j)=>lines.push('   '+(j+1)+'. '+r.name+(r.status==='pending'?' — بانتظار اعتماد الربط':'')));});
  lines.push('','*أعضاء هيئة التدريس الذين لم يسجلوا حتى الآن ('+missing.length+')*');missing.forEach((r,i)=>lines.push((i+1)+'. '+r.name));if(!missing.length)lines.push('لا توجد أسماء غير مسجلة في الجدول الحالي.');
  lines.push('','الحصر بالأسماء الأكاديمية في الجدول الحالي؛ الحساب غير المرتبط باسم أكاديمي لا يمكن مطابقته بالاسم اليدوي.');return lines.join('\n');
 }
 function mount(){
  const parent=document.getElementById('admin-users-tab');if(!parent)return;const previous=document.getElementById('citl-registration-census');if(!root.CITLPermissions.can(root.currentUser,'can_manage_users')){previous?.remove();document.getElementById('citl-census-dialog')?.close();return;}if(previous)return;
  const box=document.createElement('section');box.id='citl-registration-census';box.className='citl-admin-section';box.innerHTML='<div class="citl-admin-section-head"><div><h3>حصر تسجيل أعضاء هيئة التدريس</h3><p>الأسماء الأكاديمية المسجلة حسب الأقسام، والأسماء التي لم ترتبط بحساب بعد، من الجدول الحالي.</p></div><button type="button" class="citl-ac-button secondary">عرض الحصر ونسخه</button></div>';parent.append(box);box.querySelector('button').onclick=open;
 }
 async function open(){
  const d=document.createElement('dialog');d.id='citl-census-dialog';d.className='citl-head-dialog citl-ac-dialog';d.dir='rtl';d.innerHTML='<header><strong>حصر تسجيل أعضاء هيئة التدريس</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body"><p class="citl-ac-muted">من الجدول الحالي وبالأسماء الأكاديمية، وليس الأسماء المكتوبة في الملف الشخصي.</p><div class="citl-ac-buttons"><button type="button" class="citl-ac-button" data-copy disabled>نسخ الحصر</button><button type="button" class="citl-ac-button secondary" data-refresh>تحديث الحصر</button></div><div data-content></div><p role="status"></p></div>';
  d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}};document.body.append(d);d.showModal();
  let text='';const body=d.querySelector('[data-content]'),status=d.querySelector('[role=status]'),copy=d.querySelector('[data-copy]'),refresh=d.querySelector('[data-refresh]');
  async function load(){refresh.disabled=copy.disabled=true;status.textContent='';body.innerHTML='<div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';try{await root.CITLAuth.session();const data=await root.CITLRequests.rpc(root.sb,'citl_faculty_registration_census',{});if(!d.isConnected)return;text=format(data.rows);body.innerHTML='<textarea class="citl-census-text" readonly aria-label="نص حصر الأعضاء">'+E(text)+'</textarea>';copy.disabled=false;}catch(e){body.replaceChildren();status.textContent=e.message;}finally{refresh.disabled=false;}}
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(text);status.textContent='✓ تم نسخ الحصر؛ يمكنك لصقه كما هو.';}catch{body.querySelector('textarea')?.select();status.textContent='تم تحديد النص. استخدم نسخ من المتصفح.';}};refresh.onclick=load;load();
 }
 const academicDepartments=['transport-logistics','trade-logistics','supply-chain','energy-logistics'];
 function mountDepartments(){
  const parent=document.getElementById('admin-users-tab');if(!parent)return;
  const previous=document.getElementById('citl-unregistered-departments');
  if(!root.CITLPermissions.can(root.currentUser,'can_manage_users')){previous?.remove();document.getElementById('citl-department-assignment-dialog')?.close();return;}
  if(previous)return;
  const box=document.createElement('section');box.id='citl-unregistered-departments';box.className='citl-admin-section';
  box.innerHTML='<div class="citl-admin-section-head"><div><h3>تحديد أقسام المحاضرين غير المسجلين</h3><p>اختر أسماء من جدول الفصل الحالي وحدد قسمها لتوزيع مقرراتها. هذا لا ينشئ حسابًا ولا يمنح صلاحية استيفاء أو اعتماد.</p></div><button type="button" class="citl-ac-button" data-department-open>تحديد الأقسام</button></div>';
  parent.append(box);box.querySelector('button').onclick=openDepartments;
 }
 async function openDepartments(){
  if(!root.CITLPermissions.can(root.currentUser,'can_manage_users'))return;
  document.getElementById('citl-department-assignment-dialog')?.close();
  const owner=root.currentUser.id,d=document.createElement('dialog');d.id='citl-department-assignment-dialog';d.dataset.owner=owner;d.className='citl-head-dialog citl-ac-dialog citl-department-assignment';d.dir='rtl';
  d.innerHTML='<header><strong>تحديد أقسام المحاضرين غير المسجلين</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body"><p data-term></p><p class="citl-ac-muted">حدد الأسماء، ثم القسم، ثم احفظ. عند اعتماد حساب المحاضر يُستخدم قسم حسابه، وأي تغيير معتمد عليه يحدّث نفس هويته في الدليل.</p><div class="citl-department-filters"><label>بحث بالاسم<input type="search" data-search placeholder="اكتب اسم المحاضر"></label><label>عرض الأسماء<select data-filter><option value="missing">لم يحدد قسمها بعد</option><option value="assigned">سبق تحديد قسمها — للتعديل</option><option value="all">كل الأسماء غير المسجلة</option></select></label></div><div class="citl-department-selection"><label><input type="checkbox" data-all> تحديد الأسماء الظاهرة</label><span data-selected aria-live="polite">0 اسم محدد</span><button type="button" class="citl-ac-button secondary" data-clear>إلغاء التحديد</button></div><div data-people class="citl-department-people"></div><div class="citl-department-save"><label>القسم المطلوب<select data-department><option value="">اختر القسم…</option>'+academicDepartments.map(k=>'<option value="'+k+'">'+E(label(k))+'</option>').join('')+'</select></label><button type="button" class="citl-ac-button" data-save disabled>حفظ القسم للأسماء المحددة</button><button type="button" class="citl-ac-button secondary" data-refresh>تحديث</button></div><p role="status"></p><p class="citl-ac-muted">الأسماء التي لها حساب مرتبط أو طلب تسجيل تُراجع من بيانات الحساب وطلبات الاعتماد. اسم المحاضر في الجدول والحضور يظل كما هو.</p></div>';
  d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();
  const $=s=>d.querySelector(s),selected=new Map();let rows=[],term=null,busy=false;
  const alive=()=>d.isConnected&&root.currentUser?.id===owner;
  function eligible(r){return !r.registered&&!r.pending;}
  function visible(){const search=$('[data-search]').value.trim().toLocaleLowerCase(),filter=$('[data-filter]').value;return rows.filter(r=>eligible(r)&&(!search||r.name.toLocaleLowerCase().includes(search))&&(filter==='all'||(filter==='missing'?!academicDepartments.includes(r.department):academicDepartments.includes(r.department))));}
  function controls(){const shown=visible();$('[data-selected]').textContent=selected.size+' اسم محدد';$('[data-save]').disabled=busy||!selected.size||!$('[data-department]').value;$('[data-all]').disabled=busy||!shown.length;$('[data-all]').checked=!!shown.length&&shown.every(r=>selected.has(r.identity_key));$('[data-all]').indeterminate=shown.some(r=>selected.has(r.identity_key))&&!$('[data-all]').checked;for(const key of ['refresh','clear','department','search','filter'])$('[data-'+key+']').disabled=busy;}
  function draw(){const shown=visible();$('[data-people]').replaceChildren();if(!shown.length)$('[data-people]').innerHTML='<div class="citl-admin-empty">لا توجد أسماء مطابقة لهذا العرض. يمكنك عرض الأسماء التي سبق تحديد قسمها.</div>';
   for(const r of shown){const item=document.createElement('label');item.className='citl-department-person';item.innerHTML='<input type="checkbox"><span><strong>'+E(r.name)+'</strong><small>'+E(academicDepartments.includes(r.department)?label(r.department):'لم يحدد القسم')+' · '+E(r.course_count)+' مقررات في الجدول</small></span>';const input=item.querySelector('input');input.checked=selected.has(r.identity_key);input.disabled=busy;input.onchange=()=>{if(input.checked)selected.set(r.identity_key,{identity_key:r.identity_key,version:r.version});else selected.delete(r.identity_key);controls();};$('[data-people]').append(item);}
   controls();
  }
  async function api(action,payload){await root.CITLAuth.session();if(!alive())throw Error('تغير الحساب؛ افتح القائمة من جديد');return root.CITLRequests.rpc(root.sb,'citl_faculty_department_admin148',{p_action:action,p_payload:payload||{}});}
  function errorText(e){return /PGRST202|42883/.test(e.code||'')?'يلزم تثبيت تصحيح تحديد الأقسام SQL 148 بعد فحص توافقه.':e.message||'تعذر الحفظ؛ أعد المحاولة';}
  async function load(message=''){busy=true;controls();$('[role=status]').textContent='جاري تحميل الأسماء…';try{const data=await api('list');if(!alive())return;rows=data.rows||[];term=data.term;selected.clear();$('[data-term]').textContent='الفصل الحالي: '+(term?.name||'');$('[role=status]').textContent=message;}catch(e){if(alive()){$('[role=status]').textContent=errorText(e);rows=[];selected.clear();}}finally{busy=false;if(alive())draw();}}
  $('[data-search]').oninput=draw;$('[data-filter]').onchange=draw;$('[data-department]').onchange=controls;
  $('[data-clear]').onclick=()=>{selected.clear();draw();};$('[data-all]').onchange=e=>{for(const r of visible()){if(e.target.checked)selected.set(r.identity_key,{identity_key:r.identity_key,version:r.version});else selected.delete(r.identity_key);}draw();};
  $('[data-refresh]').onclick=()=>load();$('[data-save]').onclick=async()=>{if(busy||!term||!selected.size)return;busy=true;draw();$('[role=status]').textContent='جاري حفظ الأقسام…';try{const result=await api('save',{term_id:term.id,department:$('[data-department]').value,people:[...selected.values()]});if(!alive())return;await load('تم حفظ قسم '+result.saved+' أسماء. ستقرأ المقررات هذا الربط عند تحديث بيانات الفصل.');}catch(e){if(alive())$('[role=status]').textContent=errorText(e);}finally{busy=false;if(alive())draw();}};
  await load();
 }
 root.CITLRegistrationCensus={mount,open,format};root.addEventListener('citl-profile-loaded',mount);root.addEventListener('citl-permissions-changed',mount);mount();
 root.addEventListener('citl-profile-loaded',()=>{const d=document.getElementById('citl-department-assignment-dialog');if(d&&d.dataset.owner!==root.currentUser?.id)d.close();mountDepartments();});root.addEventListener('citl-permissions-changed',mountDepartments);mountDepartments();
})(window);
