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
  const previousFocus=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='cm-dialog s135-dialog cx-dialog cx-export-selection';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','cx-export-title');
  dialog.innerHTML=`<header class="cx-work-head"><div class="cx-heading"><div><strong id="cx-export-title">تجهيز ملف تسكين المقررات</strong><small class="cx-context"></small></div><button type="button" data-close aria-label="إغلاق نافذة التصدير">×</button></div><div class="cx-summary" aria-live="polite"></div></header><nav class="cx-mobile-tabs" aria-label="أجزاء تجهيز الملف"><button data-tab="people">المحاضرون</button><button data-tab="courses">المواد</button><button data-tab="detail">التفاصيل</button></nav><main class="cm-body"><div data-body><p role="status">جارٍ قراءة مواد الفصل ومحاضريها…</p></div></main><footer class="cx-work-foot"><div class="cx-footer-info"><strong data-total></strong><small data-warning></small><small data-message role="status" aria-live="polite"></small></div><div class="cx-footer-buttons"><button type="button" class="cm-btn" data-download disabled>تنزيل نموذج التسكين Excel</button><button type="button" class="cm-btn secondary" data-close>إلغاء وإغلاق</button></div></footer>`;
  document.body.append(dialog);dialog.querySelector('.cx-context').textContent=M.departments[department];
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.onclose=()=>{dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();};dialog.showModal();
  const body=dialog.querySelector('[data-body]'),message=dialog.querySelector('[data-message]'),download=dialog.querySelector('[data-download]'),scroller=dialog.querySelector('main');
  const read=()=>M.load({rpc:(name,args)=>root.CITLRequests.rpc(root.sb,name,args),client:root.sb,termId,department});
  let model,review,busy=false,active=null,peopleMode='shown',courseMode='chosen',tab='courses',pending=null;const pages={};
  try{
   model=await read();if(!dialog.isConnected)return;review=createReview(model);dialog.querySelector('.cx-context').textContent=model.departmentLabel+' — '+model.term.name;
   const count=rows=>rows.filter(r=>review.selected.has(r.id)).length;
   const foreign=r=>!!r.departmentKey&&r.departmentKey!==department;
   const badge=t=>`<span class="cx-account ${t.confirmed?'cx-confirmed':'cx-unconfirmed'}">${t.confirmed?'✅ ربط مؤكد':'❌ لا يوجد ربط مؤكد'}</span>`;
   const button=(action,id,label,cls='cx-link')=>`<button type="button" class="${cls}" data-action="${action}" data-id="${E(id)}">${label}</button>`;
   const namesCount=rows=>new Set(rows.map(r=>r.name)).size;
   function pager(items,key,render){const max=Math.max(1,Math.ceil(items.length/PAGE));pages[key]=Math.min(pages[key]||0,max-1);return `<div class="cx-items">${items.slice(pages[key]*PAGE,(pages[key]+1)*PAGE).map(render).join('')||'<p class="cx-empty">لا توجد عناصر في هذا الاختيار.</p>'}</div>${max>1?`<nav class="cx-pager" aria-label="صفحات القائمة">${button('page',key+'|-1','السابق') .replace('<button','<button '+(pages[key]===0?'disabled':''))}<span>${pages[key]+1} / ${max}</span>${button('page',key+'|1','التالي').replace('<button','<button '+(pages[key]===max-1?'disabled':''))}</nav>`:''}`;}
   function teacher(p){return `<article class="cx-person ${active?.type==='person'&&active.id===p.key?'cx-current':''}">${button('person',p.key,`<bdi>${E(p.name)}</bdi>`,'cx-item-title')}${badge(p)}<small>${namesCount(p.rows)} أسماء مواد · ${count(p.rows)} / ${p.rows.length} طرح مختار</small><div class="cx-item-actions">${button('person',p.key,'عرض المواد')}${button(review.visible.has(p.key)?'hide':'show',p.key,review.visible.has(p.key)?'إخفاء مؤقت':'إضافة للمراجعة')}</div></article>`;}
   function course(g){const n=count(g.rows),first=g.rows[0];return `<article class="cx-course ${n?'cx-course-picked':''} ${active?.type==='course'&&active.id===g.key?'cx-current':''}"><div class="cx-row"><input type="checkbox" data-action="group" data-id="${g.key}" data-partial="${n>0&&n<g.rows.length}" ${n===g.rows.length?'checked':''} aria-label="اختيار ${E(g.name)}"><div>${button('course',g.key,E(g.name),'cx-item-title')}<small>${new Set(g.rows.flatMap(r=>r.groups)).size} وصف مجموعات · ${g.rows.length} طرح · ${n} مختار</small></div></div><div class="cx-item-actions"><span class="cx-tag">${E(first.departmentStatus)}</span>${button('course',g.key,'عرض التفاصيل')}</div>${foreign(first)?'<small class="cx-foreign-label">قسم آخر — راجع تنبيه الاستيراد قبل الإضافة</small>':''}</article>`;}
   function offering(r){return `<article class="cx-detail-row"><label class="cx-row"><input type="checkbox" data-action="pick" data-id="${E(r.id)}" ${review.selected.has(r.id)?'checked':''}><span><strong>${E(r.displayName||r.name)}</strong><small>المجموعات: <bdi>${E(r.groups.join(' / ')||'غير محددة — تحتاج مراجعة')}</bdi></small><small>${E(r.departmentLabel)} · ${E(({OLD:'قديمة',NEW:'جديدة'})[r.regulation]||'اللائحة تحتاج تصنيف')}</small></span></label><div class="cx-detail-teachers">${(r.teacherEntries||[]).map(t=>`<span><bdi>${E(t.name)}</bdi> ${badge(t)}</span>`).join('')}</div><small>${review.selected.has(r.id)?'مختار للتصدير':'غير مختار'} · طرح مستقل ${E(r.id.slice(0,8))}</small></article>`;}
   function details(){let rows=[],title='اختر محاضرًا أو مادة',note='تظهر هنا تفاصيل الاختيار. إخفاء المحاضر لا يستبعد مواده، وإضافته لا تختارها تلقائيًا.';if(active?.type==='person'){const p=review.memberMap.get(active.id);rows=p.rows;title=p.name;note='مواد هذا الاسم من جدول الفصل. اختيار الطرح ينعكس فورًا في القائمتين.';}if(active?.type==='course'){const g=review.groupMap.get(active.id);rows=g.rows;title=g.name;note='كل سطر طرح مستقل. اختَر ما يدخل الملف؛ لا تتغير ملكية المادة أو محاضر الجدول.';}
    return `<section class="cx-detail" data-section="detail"><div class="cx-section-title"><h3>تفاصيل الاختيار</h3>${active?button('clear','','إغلاق التفاصيل'):''}</div><h4>${E(title)}</h4><p class="cx-mini-note">${E(note)}</p>${pending?`<div class="cx-foreign-warning" role="alert" tabindex="-1"><strong>مادة تابعة لقسم آخر</strong><p>هذه المادة معتمدة لقسم آخر؛ إدراجها في ملف التصدير لا ينقل ملكيتها إلى القسم الحالي، وقد يرفض الاستيراد تغيير ملكيتها.</p><p>المستورد الحالي يرفض إدراجها في ملف هذا القسم حتى دون تعديلها. الملف لن يكون قابلًا للاستيراد كما هو؛ استبعدها قبل تجهيز ملف الاعتماد.</p><div class="cx-item-actions">${button('confirm-foreign','','إدراج للاطلاع فقط','cm-btn secondary')}${button('cancel-foreign','','عدم الإدراج','cm-btn')}</div></div>`:''}${rows.map(offering).join('')}${model.warnings.length?`<p class="cx-mini-note">ملاحظات المصدر: ${model.warnings.map(w=>E(w.name)+' — '+E(w.message)).join('؛ ')}</p>`:''}</section>`;
   }
   function draw(){const scroll=scroller.scrollTop,focus=document.activeElement,focusAction=focus?.dataset.action,focusId=focus?.dataset.id;
    const stats=review.stats(),picked=model.rows.filter(r=>review.selected.has(r.id)),foreignCount=picked.filter(foreign).length;
    dialog.querySelector('.cx-summary').innerHTML=`<span><b>${stats.people}</b> سجل اسم معروض</span><span><b>${stats.unconfirmed}</b> بلا ربط مؤكد</span><span><b data-course-count>${namesCount(picked)}</b> اسم مقرر مختار</span><span><b data-offering-count>${stats.offerings}</b> طرحًا أصليًا</span>`;
    dialog.querySelector('[data-total]').textContent=namesCount(picked)+' اسم مقرر · '+stats.courses+' مجموعة عرض · '+stats.offerings+' طرحًا في Excel';
    dialog.querySelector('[data-warning]').textContent=foreignCount?'تنبيه: '+foreignCount+' طرحًا لقسم آخر؛ الملف غير قابل للاستيراد كما هو.':'التصدير لا يغيّر بيانات النظام. ❌ غياب ربط الحساب لا يمنع التصدير.';
    const shown=review.members.filter(p=>peopleMode==='shown'?review.visible.has(p.key):!review.visible.has(p.key));
    const filtered=review.groups.filter(g=>courseMode==='chosen'?count(g.rows)>0:courseMode==='available'?count(g.rows)<g.rows.length:courseMode==='foreign'?g.rows.some(foreign):g.rows.some(r=>r.rank===2||!r.departmentKey));
    body.innerHTML=`<div class="cx-work-grid"><section class="cx-picker" data-section="people"><div class="cx-section-title"><h3>المحاضرون من جدول الفصل</h3></div><div class="cx-switch">${button('people-mode','shown','قائمة المراجعة')}${button('people-mode','other','إضافة من الجدول')}</div><p class="cx-mini-note">✅ حساب مرتبط مؤكد. ❌ الربط غير مؤكد، وليس بالضرورة عدم وجود حساب. قد يتكرر سجل الاسم دون هوية مثبتة.</p>${pager(shown,'people-'+peopleMode,teacher)}${button('restore','','استعادة الأسماء الأصلية')}</section><section class="cx-picker" data-section="courses"><div class="cx-section-title"><h3>المواد المختارة للتصدير</h3></div><div class="cx-switch">${[['chosen','المختارة'],['available','المتاحة للإضافة'],['foreign','المشتركة / قسم آخر'],['review','تحتاج مراجعة القسم']].map(([k,l])=>button('course-mode',k,l)).join('')}</div><p class="cx-mini-note">اسم المادة قد يظهر في مجموعات عرض مستقلة لاختلاف بياناتها. العدد النهائي محسوب بالطروحات الأصلية.</p>${pager(filtered,'courses-'+courseMode,course)}</section>${details()}</div>`;
    body.querySelectorAll('[data-partial="true"]').forEach(e=>e.indeterminate=true);
    body.querySelectorAll('[data-action="people-mode"]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.id===peopleMode));body.querySelectorAll('[data-action="course-mode"]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.id===courseMode));
    dialog.dataset.tab=tab;dialog.querySelectorAll('[data-tab]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.tab===tab));
    if(focusAction)[...body.querySelectorAll('[data-action]')].find(e=>e.dataset.action===focusAction&&e.dataset.id===focusId)?.focus({preventScroll:true});scroller.scrollTop=scroll;download.disabled=busy||!review.selected.size;
   }
   function choose(rows,on){if(on&&rows.some(foreign)){pending=rows.map(r=>r.id);active={type:'course',id:review.groups.find(g=>g.rows.some(r=>r.id===rows[0].id)).key};tab='detail';}else rows.forEach(r=>review.pick(r.id,on));draw();if(pending){body.querySelector('.cx-foreign-warning').focus();}}
   body.addEventListener('change',e=>{if(busy)return;const t=e.target;if(t.dataset.action==='pick')choose([review.rows.get(t.dataset.id)],t.checked);if(t.dataset.action==='group')choose(review.groupMap.get(t.dataset.id).rows,t.checked);});
   dialog.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;draw();scroller.scrollTop=0;});
   body.addEventListener('click',e=>{if(busy)return;const b=e.target.closest('button[data-action]');if(!b)return;let jump=false;switch(b.dataset.action){
    case 'person':active={type:'person',id:b.dataset.id};pending=null;tab='detail';jump=true;break;
    case 'course':active={type:'course',id:b.dataset.id};pending=null;tab='detail';jump=true;break;
    case 'clear':active=null;pending=null;break;
    case 'show':review.showPerson(b.dataset.id,true);break;
    case 'hide':review.showPerson(b.dataset.id,false);break;
    case 'restore':review.restorePeople();pages['people-shown']=0;peopleMode='shown';break;
    case 'people-mode':peopleMode=b.dataset.id;break;
    case 'course-mode':courseMode=b.dataset.id;break;
    case 'page':{const [key,delta]=b.dataset.id.split('|');pages[key]=(pages[key]||0)+Number(delta);break;}
    case 'confirm-foreign':pending?.forEach(id=>review.pick(id,true));pending=null;break;
    case 'cancel-foreign':pending=null;break;
    default:return;
   }draw();if(jump){scroller.scrollTop=0;body.querySelector('.cx-detail h4').setAttribute('tabindex','-1');body.querySelector('.cx-detail h4').focus({preventScroll:true});}});
   draw();
   download.onclick=async()=>{if(busy||!review.selected.size)return;busy=true;download.disabled=true;body.inert=true;download.textContent='جارٍ التحقق وتجهيز الملف…';message.textContent='نراجع المصدر والصلاحيات قبل التنزيل.';
    try{await loadLibrary();const fresh=await read();if(!dialog.isConnected)return;if(fresh.snapshotHash!==model.snapshotHash)throw Error('تغير الجدول أو التكليفات أو الصلاحيات منذ المعاينة. أغلقها وافتحها مرة أخرى؛ لم يُصدَّر ملف قديم.');const result=await root.CITLCourseExcelWorkbook.create(fresh,[...review.selected]);if(!dialog.isConnected)return;
     const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=result.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message.textContent='تم تجهيز '+result.rowCount+' مجموعة عرض تشمل '+result.offeringCount+' طرحًا. لم تتغير بيانات النظام.';
    }catch(e){if(dialog.isConnected)message.textContent=e.message||'تعذر التصدير.';}finally{busy=false;if(dialog.isConnected){body.inert=false;download.textContent='تنزيل نموذج التسكين Excel';download.disabled=!review.selected.size;}}
   };
  }catch(e){if(dialog.isConnected){body.textContent='تعذرت قراءة المعاينة الحالية؛ لم نعرض بيانات قديمة.';message.textContent=e.message||'تعذرت القراءة.';}}
 }

 const api=Object.freeze({open,loadLibrary,createReview,courseKey});if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseExcelExport=api;
})(typeof window==='object'?window:globalThis);
