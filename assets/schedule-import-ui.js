(function(root){
 'use strict';
 const M=root.CITLScheduleImport,$=id=>document.getElementById(id);
 let client,snapshot,rows=[],busy=false,page=0,pdfResult=null,conversion=null,pendingPayload=null;
 const message=(text,error=false)=>{$('schedule-import-status').textContent=text;$('schedule-import-status').className=error?'warning':'summary-box';};
 const kind=()=>$('schedule-kind').value;
 async function api(action,payload={}){
  const {data,error}=await client.rpc('citl_schedule_admin',{p_action:action,p_payload:payload});
  if(error){if(['PGRST202','42883'].includes(error.code))throw Error('طبّق تحديثات إدارة الجداول في Supabase ثم حدّث الصفحة');if(/requires a WHERE clause/i.test(error.message||''))throw Error('يلزم تطبيق ملف 202609210004_schedule_delete_archive_fix.sql لإصلاح الحذف وتحديث فترات الإيقاف. لم تُعتمد العملية.');if(error.code==='23503'&&/schedule_report_batch_items/.test(error.message||''))throw Error('يلزم تطبيق ملف 202609210005_schedule_report_history_fix.sql لحفظ التقارير قبل مسح الجدول. لم تُعتمد العملية.');throw Object.assign(Error(error.message||'تعذر حفظ الجدول'),{code:error.code});}return data;
 }
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function download(name,data){const a=el('a','');a.href=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 function reset(){if(conversion)conversion.abort();rows=[];page=0;pdfResult=null;$('schedule-pdf-review').hidden=true;$('schedule-file').value='';$('schedule-preview').replaceChildren();$('schedule-publish').disabled=true;message('اختر الترم وتاريخ البداية ثم ملف الجداول.');}
 function dates(){
  const t=snapshot?.terms.find(t=>t.id===$('schedule-term').value);
  for(const k of ['name','starts_on']){$('schedule-'+k).value=t?.[k]||'';$('schedule-'+k).readOnly=kind()==='exam'&&!!t;}
  $('schedule-clear').disabled=!t||busy;$('schedule-publish').textContent=t?'تحديث جدول الترم':'رفع الجدول';
 }
 async function load(){
  try{
   snapshot=await api('snapshot');if(snapshot.api_version!==4)throw Error('شغّل ملف 202609210006_simple_term_management.sql ثم حدّث الصفحة لتفعيل إدارة الترم المبسطة.');const select=$('schedule-term'),selected=select.value;select.replaceChildren(new Option('إضافة ترم جديد',''));
   snapshot.terms.forEach(t=>select.add(new Option(t.name+(t.is_active?' • نشط':''),t.id)));select.value=snapshot.terms.some(t=>t.id===selected)?selected:'';dates();
   $('schedule-current').textContent=`الموجود حاليًا: ${snapshot.study.rows.length} حصة دراسية، ${snapshot.exam.rows.length} امتحان. رفع ملف جديد يحدّث جدول النوع المختار، مع حفظ التقارير والحضور السابق.`;
   renderPauses();
   const box=$('schedule-archives');box.replaceChildren();snapshot.archives.forEach(a=>{
    const button=el('button',`${a.kind==='study'?'دراسة':'امتحانات'} — ${a.row_count} صف — ${new Date(a.archived_at).toLocaleString('ar-EG')}`);button.type='button';button.className='secondary';
    button.onclick=async()=>{button.disabled=true;try{download(`CITL-${a.kind}-${a.id}.json`,JSON.stringify(await api('archive',{id:a.id}),null,2));}catch(e){message(e.message,true);}finally{button.disabled=false;}};
    const item=el('div','');item.className='schedule-archive-item';
    const remove=el('button','حذف النسخة');remove.type='button';remove.className='danger';remove.dataset.archiveId=a.id;
    remove.setAttribute('aria-label',`حذف نسخة ${a.kind==='study'?'الدراسة':'الامتحانات'} بتاريخ ${new Date(a.archived_at).toLocaleString('ar-EG')}`);
    remove.onclick=()=>confirmArchiveDelete(a);item.append(button,remove);box.append(item);
   });
   if(!snapshot.archives.length)box.append(el('p','لا توجد نسخ أرشيفية.'));
   $('schedule-file').disabled=false;dates();return true;
  }catch(e){snapshot=null;$('schedule-file').disabled=true;$('schedule-clear').disabled=true;$('schedule-publish').disabled=true;message(e.message,true);return false;}
 }
 function preview(){
  const box=$('schedule-preview');box.replaceChildren();const table=el('table',''),tr=el('tr','');
  ['#','المادة','المحاضر','القاعة',kind()==='study'?'اليوم والتوقيت':'التاريخ والتوقيت'].forEach(x=>tr.append(el('th',x)));table.append(tr);
  rows.slice(page*50,page*50+50).forEach((r,j)=>{
   const row=el('tr','');[page*50+j+1,r.course_name,r.instructor,r.room_name,kind()==='study'?`${M.ar[M.days.indexOf(r.day_of_week)]} • ${r.time_slot}`:`${r.exam_date} • ${r.start_time} – ${r.end_time}`].forEach(v=>row.append(el('td',v)));
   table.append(row);
  });box.append(table);
  const controls=el('div','');controls.className='actions';const prev=el('button','السابق'),next=el('button','التالي');for(const b of [prev,next]){b.className='secondary';b.type='button';}
  prev.disabled=page===0;next.disabled=(page+1)*50>=rows.length;prev.onclick=()=>{page--;preview();};next.onclick=()=>{page++;preview();};controls.append(prev,el('span',`صفحة ${page+1} / ${Math.ceil(rows.length/50)}`),next);box.append(controls);summary();
 }
 function summary(){
  const change=M.changes(snapshot[kind()].rows,rows,kind(),$('schedule-term').value);
  message(`${rows.length} صف جاهز للمعاينة — ${change.retained} دون تغيير، ${change.added} جديد أو معدل، ${change.removed} صف سيُستبدل أو يُزال من الجدول الحالي. اضغط رفع الجدول لتأكيد النشر. التحديث لا يكرر الحصص ولا يمسح الحضور السابق.`);
  $('schedule-publish').disabled=!rows.length||busy;
 }
 function term(){const selected=snapshot?.terms.find(t=>t.id===$('schedule-term').value);return {id:selected?.id||null,name:$('schedule-name').value,starts_on:$('schedule-starts_on').value,ends_on:selected?.ends_on||null};}
 function confirm(action){
  if(busy||conversion||!snapshot)return;
  if(action==='term.delete'){
   const t=snapshot.terms.find(t=>t.id===$('schedule-term').value);if(!t)return message('اختر الترم المطلوب حذفه أولًا',true);
   pendingPayload={id:t.id,term_revision:t.revision,revisions:{study:snapshot.study.revision,exam:snapshot.exam.revision},confirm:'CONFIRM'};
   $('schedule-confirm').dataset.action=action;
   const studyCount=snapshot.study.rows.filter(r=>r.term_id===t.id).length,examCount=snapshot.exam.rows.filter(r=>r.term_id===t.id).length;
   $('schedule-confirm-text').textContent=`حذف الترم «${t.name}» وجداوله: ${studyCount} حصة دراسية و${examCount} امتحان مرتبط بهذا الترم. سيختفي من قائمة الرفع، وتبقى تقارير الحضور السابقة ونسخة الجداول محفوظة. القاعات والمواد التابعة لترم آخر لن تُحذف.`;
   $('schedule-confirm').showModal();return;
  }
  if(action!=='clear'){
   if(!$('schedule-import-form').reportValidity())return;
   if(!rows.length)return message('اختر ملف الجداول أولًا',true);

  }
  if(kind()==='exam'&&$('schedule-exam-pause').checked&&action!=='clear'&&(!$('schedule-exam-from').value||!$('schedule-exam-to').value))return message('حدد بداية ونهاية الامتحانات',true);
  const d=$('schedule-confirm');d.dataset.action=action;
  pendingPayload={kind:kind(),term:term(),rows:rows,revision:snapshot[kind()].revision,confirm:'CONFIRM',pause:{is_active:$('schedule-exam-pause').checked,starts_on:$('schedule-exam-from').value,ends_on:$('schedule-exam-to').value}};
  const change=M.changes(snapshot[kind()].rows,rows,kind(),$('schedule-term').value);
  $('schedule-confirm-text').textContent=`نشر ${rows.length} صف في ${kind()==='study'?'الجدول الدراسي':'جدول الامتحانات'} للترم «${term().name||'ترم يبدأ '+term().starts_on}». البداية: ${term().starts_on}. ${change.retained} دون تغيير، ${change.added} جديد أو معدل، ${change.removed} صف يُستبدل. تقارير الحضور محفوظة. هل تؤكد نشر المعاينة؟`;
  if(kind()==='exam'&&$('schedule-exam-pause').checked)$('schedule-confirm-text').textContent+=` إيقاف الدراسة من ${$('schedule-exam-from').value} إلى ${$('schedule-exam-to').value}.`;
  d.showModal();
 }
 async function save(){
  if(busy)return;busy=true;const button=$('schedule-confirm-save');button.disabled=true;button.textContent='جارٍ الحفظ…';$('schedule-confirm-cancel').disabled=true;
  // Capture all reviewed values before the request. Never automatically retry a mutation.
  const action=$('schedule-confirm').dataset.action,payload=pendingPayload;
  try{
   const result=await api(action,payload);
   if(action==='replace'){$('schedule-term').add(new Option('',result.term_id));$('schedule-term').value=result.term_id;}
   if(action==='term.delete')$('schedule-term').value='';
   if(action!=='archive.delete')reset();const refreshed=await load();
   if(!refreshed){message('تمت العملية، لكن تعذر تحديث القائمة الآن. اضغط تحديث القائمة؛ لا تعِد الحفظ أو الحذف.',true);return;}
   message(action==='archive.delete'?'تم حذف نسخة الأرشيف المحددة نهائيًا.':action==='term.delete'?'تم حذف الترم المحدد وجداوله وإزالته من القائمة. تقارير الحضور محفوظة.':action==='pause.save'?'تم تحديث فترة إيقاف الدراسة.':`تم الحفظ بنجاح: ${result.count} صف. الجدول متاح الآن في النظام.`);
   if(action!=='archive.delete'){localStorage.setItem('citl-schedule-update',String(Date.now()));root.dispatchEvent(new Event('citl-schedule-update'));}
  }
  catch(e){const network=e.name==='TypeError'||e.name==='AbortError'||/fetch|network|timeout|timed out|انقطع|اتصال/i.test(e.message||'');message(e.message+(network?' — حدّث البيانات للتأكد من نتيجة العملية قبل إعادة المحاولة.':''),true);}
  finally{busy=false;button.disabled=false;button.textContent='تأكيد العملية';$('schedule-confirm-cancel').disabled=false;$('schedule-confirm').close();$('schedule-clear').disabled=!snapshot?.terms.some(t=>t.id===$('schedule-term').value);}
 }
 function confirmArchiveDelete(archive){
  if(busy||conversion||!snapshot)return;
  pendingPayload={id:archive.id,confirm:'CONFIRM'};$('schedule-confirm').dataset.action='archive.delete';
  $('schedule-confirm-text').textContent=`حذف نهائي لنسخة ${archive.kind==='study'?'الدراسة':'الامتحانات'} المؤرخة ${new Date(archive.archived_at).toLocaleString('ar-EG')} (${archive.row_count} صف). لن يمكنك استرجاع هذه النسخة بعد حذفها. الجدول الحالي وسجلات الحضور لا يتغيران. يمكنك الرجوع وتنزيل النسخة قبل حذفها.`;
  $('schedule-confirm').showModal();
 }
 function confirmPause(pause){
  if(busy||conversion||!snapshot)return;if(pause.ends_on<pause.starts_on)return message('نهاية الفترة تسبق بدايتها',true);
  pendingPayload={pause,confirm:'CONFIRM'};$('schedule-confirm').dataset.action='pause.save';
  $('schedule-confirm-text').textContent=`${pause.is_active?'تفعيل':'إلغاء'} إيقاف الدراسة من ${pause.starts_on} إلى ${pause.ends_on}. ${pause.reason}. لن يتم حذف الجدول أو الحضور.`;$('schedule-confirm').showModal();
 }
 function renderPauses(){const box=$('schedule-pauses');box.replaceChildren();(snapshot.pauses||[]).forEach(p=>{
  const card=el('div','');card.className='card';card.append(el('span',`${p.reason} • ${p.starts_on} ← ${p.ends_on} • ${p.is_active?'مفعّل':'غير مفعّل'}`));
  const toggle=el('button',p.is_active?'إلغاء الإيقاف':'تفعيل الإيقاف');toggle.className='secondary';toggle.type='button';toggle.onclick=()=>confirmPause({...p,is_active:!p.is_active});card.append(toggle);box.append(card);
 });}
 function init(sb){client=sb;
  $('schedule-kind').onchange=()=>{if(conversion)conversion.abort();reset();dates();$('schedule-exam-options').hidden=kind()!=='exam';};
  $('schedule-term').onchange=()=>{dates();if(rows.length)summary();};
  $('schedule-file').onchange=async()=>{
   const files=Array.from($('schedule-file').files);if(!files.length)return;rows=[];pdfResult=null;$('schedule-pdf-review').hidden=true;$('schedule-publish').disabled=true;
   const controller=new AbortController();conversion=controller;
   for(const id of ['schedule-kind','schedule-term','schedule-name','schedule-starts_on','schedule-exam-year','schedule-reload','schedule-clear','schedule-file'])$(id).disabled=true;
   try{

    if(files.every(f=>/\.pdf$/i.test(f.name))){
     $('schedule-cancel-conversion').hidden=false;$('schedule-file').disabled=true;
     const result=await root.CITLPdfSchedule.convert(files,kind(),{year:Number($('schedule-exam-year').value),signal:controller.signal,stage:t=>message(t)});
     if(controller.signal.aborted)return;pdfResult=result;rows=M.parse(result.sql,'sql',kind());
     if(rows.length!==result.count)throw Error('عدد الصفوف لا يطابق تقرير المحرك؛ لم يُعتمد الملف');
     $('schedule-pdf-review').hidden=false;
     $('schedule-pdf-result').textContent=`استُخرج ${result.count} صف؛ ${result.skipped} سطر متخطى. يمكنك مراجعة الجدول أدناه قبل النشر.`;
     if(result.skipped)throw Error('يوجد سطور لم يقرأها محرك البرنامج؛ راجع التقرير وأصلح الملف قبل النشر');
     const report=result.reports['validation_report.txt'];if(report&&!report.includes('No structural validation issues detected.'))throw Error('محرك البرنامج أبلغ عن مشكلات في البيانات؛ راجع تقرير التحويل قبل الرفع');
    }else{
     if(files.length!==1)throw Error('اختر ملف SQL أو CSV أو JSON واحدًا');const f=files[0];if(f.size>12*1024*1024)throw Error('الحد الأقصى 12 MB');rows=M.parse(await f.text(),f.name.split('.').pop().toLowerCase(),kind());
    }
    page=0;preview();
   }catch(e){rows=[];message(e.message,true);$('schedule-preview').replaceChildren();}
   finally{if(conversion===controller){conversion=null;$('schedule-cancel-conversion').hidden=true;for(const id of ['schedule-kind','schedule-term','schedule-name','schedule-starts_on','schedule-exam-year','schedule-reload','schedule-file'])$(id).disabled=false;$('schedule-clear').disabled=!snapshot?.terms.some(t=>t.id===$('schedule-term').value);}}
  };
  $('schedule-cancel-conversion').onclick=()=>conversion?.abort();
  $('schedule-download-sql').onclick=()=>pdfResult&&download(`CITL-${kind()}-extracted.sql`,pdfResult.sql);
  $('schedule-download-report').onclick=()=>pdfResult&&download('CITL-extraction-report.json',JSON.stringify(pdfResult.reports,null,2));

  $('schedule-pause-form').onsubmit=e=>{e.preventDefault();confirmPause({starts_on:$('schedule-pause-from').value,ends_on:$('schedule-pause-to').value,reason:$('schedule-pause-reason').value,is_active:true});};
  $('schedule-clear').onclick=()=>confirm('term.delete');$('schedule-import-form').onsubmit=e=>{e.preventDefault();confirm('replace');};
  $('schedule-confirm-save').onclick=save;$('schedule-confirm-cancel').onclick=()=>{if(!busy)$('schedule-confirm').close();};
  $('schedule-confirm').addEventListener('click',e=>{if(e.target===e.currentTarget&&!busy)e.currentTarget.close();});$('schedule-confirm').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('schedule-reload').onclick=async()=>{if(busy)return;reset();await load();};

  load();
 }
 root.CITLScheduleImportUI=Object.freeze({init});
})(window);
