(function(root){'use strict';
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections={'energy-logistics':{name:'قسم إدارة لوجستيات الطاقة والبترول',pages:[1,2,3]},'transport-logistics':{name:'قسم إدارة لوجستيات النقل',pages:[4,5,6,7]},'trade-logistics':{name:'قسم إدارة لوجستيات التجارة الدولية',pages:[8,9,10,11,12]},'supply-chain':{name:'قسم إدارة لوجستيات سلاسل الإمداد',pages:[13,14,15]}};
 const source='/references/SDG_All_Departments.pdf',instances=new WeakMap();let cached;
 function reference(){if(!cached)cached=fetch('/assets/course-sdg-reference.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('reference');return r.json();}).then(rows=>{if(!Array.isArray(rows)||rows.some(r=>!sections[r.department]?.pages.includes(r.source_page)))throw Error('reference');return rows;}).catch(e=>{cached=null;throw e;});return cached;}
 function mount(host,data){
  instances.get(host)?.destroy();
  const owner=data.reference?.review_status==='verified'&&sections[data.reference?.owner_department]?data.reference.owner_department:'';
  const wrap=document.createElement('div');wrap.dataset.sdgCompanion='';
  wrap.innerHTML=`<button type="button" class="sdgc-float" aria-controls="sdgc-panel" aria-expanded="false"><span aria-hidden="true">▤</span> مرجع التنمية المستدامة</button><aside id="sdgc-panel" class="sdgc-panel" aria-labelledby="sdgc-title" dir="rtl" hidden><header class="sdgc-header"><div><h2 id="sdgc-title">مرجع التنمية المستدامة</h2><p>${E(data.offering?.course_name||'')}</p></div><button type="button" class="sdgc-close" aria-label="إغلاق المرجع والعودة للاستيفاء">×</button></header><div class="sdgc-content"><p class="sdgc-help">مرجع للقراءة أثناء الاستيفاء. سجّل إجابتك بنفسك في السؤال 26؛ فتح المرجع لا يثبت تطبيق الهدف.</p><p class="sdgc-context"></p><div class="sdgc-controls"><label>القسم<select data-filter="department"><option value="">اختر القسم</option>${Object.entries(sections).map(([k,v])=>`<option value="${k}">${E(v.name)}</option>`).join('')}</select></label><label>المقرر<select data-filter="course"></select></label><label>هدف التنمية المستدامة<select data-filter="goal"></select></label><label>الأسبوع الوارد بالمصدر<select data-filter="week"></select></label></div><div class="sdgc-tools"><button type="button" data-full>عرض جدول القسم كاملًا</button><a href="${source}" target="_blank" rel="noopener">الملف الأصلي ↗</a></div><p class="sdgc-summary" role="status"></p><div class="sdgc-results"></div></div><footer class="sdgc-footer"><span>التصفية للقراءة فقط؛ لا تغيّر القسم أو الإجابات.</span><button type="button" data-return>العودة إلى الاستيفاء</button></footer></aside>`;
  host.append(wrap);
  const panel=wrap.querySelector('aside'),button=wrap.querySelector('.sdgc-float'),content=wrap.querySelector('.sdgc-content'),results=wrap.querySelector('.sdgc-results'),summary=wrap.querySelector('.sdgc-summary'),context=wrap.querySelector('.sdgc-context');
  const filters=Object.fromEntries([...wrap.querySelectorAll('[data-filter]')].map(el=>[el.dataset.filter,el]));filters.department.value=owner;
  let rows=null,loading=false,destroyed=false,opener=button,listScroll=0;
  function options(el,values,label){const value=el.value;el.innerHTML=`<option value="">${E(label)}</option>`+values.map(([v,t])=>`<option value="${E(v)}">${E(t)}</option>`).join('');el.value=values.some(([v])=>String(v)===value)?value:'';}
  function draw(){
   const dept=filters.department.value,all=(rows||[]).filter(r=>r.department===dept);
   options(filters.course,[...new Set(all.map(r=>r.course))].map(v=>[v,v]),'كل مقررات القسم');
   const courses=all.filter(r=>!filters.course.value||r.course===filters.course.value);
   options(filters.goal,[...new Set(courses.map(r=>String(r.goal)))].sort((a,b)=>Number(a)-Number(b)).map(v=>[v,'الهدف '+v]),'كل الأهداف');
   const goals=courses.filter(r=>!filters.goal.value||String(r.goal)===filters.goal.value);
   options(filters.week,[...new Set(goals.flatMap(r=>r.weeks||[]))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(v=>[v,v]),'كل الأسابيع');
   for(const key of ['course','goal','week'])filters[key].disabled=!dept||(key==='week'&&!goals.some(r=>r.weeks?.length));
   wrap.querySelector('[data-full]').disabled=!dept;
   const linked=(data.sdg||[]).some(s=>s.approved_links>0&&all.some(r=>r.id===s.id));
   context.textContent=!dept?'قسم المقرر غير مؤكد؛ اختر القسم لقراءة مرجعه دون تخمين.':dept!==owner?'عرض استرشادي للقسم المختار فقط؛ لا يغيّر ملكية المقرر.':linked?'القسم المالك مؤكد ويوجد ربط مرجعي معتمد. يظهر جدول القسم كاملًا افتراضيًا.':'القسم المالك مؤكد، لكن مطابقة المقرر بمرجع التنمية لم تتأكد. يظهر جدول القسم كاملًا دون ربط بتشابه الاسم.';
   const visible=goals.filter(r=>!filters.week.value||(r.weeks||[]).includes(filters.week.value));
   summary.textContent=dept?`${sections[dept].name} · ${visible.length} سجلًا من ${all.length} · الصفحات ${sections[dept].pages[0]}–${sections[dept].pages.at(-1)}`:'اختر القسم لعرض جدوله.';
   results.innerHTML=!dept?'<p class="sdgc-empty">لا يُستنتج قسم المقرر من قسم المحاضر.</p>':!visible.length?'<p class="sdgc-empty">لا توجد نتائج لهذه الاختيارات. يمكنك عرض جدول القسم كاملًا.</p>':`<table class="sdgc-table"><caption>${E(sections[dept].name)} — بيانات المرجع الأصلي</caption><thead><tr><th>المقرر</th><th>الهدف ورقمه</th><th>الموضوع</th><th>الأسبوع</th><th>ملاحظات</th><th>المصدر</th></tr></thead><tbody>${visible.map(r=>`<tr><td data-label="المقرر"><b dir="auto">${E(r.course)}</b></td><td data-label="الهدف"><strong>${E(r.goal)}</strong><span dir="auto">${E(r.goal_text)}</span></td><td data-label="الموضوع" dir="auto">${E(r.topic||'—')}</td><td data-label="الأسبوع">${E((r.weeks||[]).join('، ')||'غير وارد')}</td><td data-label="ملاحظات">${r.irrelevant?'<b>غير منطبق بحسب المصدر</b>':''}${r.flags?.length?'<span class="sdgc-warning">اختلاف في ترقيم / تسمية الهدف بالمصدر؛ راجع الصفحة الأصلية.</span>':''}${!r.irrelevant&&!r.flags?.length?'—':''}</td><td data-label="المصدر"><button type="button" data-page="${r.source_page}" aria-label="عرض الصفحة الأصلية ${r.source_page}">ص ${r.source_page}</button></td></tr>`).join('')}</tbody></table>`;
   results.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>original(Number(b.dataset.page)));
  }
  function original(n){
   if(!sections[filters.department.value]?.pages.includes(n))return;
   listScroll=content.scrollTop;
   results.innerHTML=`<div class="sdgc-source"><button type="button" data-table>العودة إلى جدول القسم</button><a href="${source}#page=${n}" target="_blank" rel="noopener">صفحة ${n} في PDF ↗</a><p>صورة الصفحة الأصلية ${n} — دون تعديل</p><img src="/references/sdg-pages/page-${n}.webp" alt="صفحة ${n} من مرجع التنمية المستدامة الأصلي"></div>`;
   results.querySelector('[data-table]').onclick=()=>{draw();content.scrollTop=listScroll;};
   results.querySelector('img').onerror=()=>{results.querySelector('p').textContent='تعذر عرض الصورة. استخدم رابط الصفحة في PDF.';};
   content.scrollTop=results.offsetTop-content.offsetTop;
  }
  function layout(on){
   const anchor=[...host.querySelectorAll('.p2-question')].find(el=>el.getBoundingClientRect().bottom>100&&el.getBoundingClientRect().width>0),top=anchor?.getBoundingClientRect().top;
   host.classList.toggle('sdgc-reading',on);
   if(anchor&&innerWidth>=1000)root.scrollBy(0,anchor.getBoundingClientRect().top-top);
  }
  async function show(trigger){
   opener=trigger||button;panel.hidden=false;button.hidden=true;button.setAttribute('aria-expanded','true');layout(true);
   if(rows||loading)return;loading=true;summary.textContent='جارٍ تحميل مرجع الأقسام…';
   try{rows=await reference();if(!destroyed)draw();}catch(e){if(!destroyed){summary.textContent='تعذر تحميل المرجع. لم تُغيَّر إجاباتك.';results.innerHTML='<button type="button" data-retry>إعادة المحاولة</button>';results.querySelector('[data-retry]').onclick=()=>show(opener);}}finally{loading=false;}
  }
  function close(){panel.hidden=true;button.hidden=false;button.setAttribute('aria-expanded','false');layout(false);opener?.focus({preventScroll:true});}
  button.onclick=()=>show(button);wrap.querySelector('.sdgc-close').onclick=close;wrap.querySelector('[data-return]').onclick=close;
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  for(const [key,el]of Object.entries(filters))el.onchange=()=>{if(key==='department')for(const k of ['course','goal','week'])filters[k].value='';draw();};
  wrap.querySelector('[data-full]').onclick=()=>{for(const k of ['course','goal','week'])filters[k].value='';draw();content.scrollTop=0;};
  const inline=host.querySelector('#p2-sdg-open');if(inline)inline.onclick=()=>show(inline);
  const observer=new MutationObserver(()=>{if(!host.contains(wrap))destroy();});observer.observe(host,{childList:true});
  function destroy(){destroyed=true;observer.disconnect();host.classList.remove('sdgc-reading');wrap.remove();if(instances.get(host)===api)instances.delete(host);}
  const api={open:()=>show(button),destroy,element:wrap};instances.set(host,api);return api;
 }
 root.CITLSDGCompanion={mount};
})(window);
