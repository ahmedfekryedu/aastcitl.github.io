(function(root){'use strict';
 const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sections={'energy-logistics':{name:'قسم إدارة لوجستيات الطاقة والبترول',pages:[1,2,3]},'transport-logistics':{name:'قسم إدارة لوجستيات النقل',pages:[4,5,6,7]},'trade-logistics':{name:'قسم إدارة لوجستيات التجارة الدولية',pages:[8,9,10,11,12]},'supply-chain':{name:'قسم إدارة لوجستيات سلاسل الإمداد',pages:[13,14,15]}};
 const source='/references/SDG_All_Departments.pdf';
 function mount(host,data){
  host.querySelector('[data-sdg-companion]')?.remove();
  const owner=data.reference?.owner_department,faculty=data.identity?.faculty_department;
  const initial=sections[owner]?owner:sections[faculty]?faculty:'';
  const wrap=document.createElement('div');wrap.dataset.sdgCompanion='';
  wrap.innerHTML=`<button type="button" class="sdgc-float" aria-haspopup="dialog" aria-controls="sdgc-dialog" aria-expanded="false"><span aria-hidden="true">▤</span> مرجع التنمية المستدامة</button><dialog id="sdgc-dialog" class="sdgc-dialog" aria-labelledby="sdgc-title" aria-describedby="sdgc-help" dir="rtl"><header class="sdgc-header"><div><h2 id="sdgc-title">التنمية المستدامة — مرجع الاستيفاء</h2><p dir="auto">${E(data.offering?.course_name||'')}</p></div><button type="button" class="sdgc-close" aria-label="إغلاق المرجع والعودة للاستيفاء">×</button></header><div class="sdgc-controls"><p id="sdgc-help">صفحات الملف الأصلي بنفس ترتيبها وتنسيقها. استرشد بها ثم سجّل ما طبّقته بنفسك في السؤال 26؛ فتح المرجع لا يغيّر إجابتك.</p><label>عرض مرجع القسم<select data-sdgc-department><option value="">اختر القسم</option>${Object.entries(sections).map(([k,v])=>`<option value="${k}">${E(v.name)}</option>`).join('')}</select></label><p class="sdgc-context">${sections[owner]?'بدأ العرض بالقسم المالك للمقرر.':sections[faculty]?'قسم المقرر غير محسوم؛ بدأ العرض بقسم المحاضر للاستدلال فقط.':'قسم المقرر غير محدد؛ اختر القسم لعرض مرجعه.'} تغيير القسم هنا يغيّر العرض فقط.</p><div class="sdgc-pager"><button type="button" data-sdgc-prev aria-label="الصفحة السابقة">السابق</button><label>صفحة المصدر<select data-sdgc-page></select></label><button type="button" data-sdgc-next aria-label="الصفحة التالية">التالي</button><button type="button" data-sdgc-zoom aria-pressed="false">تكبير</button></div><a data-sdgc-pdf href="${source}" target="_blank" rel="noopener">فتح الملف الأصلي كاملًا ↗</a></div><div class="sdgc-view" tabindex="0" aria-label="صفحة المرجع، يمكن التمرير عند التكبير"><p class="sdgc-status" role="status"></p><img class="sdgc-page-image" hidden alt=""><details class="sdgc-text"><summary>نص الصفحة للبحث والقراءة</summary><pre dir="auto"></pre></details></div><footer class="sdgc-footer"><span data-sdgc-position></span><button type="button" data-sdgc-return>العودة إلى الاستيفاء</button></footer></dialog>`;
  host.append(wrap);
  const dialog=wrap.querySelector('dialog'),button=wrap.querySelector('.sdgc-float'),department=wrap.querySelector('[data-sdgc-department]'),page=wrap.querySelector('[data-sdgc-page]'),img=wrap.querySelector('img'),view=wrap.querySelector('.sdgc-view'),status=wrap.querySelector('.sdgc-status'),text=wrap.querySelector('pre');
  const previous=wrap.querySelector('[data-sdgc-prev]'),next=wrap.querySelector('[data-sdgc-next]'),zoom=wrap.querySelector('[data-sdgc-zoom]');
  let generation=0,loaded=false,returnTo=null;
  department.value=initial;
  function draw(){
   const n=Number(page.value),pages=sections[department.value]?.pages||[],index=pages.indexOf(n),version=++generation;
   previous.disabled=index<=0;next.disabled=index<0||index===pages.length-1;zoom.disabled=index<0;
   wrap.querySelector('[data-sdgc-position]').textContent=index<0?'اختر القسم أولًا':`صفحة ${index+1} من ${pages.length} للقسم · صفحة ${n} في الملف`;
   wrap.querySelector('[data-sdgc-pdf]').href=source+(index<0?'':'#page='+n);
   img.hidden=true;img.onload=null;img.onerror=null;img.removeAttribute('src');text.textContent='';
   view.classList.remove('sdgc-zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='تكبير';view.scrollTop=0;view.scrollLeft=0;
   if(index<0){status.textContent='اختر القسم لعرض صفحاته الأصلية.';return;}
   status.textContent='جارٍ تحميل صفحة المرجع…';img.alt=`صفحة ${n} من المرجع الأصلي — ${sections[department.value].name}`;
   img.onload=()=>{if(version!==generation)return;img.hidden=false;status.textContent='';};
   img.onerror=()=>{if(version!==generation)return;status.textContent='تعذر تحميل صورة الصفحة. افتح الملف الأصلي من الرابط أعلاه أو أعد اختيار الصفحة.';};
   img.src='/references/sdg-pages/page-'+n+'.webp';
   fetch('/references/sdg-pages/page-'+n+'.txt').then(r=>{if(!r.ok)throw Error('missing');return r.text();}).then(t=>{if(version===generation)text.textContent=t;}).catch(()=>{if(version===generation)text.textContent='النص غير متاح؛ استخدم الملف الأصلي.';});
  }
  function choose(){const pages=sections[department.value]?.pages||[];page.innerHTML=pages.map(n=>`<option value="${n}">${n}</option>`).join('');page.disabled=!pages.length;draw();}
  department.onchange=choose;page.onchange=draw;
  previous.onclick=()=>{page.selectedIndex--;draw();};next.onclick=()=>{page.selectedIndex++;draw();};
  zoom.onclick=()=>{const active=view.classList.toggle('sdgc-zoomed');zoom.setAttribute('aria-pressed',String(active));zoom.textContent=active?'ملاءمة العرض':'تكبير';};
  function show(from){returnTo=from||button;if(!loaded){choose();const linked=(data.sdg||[]).map(x=>Number(x.source_page)).find(n=>sections[department.value]?.pages.includes(n));if(linked&&page.value!==String(linked)){page.value=String(linked);draw();}loaded=true;}dialog.showModal();button.setAttribute('aria-expanded','true');}
  button.onclick=()=>show(button);
  wrap.querySelector('.sdgc-close').onclick=()=>dialog.close();wrap.querySelector('[data-sdgc-return]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');if(returnTo?.isConnected)returnTo.focus({preventScroll:true});});
  const inline=host.querySelector('#p2-sdg-open');if(inline)inline.onclick=()=>show(inline);
  return {open:()=>show(button)};
 }
 root.CITLSDGCompanion={mount};
})(window);
