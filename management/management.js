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
  function table(headers,rows){
    const t=document.createElement('table'),thead=document.createElement('thead'),trh=document.createElement('tr');
    headers.forEach(x=>{const th=document.createElement('th');th.textContent=x;trh.append(th)});thead.append(trh);
    const tb=document.createElement('tbody');rows.forEach(r=>{const tr=document.createElement('tr');r.forEach(x=>tr.append(cell(x)));tb.append(tr)});t.append(thead,tb);return t;
  }
  function aliasesText(value){return Array.isArray(value)?value.filter(Boolean).join('، '):(value||'')}
  function resetVisitorForm(){
    const form=document.getElementById('visitor-form');form.reset();form.elements.id.value='';form.elements.is_active.checked=true;
    document.getElementById('visitor-submit').textContent='إضافة المنتدب';document.getElementById('visitor-reset').classList.add('hidden');
    document.getElementById('visitor-candidate-meta').textContent='اختر اسمًا لمعرفة عدد محاضراته والقاعات المرتبطة به.';
  }
  function editVisitor(visitor){
    const form=document.getElementById('visitor-form'),nameSelect=form.elements.full_name;
    if(![...nameSelect.options].some(o=>o.value===visitor.full_name))nameSelect.append(option(visitor.full_name,`${visitor.full_name} — غير موجود في الجدول الحالي`));
    form.elements.id.value=visitor.id;nameSelect.value=visitor.full_name;form.elements.department_key.value=visitor.department_key||'';
    form.elements.profile_id.value=visitor.profile_id||'';form.elements.aliases.value=aliasesText(visitor.aliases);form.elements.is_active.checked=Boolean(visitor.is_active);
    document.getElementById('visitor-submit').textContent='حفظ التعديل';document.getElementById('visitor-reset').classList.remove('hidden');
    updateCandidateMeta();document.getElementById('tab-visitors').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function visitorsTable(){
    const t=table(['الاسم','القسم','الحساب','الحالة','تحكم'],[]),tb=t.querySelector('tbody');
    (state.visitors||[]).forEach(v=>{
      const tr=document.createElement('tr');
      tr.append(cell(v.full_name),cell(departments[v.department_key]||v.department_key),cell((state.profiles||[]).find(p=>p.id===v.profile_id)?.email||'غير مربوط'),cell(v.is_active?'نشط':'موقوف'));
      const td=document.createElement('td'),actions=document.createElement('div'),edit=document.createElement('button'),toggle=document.createElement('button');actions.className='table-actions';
      edit.className='secondary';edit.type='button';edit.textContent='تعديل';edit.addEventListener('click',()=>editVisitor(v));
      toggle.className=v.is_active?'danger':'primary';toggle.type='button';toggle.textContent=v.is_active?'إيقاف':'تفعيل';toggle.addEventListener('click',async()=>{
        toggle.disabled=true;
        try{await api('visitor.save',{data:{...v,aliases:v.aliases||[],is_active:!v.is_active}});await load();msg('تم تحديث حالة المنتدب')}
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
      const suffix=c.visitor_id?' • مضاف كمنتدب':'';
      names.append(option(c.full_name,`${c.full_name} — ${c.lecture_count} محاضرة${suffix}`));
    });names.value=selectedName;
    const q=document.getElementById('qr-term'),selectedTerm=q.value;q.replaceChildren();
    (state.terms||[]).forEach(t=>q.append(option(t.id,`${t.name}${t.is_active?' (نشط)':''}`)));
    if(selectedTerm&&[...q.options].some(o=>o.value===selectedTerm))q.value=selectedTerm;
  }
  function updateCandidateMeta(){
    const name=document.getElementById('visitor-name').value,c=(state.schedule_instructors||[]).find(x=>x.full_name===name),meta=document.getElementById('visitor-candidate-meta');
    if(!c){meta.textContent=name?'هذا الاسم غير موجود في الجدول الحالي.':'اختر اسمًا لمعرفة عدد محاضراته والقاعات المرتبطة به.';return}
    meta.textContent=`${c.lecture_count} محاضرة • القاعات: ${(c.rooms||[]).join('، ')||'غير محددة'}${c.visitor_id?' • مسجل كمنتدب ويمكن تعديل بياناته':''}`;
  }
  function selectCandidate(){
    const form=document.getElementById('visitor-form'),name=form.elements.full_name.value,c=(state.schedule_instructors||[]).find(x=>x.full_name===name);
    if(!name){resetVisitorForm();return}
    if(c?.visitor_id){const visitor=(state.visitors||[]).find(v=>v.id===c.visitor_id);if(visitor){editVisitor(visitor);return}}
    form.elements.id.value='';form.elements.department_key.value='';form.elements.profile_id.value='';form.elements.aliases.value='';form.elements.is_active.checked=true;
    document.getElementById('visitor-submit').textContent='إضافة المنتدب';document.getElementById('visitor-reset').classList.add('hidden');updateCandidateMeta();
  }
  function renderQrEligibility(){
    const termId=document.getElementById('qr-term').value,rooms=(state.qr_eligible_rooms||[]).filter(x=>x.term_id===termId),box=document.getElementById('eligible-rooms'),summary=document.getElementById('qr-summary');
    box.replaceChildren();rooms.forEach(r=>{const b=document.createElement('span');b.className='room-chip';b.textContent=`${r.room_name} • ${r.visitor_count} منتدب`;box.append(b)});
    summary.textContent=rooms.length?`سيتم إنشاء QR لـ ${rooms.length} قاعة فقط؛ لأنها القاعات التي بها محاضرات للمنتدبين المحددين.`:'لا توجد قاعات مؤهلة بعد. حدّد المنتدبين واربط الحسابات ثم اضغط «مزامنة الجدول».';
    document.getElementById('generate').disabled=!termId||!rooms.length;
  }
  function render(){
    fillSelects();
    const terms=document.getElementById('terms-list');terms.replaceChildren();(state.terms||[]).forEach(t=>{const d=document.createElement('div');d.className='card';const a=document.createElement('strong');a.textContent=t.name;const b=document.createElement('span');b.className='muted';b.textContent=`${t.starts_on} ← ${t.ends_on}${t.is_active?' • نشط':''}`;d.append(a,b);terms.append(d)});
    const visitors=document.getElementById('visitors-list');visitors.replaceChildren(visitorsTable());
    const heads=document.getElementById('heads-list');heads.replaceChildren();(state.heads||[]).forEach(h=>{const d=document.createElement('div');d.className='card';const a=document.createElement('strong');a.textContent=departments[h.department_key]||h.department_key;const b=document.createElement('span');b.textContent=h.profiles?.full_name||h.profiles?.email||'—';d.append(a,b);heads.append(d)});
    const scans=document.getElementById('scans-list');scans.replaceChildren(table(['التاريخ','المنتدب','المادة','القاعة','وقت المسح','داخل الكلية'],(state.scans||[]).map(s=>[s.lecture_date,s.effective_instructor||s.visiting_lecture_sessions?.instructor_name,s.visiting_lecture_sessions?.course_name,s.room_name,new Date(s.scanned_at).toLocaleString('ar-EG'),s.inside_campus?'نعم':'لا'])));
    updateCandidateMeta();renderQrEligibility();
  }
  async function load(){
    try{state=await api('management.snapshot');render()}
    catch(e){msg(e.message,true);if(/المدير|الدخول|جلسة/.test(e.message))setTimeout(()=>location.replace('/'),1200)}
  }

  document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-tab],.panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById(`tab-${b.dataset.tab}`).classList.add('active')}));
  if(location.hash){document.querySelector(`[data-tab="${location.hash.slice(1)}"]`)?.click()}
  document.getElementById('term-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('term.save',{data:{code:f.get('code'),name:f.get('name'),starts_on:f.get('starts_on'),ends_on:f.get('ends_on'),is_active:f.get('is_active')==='on'}});e.target.reset();await load();msg('تم حفظ الترم')}catch(x){msg(x.message,true)}});
  document.getElementById('visitor-name').addEventListener('change',selectCandidate);
  document.getElementById('visitor-reset').addEventListener('click',resetVisitorForm);
  document.getElementById('visitor-form').addEventListener('submit',async e=>{
    e.preventDefault();const f=new FormData(e.target),submit=document.getElementById('visitor-submit');submit.disabled=true;
    try{await api('visitor.save',{data:{id:f.get('id')||null,full_name:f.get('full_name'),department_key:f.get('department_key'),profile_id:f.get('profile_id')||null,aliases:f.get('aliases'),is_active:f.get('is_active')==='on'}});resetVisitorForm();await load();msg('تم حفظ المنتدب وربطه بالجدول')}
    catch(x){msg(x.message,true)}finally{submit.disabled=false}
  });
  document.getElementById('head-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('head.save',{data:{department_key:f.get('department_key'),profile_id:f.get('profile_id')}});await load();msg('تم تحديد رئيس القسم')}catch(x){msg(x.message,true)}});
  document.getElementById('qr-term').addEventListener('change',renderQrEligibility);
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
      const r=await api('qr.generate',{term_id:termId}),box=document.getElementById('qr-list');box.replaceChildren();
      for(const q of r.generated){const card=document.createElement('article');card.className='qr-card';const h=document.createElement('h2');h.textContent=q.room_name;const canvas=document.createElement('canvas');const p=document.createElement('p');p.textContent='QR ثابت لهذه القاعة طوال الترم — للمنتدبين فقط';card.append(h,canvas,p);box.append(card);await window.QRCode.toCanvas(canvas,q.url,{width:260,margin:2,errorCorrectionLevel:'H'})}
      document.getElementById('print').classList.toggle('hidden',!r.generated.length);await load();msg(`تم توليد ${r.generated.length} رمز للقاعات التي بها منتدبون فقط`);
    }catch(x){msg(x.message,true)}finally{button.disabled=false}
  });
  document.getElementById('print').addEventListener('click',()=>print());
  document.getElementById('logout').addEventListener('click',async()=>{await sb.auth.signOut();location.replace('/')});
  load();
})();
