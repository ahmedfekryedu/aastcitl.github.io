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
 root.CITLRegistrationCensus={mount,open,format};root.addEventListener('citl-profile-loaded',mount);root.addEventListener('citl-permissions-changed',mount);mount();
})(window);
