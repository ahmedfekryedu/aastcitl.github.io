(function(root){
 'use strict';
 const M=root.CITLCourseExcelModel,E=root.CITLCoursesModel.escape;
 let library;
 function loadLibrary(){if(root.ExcelJS)return Promise.resolve();if(library)return library;library=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/exceljs-4.4.0/exceljs.min.js';s.onload=()=>root.ExcelJS?resolve():reject(Error('مكتبة Excel غير متاحة.'));s.onerror=()=>{library=null;s.remove();reject(Error('تعذر تحميل مكتبة Excel المحلية؛ أعد المحاولة.'));};document.head.append(s);});return library;}
 async function open({termId,department}){
  if(!M.departments[department])throw Error('اختر القسم أولًا، ثم افتح تصدير Excel.');
  const dialog=document.createElement('dialog');dialog.className='cm-dialog s135-dialog cx-dialog';
  dialog.innerHTML=`<header><strong>تصدير نموذج التسكين المبسط</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="cm-body"><p class="cx-context"></p><p class="cx-note">هذه معاينة للتصدير فقط. اختيار مادة هنا لا ينقلها لقسم آخر، ولا يعيّن منسقًا، ولا يغيّر جدول الفصل.</p><div data-body><div class="s143-loading" role="status"><strong>جارٍ قراءة مواد الفصل والتكليفات…</strong><div></div><div></div></div></div><p data-message role="status" aria-live="polite"></p><footer class="cx-actions"><button type="button" class="cm-btn" data-download disabled>تنزيل نموذج التسكين المبسط</button><button type="button" class="cm-btn secondary" data-close>إغلاق</button></footer></div>`;
  document.body.append(dialog);dialog.querySelector('.cx-context').textContent=M.departments[department];
  dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.onclose=()=>dialog.remove();dialog.showModal();
  const body=dialog.querySelector('[data-body]'),message=dialog.querySelector('[data-message]'),download=dialog.querySelector('[data-download]');
  const read=()=>M.load({rpc:(name,args)=>root.CITLRequests.rpc(root.sb,name,args),client:root.sb,termId,department});
  let model,selected,busy=false;
  try{
   model=await read();if(!dialog.isConnected)return;selected=new Set(model.rows.filter(r=>r.defaultSelected).map(r=>r.id));
   dialog.querySelector('.cx-context').textContent=model.departmentLabel+' — '+model.term.name;
   body.innerHTML=`<div class="cx-filters"><label>المواد المعروضة<select data-scope><option value="suggested">مواد القسم والمرشحة له</option><option value="all">كل مواد الفصل المتاحة بصلاحياتي</option><option value="unknown">مواد تحتاج تحديد القسم</option><option value="selected">المواد المختارة للملف</option></select></label><label>بحث اختياري<input type="search" data-search placeholder="اسم المادة أو المحاضر أو رموز المجموعات"></label></div><div class="cx-actions"><button class="cm-btn secondary" data-select-visible>تحديد الظاهر</button><button class="cm-btn secondary" data-clear>إلغاء الجميع</button><span data-count></span></div><p class="cx-note">المواد المعتمدة أولًا، ثم الارتباط الحالي، ثم الترشيح من حساب المحاضر. اختيار المرشح غير المسكن لا يعتمد قسمه؛ أكمل القسم واللائحة واللغة في Excel ثم راجع الاستيراد. المادة المعتمدة لقسم آخر لا تُنقل بهذا المسار. البحث لا يضيف مادة من ترم سابق.</p><div class="cx-table" data-table></div><details class="cx-note" data-warnings><summary>ملاحظات المطابقة</summary><ul></ul></details>`;
   const warningBox=body.querySelector('[data-warnings]');warningBox.hidden=!model.warnings.length;warningBox.querySelector('ul').innerHTML=model.warnings.map(w=>`<li>${E(w.name)} — ${E(w.message)}</li>`).join('');
   function visible(){const q=body.querySelector('[data-search]').value.trim().toLowerCase(),scope=body.querySelector('[data-scope]').value;return model.rows.filter(r=>(scope==='all'||scope==='suggested'&&r.rank<3||scope==='unknown'&&!r.departmentKey||scope==='selected'&&selected.has(r.id))&&[r.name,r.displayName,...r.groups,...r.teachersRaw].join(' ').toLowerCase().includes(q));}
   function count(){body.querySelector('[data-count]').textContent=selected.size+' مادة مختارة / '+model.rows.length+' طرحًا متاحًا';download.disabled=busy||!selected.size;}
   function draw(){body.querySelector('[data-table]').innerHTML=`<table class="cm-table"><thead><tr><th>اختيار</th><th>المادة ومجموعاتها</th><th>القسم والمصدر</th><th>اللائحة واللغة</th><th>المحاضرون</th></tr></thead><tbody>${visible().map(r=>`<tr><td><input type="checkbox" data-export-pick="${E(r.id)}" aria-label="اختيار ${E(r.name)}" ${selected.has(r.id)?'checked':''}></td><td><strong>${E(r.displayName||r.name)}</strong>${r.displayName&&r.displayName!==r.name?'<small>نص الجدول الخام: '+E(r.name)+'</small>':''}<small dir="auto">${E(r.groups.join(' / '))}</small></td><td><span class="cx-tag cx-rank-${r.rank}">${E(r.departmentStatus)}</span><small>${E(r.departmentLabel)}</small>${r.rank===2?'<small>مرشح للقسم المختار</small>':''}</td><td>${E(({OLD:'قديمة',NEW:'جديدة'})[r.regulation]||'تحتاج تصنيف')}<small>${E(({ar:'عربي',en:'إنجليزي'})[r.language]||'لغة غير محددة')}</small></td><td>${r.teachersRaw.map(t=>`<div dir="auto">${E(t)}</div>`).join('')||'غير محدد'}${r.notes.length?'<small>'+E(r.notes.join(' · '))+'</small>':''}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد مواد في هذا العرض. جرّب «كل مواد الفصل المتاحة بصلاحياتي».</td></tr>'}</tbody></table>`;
    body.querySelectorAll('[data-export-pick]').forEach(c=>c.onchange=()=>{c.checked?selected.add(c.dataset.exportPick):selected.delete(c.dataset.exportPick);count();});count();}
   body.querySelector('[data-scope]').onchange=draw;body.querySelector('[data-search]').oninput=draw;
   body.querySelector('[data-select-visible]').onclick=()=>{visible().forEach(r=>selected.add(r.id));draw();};body.querySelector('[data-clear]').onclick=()=>{selected.clear();draw();};draw();
   download.onclick=async()=>{
    if(busy||!selected.size)return;busy=true;count();body.querySelectorAll('input,select,button').forEach(e=>e.disabled=true);download.textContent='جارٍ التحقق وتجهيز الملف…';message.textContent='نراجع أن الجدول والتكليفات لم تتغير منذ فتح المعاينة.';
    try{
     const fresh=await read();if(!dialog.isConnected)return;
     if(fresh.snapshotHash!==model.snapshotHash)throw Error('تغير الجدول أو التكليفات أو الصلاحيات منذ المعاينة. أغلقها وافتحها مرة أخرى؛ لم يُصدَّر ملف قديم.');
     await loadLibrary();const result=await root.CITLCourseExcelWorkbook.create(model,[...selected]);if(!dialog.isConnected)return;
     const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=result.filename;a.target='_blank';a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
     message.textContent='تم تجهيز '+result.rowCount+' صفًا مبسطًا يشمل '+result.offeringCount+' طرحًا في ملف القسم. لم تتغير أي بيانات بالنظام؛ استكمال الملف لا يغيّر النظام إلا بعد معاينة الاستيراد واعتماده.';
    }catch(e){if(dialog.isConnected)message.textContent=e.message||'تعذر التصدير. أعد فتح المعاينة.';}finally{busy=false;if(dialog.isConnected){body.querySelectorAll('input,select,button').forEach(e=>e.disabled=false);download.textContent='تنزيل نموذج التسكين المبسط';count();}}
   };
  }catch(e){if(dialog.isConnected){body.textContent='لم نعرض بيانات قديمة أو نتجاوز الصلاحيات.';message.textContent=e.message||'تعذرت قراءة بيانات التصدير؛ أعد فتح المعاينة.';}}
 }
 root.CITLCourseExcelExport=Object.freeze({open,loadLibrary});
})(window);
