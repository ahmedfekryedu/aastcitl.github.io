(function(){
  'use strict';

  const URL='https://xgqukdbonzukxrpjovmb.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYXNlIiwicmVmIjoieGdxdWtkYm9uenVreHJwam92bWIiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc2Mzg5ODgwMywiZXhwIjoyMDc5NDc0ODAzfQ.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM';
  const sb=window.supabase.createClient(URL,KEY,{auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true}});
  const departments={'transport-logistics':'إدارة لوجستيات النقل','trade-logistics':'إدارة لوجستيات التجارة الدولية','supply-chain':'إدارة لوجستيات سلاسل الإمداد','energy-logistics':'إدارة لوجستيات الطاقة والبترول','training-agency':'وكالة التدريب وخدمة المجتمع','postgrad-agency':'وكالة الدراسات العليا','education-agency':'وكالة شؤون التعليم','students-agency':'وكالة شؤون الطلاب','assistants-office':'مكتب المعيدين','computer-lab':'معمل الحاسب'};
  let state={};
  let statusTimer;

  function msg(text,error=false){
    const el=document.getElementById('status');
    clearTimeout(statusTimer);el.textContent=text;el.className=error?'show error':'show';
    statusTimer=setTimeout(()=>el.className='',4200);
  }
  async function api(action,payload={}){
    const{data}=await sb.auth.getSession();
    if(!data.session)throw Error('يلزم تسجيل الدخول');
    const request=sb.rpc('citl_secure_api',{p_action:action,p_payload:payload});
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(Error('انتهت مهلة الاتصال؛ حاول مرة أخرى')),15000));
    const{data:out,error}=await Promise.race([request,timeout]);
    if(error||!out||out.ok===false)throw Error(error?.message||out?.error||'تعذر التنفيذ');
    return out;
  }
  function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o}
  function cell(text){const td=document.createElement('td');td.textContent=text??'—';return td}
  function localDate(value){return value?new Date(value).toLocaleString('ar-EG'):'—'}
  function table(headers,rows){
    const t=document.createElement('table'),thead=document.createElement('thead'),trh=document.createElement('tr');
    headers.forEach(x=>{const th=document.createElement('th');th.textContent=x;trh.append(th)});thead.append(trh);
    const tb=document.createElement('tbody');rows.forEach(r=>{const tr=document.createElement('tr');r.forEach(x=>tr.append(cell(x)));tb.append(tr)});t.append(thead,tb);return t;
  }
  function aliasesText(value){return Array.isArray(value)?value.filter(Boolean).join('، '):(value||'')}
  function defaultTermId(){return (state.terms||[]).find(t=>t.is_active)?.id||(state.terms||[])[0]?.id||''}
  function selectedTermVisitors(){
    const termId=document.getElementById('visitor-term')?.value||defaultTermId();
    return (state.term_visitors||[]).filter(v=>v.term_id===termId);
  }
  function resetVisitorForm(){
    const form=document.getElementById('visitor-form'),termId=form.elements.term_id.value||defaultTermId();form.reset();form.elements.id.value='';form.elements.term_id.value=termId;form.elements.is_active.checked=true;
    document.getElementById('visitor-submit').textContent='إضافة المنتدب';document.getElementById('visitor-reset').classList.add('hidden');
    document.getElementById('visitor-candidate-meta').textContent='اختر اسمًا لمعرفة عدد محاضراته والقاعات المرتبطة به.';
  }
  function editVisitor(visitor){
    const form=document.getElementById('visitor-form'),nameSelect=form.elements.full_name;
    if(![...nameSelect.options].some(o=>o.value===visitor.full_name))nameSelect.append(option(visitor.full_name,`${visitor.full_name} — غير موجود في الجدول الحالي`));
    form.elements.id.value=visitor.id;form.elements.term_id.value=visitor.term_id||defaultTermId();nameSelect.value=visitor.full_name;form.elements.department_key.value=visitor.department_key||'';
    form.elements.profile_id.value=visitor.profile_id||'';form.elements.aliases.value=aliasesText(visitor.aliases);form.elements.is_active.checked=Boolean(visitor.is_active);
    document.getElementById('visitor-submit').textContent='حفظ التعديل';document.getElementById('visitor-reset').classList.remove('hidden');
    updateCandidateMeta();document.getElementById('tab-visitors').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function visitorsTable(){
    const t=table(['الاسم','القسم','الحساب','الحالة','تحكم'],[]),tb=t.querySelector('tbody');
    selectedTermVisitors().forEach(v=>{
      const tr=document.createElement('tr');
      tr.append(cell(v.full_name),cell(departments[v.department_key]||v.department_key),cell((state.profiles||[]).find(p=>p.id===v.profile_id)?.email||'غير مربوط'),cell(v.is_active?'نشط':'موقوف'));
      const td=document.createElement('td'),actions=document.createElement('div'),edit=document.createElement('button'),toggle=document.createElement('button');actions.className='table-actions';
      edit.className='secondary';edit.type='button';edit.textContent='تعديل';edit.addEventListener('click',()=>editVisitor(v));
      toggle.className=v.is_active?'danger':'primary';toggle.type='button';toggle.textContent=v.is_active?'إيقاف':'تفعيل';toggle.addEventListener('click',async()=>{
        toggle.disabled=true;
        try{await api('visitor.save',{data:{...v,term_id:v.term_id,aliases:v.aliases||[],is_active:!v.is_active}});await load();msg('تم تحديث حالة المنتدب لهذا الترم')}
        catch(e){msg(e.message,true)}finally{toggle.disabled=false}
      });
      actions.append(edit,toggle);td.append(actions);tr.append(td);tb.append(tr);
    });return t;
  }
  function fillSelects(){
    document.querySelectorAll('.department').forEach(s=>{const selected=s.value;s.replaceChildren(option('','— اختر القسم —'));Object.entries(departments).forEach(([k,v])=>s.append(option(k,v)));s.value=selected});
    for(const id of ['visitor-profile','head-profile']){
      const s=document.getElementById(id),selected=s.value;s.replaceChildren(option('','— اختر الحساب —'));
      (state.profiles||[]).forEach(p=>s.append(option(p.id,`${p.full_name||p.email} – ${departments[p.department]||p.department||''}`)));s.value=selected;
    }
    const names=document.getElementById('visitor-name'),selectedName=names.value;names.replaceChildren(option('','— اختر محاضرًا من الجدول —'));
    (state.schedule_instructors||[]).forEach(c=>{
      const suffix=selectedTermVisitors().some(v=>v.id===c.visitor_id)?' • محدد في هذا الترم':'';
      names.append(option(c.full_name,`${c.full_name} — ${c.lecture_count} محاضرة${suffix}`));
    });names.value=selectedName;
    for(const id of ['visitor-term','qr-term','reports-term']){
      const q=document.getElementById(id),selectedTerm=q.value||defaultTermId();q.replaceChildren();
      (state.terms||[]).forEach(t=>q.append(option(t.id,`${t.name}${t.is_active?' (نشط)':''}`)));
      if(selectedTerm&&[...q.options].some(o=>o.value===selectedTerm))q.value=selectedTerm;
    }
  }
  function updateCandidateMeta(){
    const name=document.getElementById('visitor-name').value,c=(state.schedule_instructors||[]).find(x=>x.full_name===name),meta=document.getElementById('visitor-candidate-meta');
    if(!c){meta.textContent=name?'هذا الاسم غير موجود في الجدول الحالي.':'اختر اسمًا لمعرفة عدد محاضراته والقاعات المرتبطة به.';return}
    const assigned=selectedTermVisitors().some(v=>v.id===c.visitor_id);
    meta.textContent=`${c.lecture_count} محاضرة • القاعات: ${(c.rooms||[]).join('، ')||'غير محددة'}${assigned?' • محدد كمنتدب في هذا الترم ويمكن تعديل بياناته':c.visitor_id?' • له سجل سابق ويمكن اختياره لهذا الترم':''}`;
  }
  function selectCandidate(){
    const form=document.getElementById('visitor-form'),name=form.elements.full_name.value,c=(state.schedule_instructors||[]).find(x=>x.full_name===name);
    if(!name){resetVisitorForm();return}
    if(c?.visitor_id){const assignment=selectedTermVisitors().find(v=>v.id===c.visitor_id);if(assignment){editVisitor(assignment);return}}
    const identity=(state.visitors||[]).find(v=>v.id===c?.visitor_id);
    form.elements.id.value=identity?.id||'';form.elements.department_key.value=identity?.department_key||'';form.elements.profile_id.value=identity?.profile_id||'';form.elements.aliases.value=aliasesText(identity?.aliases);form.elements.is_active.checked=true;
    document.getElementById('visitor-submit').textContent='إضافة المنتدب';document.getElementById('visitor-reset').classList.add('hidden');updateCandidateMeta();
  }
  function renderQrEligibility(){
    const termId=document.getElementById('qr-term').value,rooms=(state.qr_eligible_rooms||[]).filter(x=>x.term_id===termId),box=document.getElementById('eligible-rooms'),summary=document.getElementById('qr-summary');
    box.replaceChildren();rooms.forEach(r=>{const b=document.createElement('span');b.className='room-chip';b.textContent=`${r.room_name} • ${r.visitor_count} منتدب`;box.append(b)});
    summary.textContent=rooms.length?`سيتم إنشاء QR لـ ${rooms.length} قاعة فقط؛ لأنها القاعات التي بها محاضرات للمنتدبين المحددين.`:'لا توجد قاعات مؤهلة بعد. حدّد المنتدبين واربط الحسابات ثم اضغط «مزامنة الجدول».';
    document.getElementById('generate').disabled=!termId||!rooms.length;
  }
  function renderVisitorRows(){
    const visitors=document.getElementById('visitors-list');visitors.replaceChildren(visitorsTable());updateCandidateMeta();
  }
  function renderReports(){
    const termId=document.getElementById('reports-term')?.value||defaultTermId(),term=(state.terms||[]).find(t=>t.id===termId);
    const scanRows=(state.scans||[]).filter(s=>!termId||s.term_id===termId).map(s=>[s.lecture_date,s.effective_instructor||s.visiting_lecture_sessions?.instructor_name,s.visiting_lecture_sessions?.course_name,s.room_name,localDate(s.scanned_at),s.inside_campus?'نعم':'لا']);
    document.getElementById('scans-list').replaceChildren(table(['التاريخ','المنتدب','المادة','القاعة','وقت المسح','داخل الكلية'],scanRows));
    const profileIds=new Set((state.term_visitors||[]).filter(v=>v.term_id===termId&&v.is_active&&v.profile_id).map(v=>v.profile_id));
    const presenceRows=(state.presence_sessions||[]).filter(s=>profileIds.has(s.user_id)&&(!term||((s.started_at||'').slice(0,10)>=term.starts_on&&(s.started_at||'').slice(0,10)<=term.ends_on))).map(s=>[
      s.user_name,localDate(s.started_at),localDate(s.last_seen_at),s.ended_at?localDate(s.ended_at):(s.is_online?'متصل الآن':'لم يسجل'),s.inside_campus?'نعم':'لا',s.network_label||'—'
    ]);
    document.getElementById('presence-sessions-list').replaceChildren(table(['المنتدب','الدخول','آخر ظهور','الانصراف','داخل الكلية','الشبكة'],presenceRows));
  }
  function escapeHtml(value){
    return String(value||'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }
  function printQrCards(){
    const cards=[...document.querySelectorAll('#qr-list .qr-card')];
    if(!cards.length){msg('لا توجد رموز جاهزة للطباعة',true);return}
    const popup=window.open('','_blank','width=900,height=900');
    if(!popup){msg('اسمح بفتح نافذة الطباعة من المتصفح',true);return}
    const sheets=cards.map(card=>{
      const roomName=card.querySelector('h2')?.textContent?.trim()||'القاعة';
      const qrImage=card.querySelector('canvas')?.toDataURL('image/png')||'';
      return `<section class="sheet"><main class="print-card"><div class="room-heading"><span>رمز تسجيل الحضور</span><h1>${escapeHtml(roomName)}</h1></div><div class="qr-frame"><img class="qr" src="${qrImage}" alt="QR ${escapeHtml(roomName)}"></div><p class="scan-hint">امسح الرمز بالكاميرا لتسجيل الحضور</p><div class="faculty-note">خاص بأعضاء هيئة التدريس فقط</div></main></section>`;
    }).join('');
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>QR القاعات</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Cairo,Arial,sans-serif;color:#111}.sheet{width:100%;page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}.print-card{width:100%;max-width:175mm;margin:0 auto;border:2px solid #111;border-radius:4mm;padding:9mm 10mm;text-align:center;background:#fff}.room-heading span{display:block;font-size:11px;font-weight:900}.room-heading h1{font-size:34px;line-height:1.3;margin:1.5mm 0 5mm;font-weight:900}.qr-frame{width:118mm;height:118mm;margin:0 auto 4mm;padding:3mm;border:1.2mm solid #111;border-radius:3mm;background:#fff}.qr{display:block;width:100%;height:100%;object-fit:contain;filter:grayscale(1)}.scan-hint{margin:0 0 3mm;font-size:11px;font-weight:700}.faculty-note{padding:3mm 5mm;border:1.5px solid #111;border-radius:2mm;font-size:12px;font-weight:900}@media screen{body{background:#eee}.sheet{padding:10mm 0}.print-card{box-shadow:0 5mm 14mm rgba(0,0,0,.12)}}@media print{.print-card{box-shadow:none}}</style></head><body>${sheets}<script>onload=()=>setTimeout(()=>print(),700)<\/script></body></html>`);
    popup.document.close();
  }
  function render(){
    fillSelects();
    const terms=document.getElementById('terms-list');terms.replaceChildren();(state.terms||[]).forEach(t=>{const d=document.createElement('div');d.className='card';const a=document.createElement('strong');a.textContent=t.name;const b=document.createElement('span');b.className='muted';b.textContent=`${t.starts_on} ← ${t.ends_on}${t.is_active?' • نشط':''}`;d.append(a,b);terms.append(d)});
    renderVisitorRows();
    const heads=document.getElementById('heads-list');heads.replaceChildren();(state.heads||[]).forEach(h=>{const d=document.createElement('div');d.className='card';const a=document.createElement('strong');a.textContent=departments[h.department_key]||h.department_key;const b=document.createElement('span');b.textContent=h.profiles?.full_name||h.profiles?.email||'—';d.append(a,b);heads.append(d)});
    renderReports();renderQrEligibility();
  }
  async function load(){
    try{state=await api('management.snapshot');render()}
    catch(e){msg(e.message,true);if(/المدير|الدخول|جلسة/.test(e.message))setTimeout(()=>location.replace('/'),1200)}
  }

  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab],.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(`tab-${b.dataset.tab}`).classList.add('active')}));
  if(location.hash){document.querySelector(`[data-tab="${location.hash.slice(1)}"]`)?.click()}
  document.getElementById('term-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('term.save',{data:{code:f.get('code'),name:f.get('name'),starts_on:f.get('starts_on'),ends_on:f.get('ends_on'),is_active:f.get('is_active')==='on'}});e.target.reset();await load();msg('تم حفظ الترم')}catch(x){msg(x.message,true)}});
  document.getElementById('visitor-term').addEventListener('change',()=>{resetVisitorForm();fillSelects();renderVisitorRows()});
  document.getElementById('visitor-name').addEventListener('change',selectCandidate);
  document.getElementById('visitor-reset').addEventListener('click',resetVisitorForm);
  document.getElementById('visitor-form').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.target),submit=document.getElementById('visitor-submit');submit.disabled=true;
    try{await api('visitor.save',{data:{id:f.get('id')||null,term_id:f.get('term_id'),full_name:f.get('full_name'),department_key:f.get('department_key'),profile_id:f.get('profile_id')||null,aliases:f.get('aliases'),is_active:f.get('is_active')==='on'}});resetVisitorForm();await load();msg('تم حفظ المنتدب وربطه بهذا الترم وإبلاغ رئيس القسم')}
    catch(x){msg(x.message,true)}finally{submit.disabled=false}
  });
  document.getElementById('head-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('head.save',{data:{department_key:f.get('department_key'),profile_id:f.get('profile_id')}});await load();msg('تم تحديد رئيس القسم')}catch(x){msg(x.message,true)}});
  document.getElementById('qr-term').addEventListener('change',()=>{renderQrEligibility();document.getElementById('qr-list').replaceChildren();document.getElementById('print').classList.add('hidden')});
  document.getElementById('reports-term').addEventListener('change',renderReports);
  document.getElementById('reports-refresh').addEventListener('click',load);
  document.getElementById('sync').addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;
    try{const r=await api('sessions.sync',{term_id:document.getElementById('qr-term').value});await load();msg(`تمت مزامنة ${r.count} محاضرة للمنتدبين${r.skipped?.length?'، وظهرت توقيتات تحتاج مراجعة':''}`)}
    catch(x){msg(x.message,true)}finally{button.disabled=false}
  });
  document.getElementById('generate').addEventListener('click',async e=>{
    const termId=document.getElementById('qr-term').value,eligible=(state.qr_eligible_rooms||[]).filter(x=>x.term_id===termId);
    if(!eligible.length){msg('لا توجد قاعات بها محاضرات لمنتدبين بعد المزامنة',true);return}
    if(!confirm(`سيتم توليد ${eligible.length} رمز QR للقاعات المؤهلة فقط وإلغاء الرموز السابقة لها. هل تريد المتابعة؟`))return;
    const button=e.currentTarget;button.disabled=true;
    try{
      const r=await api('qr.generate',{term_id:termId});await load();const box=document.getElementById('qr-list');box.replaceChildren();
      for(const q of r.generated){const card=document.createElement('article');card.className='qr-card';const h=document.createElement('h2');h.textContent=q.room_name;const canvas=document.createElement('canvas');canvas.style.display='block';canvas.style.margin='0 auto';canvas.style.maxWidth='100%';const p=document.createElement('p');p.textContent='QR ثابت لهذه القاعة طوال الترم — خاص بأعضاء هيئة التدريس فقط';card.append(h,canvas,p);box.append(card);await window.QRCode.toCanvas(canvas,q.url,{width:260,margin:2,errorCorrectionLevel:'H'})}
      document.getElementById('print').classList.toggle('hidden',!r.generated.length);msg(`تم توليد ${r.generated.length} رمز للقاعات التي بها منتدبون فقط`);
    }catch(x){msg(x.message,true)}finally{button.disabled=false}
  });
  document.getElementById('print').addEventListener('click',printQrCards);
  document.getElementById('logout').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('/')});
  load();
})();
