/* Export review only. selected offering IDs are the sole authority for workbook contents. */
(function(root){
 'use strict';
 const M=typeof module==='object'&&module.exports?require('./course-excel-model.js'):root.CITLCourseExcelModel;
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const PAGE=10;
 let library;
 function loadLibrary(){if(root.ExcelJS)return Promise.resolve();if(library)return library;library=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/exceljs-4.4.0/exceljs.min.js';s.onload=()=>root.ExcelJS?resolve():reject(Error('مكتبة Excel غير متاحة.'));s.onerror=()=>{library=null;s.remove();reject(Error('تعذر تحميل مكتبة Excel المحلية؛ أعد المحاولة.'));};document.head.append(s);});return library;}
 // Display grouping includes academic fields and roles, never only the course title.
 function courseKey(r){return M.canonical([r.name,r.officialArabic,r.officialEnglish,r.officialCode,r.regulation,r.language,r.departmentKey,r.original.reference?.review_status,(r.assignments||[]).map(a=>[a.profile_id,a.responsibility,!!a.is_primary,!!a.can_review]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);}
 function createReview(model){
  const rows=new Map(model.rows.map(r=>[r.id,r])),selected=new Set(model.rows.filter(r=>r.defaultSelected).map(r=>r.id)),byCourse=new Map(),people=new Map();
  for(const row of model.rows){
   const k=courseKey(row);if(!byCourse.has(k))byCourse.set(k,{key:'g'+byCourse.size,name:row.displayName||row.name,rows:[]});byCourse.get(k).rows.push(row);
   for(const t of row.teacherEntries||[]){
    if(!people.has(t.key))people.set(t.key,{...t,rows:[],aliases:new Set(),defaultVisible:false});
    const p=people.get(t.key);p.aliases.add(t.name);if(!p.rows.some(r=>r.id===row.id))p.rows.push(row);
    if(row.rank<3||row.defaultSelected)p.defaultVisible=true;
   }
  }
  const members=[...people.values()].map((p,i)=>({...p,key:'p'+i,aliases:[...p.aliases]})),memberMap=new Map(members.map(p=>[p.key,p]));
  const groups=[...byCourse.values()],groupMap=new Map(groups.map(g=>[g.key,g])),defaults=members.filter(p=>p.defaultVisible).map(p=>p.key),visible=new Set(defaults);
  return {model,rows,selected,members,memberMap,groups,groupMap,visible,
   pick(id,on){if(!rows.has(id))throw Error('طرح غير متاح في المعاينة');on?selected.add(id):selected.delete(id);},
   pickGroup(key,on){const g=groupMap.get(key);if(!g)throw Error('مادة غير متاحة');g.rows.forEach(r=>this.pick(r.id,on));},
   showPerson(key,on){if(!memberMap.has(key))throw Error('اسم غير متاح من الجدول');on?visible.add(key):visible.delete(key);},
   restorePeople(){visible.clear();defaults.forEach(k=>visible.add(k));},
   stats(){return {people:visible.size,unconfirmed:members.filter(p=>visible.has(p.key)&&!p.confirmed).length,courses:groups.filter(g=>g.rows.some(r=>selected.has(r.id))).length,offerings:selected.size};}
  };
 }
 async function open({termId,department}){
  if(!M.departments[department])throw Error('اختر القسم أولًا، ثم افتح تصدير Excel.');
  const previousFocus=document.activeElement,dialog=document.createElement('dialog');dialog.className='cm-dialog s135-dialog cx-dialog cx-export-selection';dialog.setAttribute('aria-labelledby','cx-export-title');dialog.dir='rtl';
  dialog.innerHTML=`<header><div><strong id="cx-export-title">تصدير نموذج التسكين المبسط</strong><small class="cx-context"></small></div><button type="button" data-close aria-label="إغلاق نافذة التصدير">×</button></header><div class="cm-body"><p class="cx-note">اختيارات هذه النافذة للملف فقط؛ لا تغيّر القسم أو المحاضر أو التكليفات أو جدول الفصل.</p><div data-body><div class="s143-loading" role="status"><strong>جارٍ قراءة مواد الفصل ومحاضريها…</strong><div></div><div></div></div></div><p data-message role="status" aria-live="polite"></p></div><footer class="cx-actions"><button type="button" class="cm-btn" data-download disabled>تنزيل نموذج التسكين المبسط</button><button type="button" class="cm-btn secondary" data-close>إغلاق</button></footer>`;
  document.body.append(dialog);dialog.querySelector('.cx-context').textContent=M.departments[department];
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.onclose=()=>{dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();};dialog.showModal();
  const body=dialog.querySelector('[data-body]'),message=dialog.querySelector('[data-message]'),download=dialog.querySelector('[data-download]');
  const read=()=>M.load({rpc:(name,args)=>root.CITLRequests.rpc(root.sb,name,args),client:root.sb,termId,department});
  let model,review,busy=false,activeTeacher=null,expandedGroup=null;const pages={};
  try{
   model=await read();if(!dialog.isConnected)return;review=createReview(model);dialog.querySelector('.cx-context').textContent=model.departmentLabel+' — '+model.term.name;
   const countRows=rows=>rows.filter(r=>review.selected.has(r.id)).length;
   const badge=t=>`<span class="cx-account ${t.confirmed?'cx-confirmed':'cx-unconfirmed'}" title="${t.confirmed?'ربط مؤكد من المصدر وحساب أكاديمي معتمد':'غياب الربط المؤكد لا يعني بالضرورة عدم وجود حساب'}">${t.confirmed?'✅ مرتبط بحساب مؤكد':'❌ لا يوجد ربط مؤكد'}</span>`;
   function offering(r,prefix){return `<label class="cx-offering"><input type="checkbox" data-action="pick" data-id="${E(r.id)}" data-focus="${prefix}-${E(r.id)}" ${review.selected.has(r.id)?'checked':''}><span><strong>${E(r.displayName||r.name)}</strong><small>رموز المجموعات: <bdi>${E(r.groups.join(' / ')||'غير محددة')}</bdi>${r.original.group_key?' · المجموعة: '+E(r.original.group_key):''}</small><small>${E(r.departmentLabel)} · ${E(({OLD:'قديمة',NEW:'جديدة'})[r.regulation]||'اللائحة تحتاج تصنيف')} · ${E(({ar:'عربي',en:'إنجليزي'})[r.language]||'اللغة غير محددة')}</small><small class="cx-choice-state">${review.selected.has(r.id)?'مختار لملف Excel':'غير مختار للملف'}</small></span></label>`;}
   function pager(items,key,render){
    const max=Math.max(1,Math.ceil(items.length/PAGE));pages[key]=Math.min(pages[key]||0,max-1);const start=pages[key]*PAGE;
    return `<div class="cx-scroll" data-scroll="${key}">${items.slice(start,start+PAGE).map(render).join('')||'<p class="cx-empty">لا توجد عناصر في هذه القائمة.</p>'}</div>${max>1?`<nav class="cx-pager" aria-label="صفحات ${E(key)}"><button type="button" class="cm-btn secondary" data-action="page" data-key="${key}" data-delta="-1" data-focus="prev-${key}" ${pages[key]===0?'disabled':''}>السابق</button><span>${pages[key]+1} / ${max} · ${items.length} عنصرًا</span><button type="button" class="cm-btn secondary" data-action="page" data-key="${key}" data-delta="1" data-focus="next-${key}" ${pages[key]===max-1?'disabled':''}>التالي</button></nav>`:''}`;
   }
   function memberCard(p,addition=false){
    const n=countRows(p.rows),courses=new Set(p.rows.map(courseKey)).size;
    return `<article class="cx-person ${activeTeacher===p.key?'cx-active-person':''}"><div class="cx-person-top"><div><strong><bdi>${E(p.name)}</bdi></strong>${badge(p)}${p.aliases.length>1?'<small>ورد في الجدول أيضًا: '+p.aliases.filter(n=>n!==p.name).map(E).join('، ')+'</small>':''}<small>${courses} مجموعة مواد · ${p.rows.length} طرحًا · <span data-person-count="${p.key}">${n} مختار</span></small>${!p.confirmed?'<small>سجل اسم من مصدر الطرح؛ لا ندمجه مع أسماء مماثلة دون هوية مؤكدة.</small>':''}${p.raw.includes('/')?'<small>نص المصدر: <bdi>'+E(p.raw)+'</bdi> — '+(p.confirmed?'الفصل مثبت بروابط الحسابات':'اسم مركب يحتاج مراجعة؛ لم نفترض أشخاصًا أو أدوارًا')+'</small>':''}</div><div class="cx-person-actions">${addition?`<button type="button" class="cm-btn secondary" data-action="show-person" data-id="${p.key}" data-focus="show-${p.key}">إضافة للمراجعة</button>`:`<button type="button" class="cm-btn secondary" data-action="teacher" data-id="${p.key}" data-focus="teacher-${p.key}" aria-expanded="${activeTeacher===p.key}">${activeTeacher===p.key?'إغلاق المواد':'عرض المواد'}</button><button type="button" class="cx-link" data-action="hide-person" data-id="${p.key}" data-focus="hide-${p.key}">إخفاء من قائمة المراجعة</button>`}</div></div>${activeTeacher===p.key&&!addition?`<div class="cx-person-courses"><p class="cx-mini-note">مواد هذا الاسم من الجدول؛ الاختيار هنا يتحدث مباشرة في قائمة Excel.</p>${pager(p.rows,'teacher-'+p.key,r=>offering(r,'teacher-'+p.key))}</div>`:''}</article>`;
   }
   function courseCard(g,area){
    const n=countRows(g.rows),first=g.rows[0],key=area+'-'+g.key,open=expandedGroup===key,people=new Map();g.rows.forEach(r=>(r.teacherEntries||[]).forEach(t=>people.set(t.key,t)));
    const groupTexts=new Set(g.rows.flatMap(r=>r.groups));
    return `<article class="cx-course ${n?'cx-course-picked':''}"><div class="cx-course-top"><label class="cx-course-check"><input type="checkbox" data-action="group" data-id="${g.key}" data-focus="${key}" data-partial="${n>0&&n<g.rows.length}" ${n===g.rows.length?'checked':''} aria-label="اختيار كل طروحات ${E(g.name)} في مجموعة العرض ${Number(g.key.slice(1))+1}"><span><strong>${E(g.name)}</strong><small>${g.rows.length} طرحًا · ${groupTexts.size} وصف مجموعات · ${n} مختار</small></span></label><button type="button" class="cx-link" data-action="expand" data-key="${key}" data-focus="expand-${key}" aria-expanded="${open}">${open?'طي الطروحات':'عرض الطروحات'}</button></div><div class="cx-course-meta"><span class="cx-tag cx-rank-${first.rank}">${E(first.departmentStatus)}</span><span>${E(first.departmentLabel)}</span>${first.departmentKey&&first.departmentKey!==department?'<strong class="cx-cross-department">تابعة لقسم آخر؛ الاختيار للتصدير فقط ولا ينقل ملكيتها.</strong>':''}${first.rank===2?'<small>مرشحة لهذا القسم؛ الاختيار لا يعتمد ملكيتها.</small>':''}</div>${first.displayName&&first.displayName!==first.name?'<small>نص الجدول: '+E(first.name)+'</small>':''}<div class="cx-course-people">${people.size>6?'<details data-panel="names-'+key+'"><summary>محاضرو المادة ('+people.size+')</summary>'+pager([...people.values()],'names-'+key,t=>'<span><bdi>'+E(t.name)+'</bdi> '+badge(t)+'</span>')+'</details>':[...people.values()].map(t=>`<span><bdi>${E(t.name)}</bdi> ${badge(t)}</span>`).join('')||'المحاضر غير محدد في المصدر'}</div>${n?`<button type="button" class="cx-link" data-action="remove-course" data-id="${g.key}" data-focus="remove-${key}">إزالة من ملف Excel</button>`:''}${open?`<div class="cx-course-offerings"><p class="cx-mini-note">كل سطر طرح مستقل. يمكنك اختيار بعضها؛ علامة المادة تختار جميع طروحات مجموعة العرض الموضحة فقط.</p>${pager(g.rows,'group-'+key,r=>offering(r,key))}</div>`:''}</article>`;
   }
   function draw(){
    const openPanels=new Set([...body.querySelectorAll('details[open]')].map(e=>e.dataset.panel)),initialized=!!body.querySelector('.cx-summary');
    const scrolls=new Map([...body.querySelectorAll('[data-scroll]')].map(e=>[e.dataset.scroll,e.scrollTop])),bodyScroll=body.parentElement.scrollTop,focus=document.activeElement?.dataset.focus;
    const stats=review.stats(),shown=review.members.filter(p=>review.visible.has(p.key)),other=review.members.filter(p=>!review.visible.has(p.key)),chosen=review.groups.filter(g=>g.rows.some(r=>review.selected.has(r.id))),available=review.groups.filter(g=>g.rows.some(r=>!review.selected.has(r.id)));
    const panel=(key,def)=>initialized?openPanels.has(key):def;
    body.innerHTML=`<div class="cx-summary" aria-live="polite"><span><b>${stats.people}</b> أسماء معروضة</span><span><b>${stats.unconfirmed}</b> بدون ربط مؤكد</span><span><b data-course-count>${stats.courses}</b> مجموعات مواد مختارة</span><span><b data-offering-count>${stats.offerings}</b> طرحًا سيُصدَّر</span></div><p class="cx-mini-note">❌ تعني غياب الربط المؤكد، وليس بالضرورة غياب الحساب. لا تمنع اختيار المادة أو تصديرها. أسماء المراجعة ليست عدد أشخاص موحدًا عند وجود هوية ملتبسة.</p><div class="cx-picker-grid"><section class="cx-picker"><h3>أعضاء هيئة التدريس من جدول الفصل <span>${stats.people}</span></h3><details data-panel="people" ${panel('people',true)?'open':''}><summary>قائمة الأسماء للمراجعة <span>${shown.length}</span></summary>${pager(shown,'people',p=>memberCard(p))}</details><details data-panel="people-add" ${panel('people-add',false)?'open':''}><summary>إضافة عضو من جدول الفصل <span>${other.length}</span></summary><p class="cx-mini-note">أسماء أخرى متاحة بصلاحياتك أو مخفية مؤقتًا. إضافتها لا تختار موادها تلقائيًا.</p>${pager(other,'people-add',p=>memberCard(p,true))}</details><button type="button" class="cx-link cx-restore" data-action="restore" data-focus="restore">استعادة قائمة الأسماء من الجدول</button></section><section class="cx-picker"><h3>المواد المختارة لملف Excel <span>${stats.courses}</span></h3><details data-panel="courses" ${panel('courses',true)?'open':''}><summary>مراجعة المواد المختارة <span>${chosen.length}</span></summary>${pager(chosen,'courses',g=>courseCard(g,'chosen'))}</details><details data-panel="courses-add" ${panel('courses-add',false)?'open':''}><summary>إضافة مادة من جدول الفصل <span>${available.length}</span></summary><p class="cx-mini-note">جميع الطروحات الحالية المتاحة بصلاحياتك؛ بما فيها المرشحة وغير المرتبطة بحساب محاضر.</p>${pager(available,'courses-add',g=>courseCard(g,'available'))}</details></section></div><p class="cx-note">كل مجموعة عرض قد تضم عدة طروحات متوافقة؛ تفاصيل Excel ونطاق القرار تحتفظ بهوية كل طرح. إخفاء الاسم لا يستبعد مواده. يمكن إسناد الاستيفاء لاحقًا لحساب معتمد ومخوّل من نظام التكليفات القائم، دون تغيير محاضر الجدول.</p>${model.warnings.length?`<details data-panel="warnings" class="cx-note" ${panel('warnings',false)?'open':''}><summary>ملاحظات مطابقة المصدر (${model.warnings.length})</summary><ul>${model.warnings.map(w=>`<li>${E(w.name)} — ${E(w.message)}</li>`).join('')}</ul></details>`:''}`;
    body.querySelectorAll('[data-partial="true"]').forEach(e=>e.indeterminate=true);body.querySelectorAll('[data-scroll]').forEach(e=>{if(scrolls.has(e.dataset.scroll))e.scrollTop=scrolls.get(e.dataset.scroll);});
    if(focus)[...body.querySelectorAll('[data-focus]')].find(e=>e.dataset.focus===focus)?.focus({preventScroll:true});body.parentElement.scrollTop=bodyScroll;download.disabled=busy||!review.selected.size;
   }
   body.addEventListener('change',e=>{if(busy)return;const t=e.target;if(t.dataset.action==='pick')review.pick(t.dataset.id,t.checked);else if(t.dataset.action==='group')review.pickGroup(t.dataset.id,t.checked);else return;draw();});
   body.addEventListener('click',e=>{if(busy)return;const b=e.target.closest('button[data-action]');if(!b)return;switch(b.dataset.action){
    case 'teacher':activeTeacher=activeTeacher===b.dataset.id?null:b.dataset.id;break;
    case 'show-person':review.showPerson(b.dataset.id,true);activeTeacher=b.dataset.id;pages.people=Math.floor(review.members.filter(p=>review.visible.has(p.key)).findIndex(p=>p.key===b.dataset.id)/PAGE);body.querySelector('[data-panel=people]').open=true;break;
    case 'hide-person':review.showPerson(b.dataset.id,false);if(activeTeacher===b.dataset.id)activeTeacher=null;break;
    case 'restore':review.restorePeople();activeTeacher=null;pages.people=0;pages['people-add']=0;break;
    case 'expand':expandedGroup=expandedGroup===b.dataset.key?null:b.dataset.key;break;
    case 'remove-course':review.pickGroup(b.dataset.id,false);break;
    case 'page':pages[b.dataset.key]=(pages[b.dataset.key]||0)+Number(b.dataset.delta);break;
    default:return;
   }draw();});
   draw();
   download.onclick=async()=>{
    if(busy||!review.selected.size)return;busy=true;download.disabled=true;body.inert=true;download.textContent='جارٍ التحقق وتجهيز الملف…';message.textContent='نراجع المصدر والصلاحيات والتكليفات مجددًا قبل تنزيل الملف.';
    try{
     await loadLibrary();const fresh=await read();if(!dialog.isConnected)return;
     if(fresh.snapshotHash!==model.snapshotHash)throw Error('تغير الجدول أو التكليفات أو الصلاحيات منذ المعاينة. أغلقها وافتحها مرة أخرى؛ لم يُصدَّر ملف قديم.');
     const result=await root.CITLCourseExcelWorkbook.create(fresh,[...review.selected]);if(!dialog.isConnected)return;
     const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=result.filename;a.target='_blank';a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
     message.textContent='تم تجهيز '+result.rowCount+' مجموعة عرض تشمل '+result.offeringCount+' طرحًا في Excel. الأسماء غير المرتبطة محفوظة كما وردت في الجدول. لم تتغير أي بيانات بالنظام.';
    }catch(e){if(dialog.isConnected)message.textContent=e.message||'تعذر التصدير. أعد فتح المعاينة.';}finally{busy=false;if(dialog.isConnected){body.inert=false;download.textContent='تنزيل نموذج التسكين المبسط';download.disabled=!review.selected.size;}}
   };
  }catch(e){if(dialog.isConnected){body.textContent='تعذرت قراءة المعاينة الحالية؛ لم نعرض بيانات قديمة أو نتجاوز الصلاحيات.';message.textContent=e.message||'تعذرت قراءة بيانات التصدير؛ أعد فتح المعاينة.';}}
 }
 const api=Object.freeze({open,loadLibrary,createReview,courseKey});if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelExport=api;
})(typeof window==='object'?window:globalThis);
