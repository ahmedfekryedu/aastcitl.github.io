(function(root){
 'use strict';
 const M=root.CITLScheduleImport,$=id=>document.getElementById(id);
 let client,snapshot,rows=[],operation='replace',busy=false,page=0,pdfResult=null,conversion=null,pendingPayload=null;
 const message=(text,error=false)=>{$('schedule-import-status').textContent=text;$('schedule-import-status').className=error?'warning':'summary-box';};
 const kind=()=>$('schedule-kind').value;
 async function api(action,payload={}){
  const {data,error}=await client.rpc('citl_schedule_admin',{p_action:action,p_payload:payload});
  if(error){if(['PGRST202','42883'].includes(error.code))throw Error('طبّق ملف 202609200003_schedule_terms.sql مرة واحدة لتفعيل إدارة الجداول');throw Error(error.message||'تعذر حفظ الجدول');}return data;
 }
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function download(name,data){const a=el('a','');a.href=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
 function reset(){if(conversion)conversion.abort();rows=[];page=0;pdfResult=null;$('schedule-pdf-review').hidden=true;$('schedule-reviewed').checked=false;$('schedule-file').value='';$('schedule-preview').replaceChildren();$('schedule-publish').disabled=true;message('اختر الملف ثم راجع المعاينة والتواريخ قبل الحفظ.');}
 function dates(){
  const t=snapshot?.terms.find(t=>t.id===$('schedule-term').value);
  for(const k of ['code','name','starts_on','ends_on']){$('schedule-'+k).value=t?.[k]||'';$('schedule-'+k).readOnly=kind()==='exam'&&!!t;}
 }
 async function load(){
  try{
   snapshot=await api('snapshot');const select=$('schedule-term'),selected=select.value;select.replaceChildren(new Option('ترم جديد — اختر التواريخ',''));
   snapshot.terms.forEach(t=>select.add(new Option(t.name+(t.is_active?' • نشط':''),t.id)));select.value=selected;
   $('schedule-current').textContent=`الموجود حاليًا: ${snapshot.study.rows.length} حصة دراسية، ${snapshot.exam.rows.length} امتحان. الاستبدال أو المسح يشمل جدول النوع المختار بالكامل؛ نسخة الأرشيف والحضور محفوظة.`;
   renderPauses();
   const box=$('schedule-archives');box.replaceChildren();snapshot.archives.forEach(a=>{
    const button=el('button',`${a.kind==='study'?'دراسة':'امتحانات'} — ${a.row_count} صف — ${new Date(a.archived_at).toLocaleString('ar-EG')}`);button.type='button';button.className='secondary';
    button.onclick=async()=>{button.disabled=true;try{download(`CITL-${a.kind}-${a.id}.json`,JSON.stringify(await api('archive',{id:a.id}),null,2));}catch(e){message(e.message,true);}finally{button.disabled=false;}};box.append(button);
   });
   $('schedule-file').disabled=false;$('schedule-bind').disabled=false;$('schedule-clear').disabled=false;
  }catch(e){message(e.message,true);}
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
  message(`${rows.length} صف جاهز للمعاينة — ${change.retained} دون تغيير، ${change.added} جديد أو معدل، ${change.removed} صف سيُستبدل أو يُزال من الجدول الحالي. ${operation==='bind'?'سيتم ربط الصفوف الحالية بالتواريخ دون تغيير معرفاتها.':'الصفوف المطابقة لنفس الترم تحتفظ بمعرّفاتها وحضورها؛ التغييرات تُطبق بعد التأكيد.'}`);
  $('schedule-publish').disabled=!rows.length||busy;
 }
 function term(){const t={id:$('schedule-term').value||null};for(const k of ['code','name','starts_on','ends_on'])t[k]=$('schedule-'+k).value;return t;}
 function confirm(action){
  if(busy||conversion||!snapshot)return;
  if(action!=='clear'){
   if(!$('schedule-import-form').reportValidity())return;
   if(!rows.length)return message('اختر ملف الجداول أولًا',true);
   const t=term();if(t.ends_on<t.starts_on)return message('راجع ترتيب تواريخ الترم ',true);
  }
  if(pdfResult&&!$('schedule-reviewed').checked&&action!=='clear')return message('راجع نتيجة التحويل وحدد الموافقة على المعاينة أولًا',true);
  if(kind()==='exam'&&$('schedule-exam-pause').checked&&action!=='clear'&&(!$('schedule-exam-from').value||!$('schedule-exam-to').value))return message('حدد بداية ونهاية الامتحانات',true);
  const d=$('schedule-confirm');d.dataset.action=action;pendingPayload=null;
  $('schedule-confirm-text').textContent=action==='clear'?`سيتم مسح كل ${snapshot[kind()].rows.length} صف من ${kind()==='study'?'الجداول الدراسية':'جداول الامتحانات'} الحالية. سيتم حفظ نسخة أرشيفية والإبقاء على سجلات الحضور. تأكد أن هذا هو النوع المطلوب.`:
   `${action==='bind'?'ربط':'نشر واستبدال'} ${rows.length} صف. ${term().name}: ${term().starts_on} إلى ${term().ends_on}${kind()==='study'?`. سيصبح هذا الترم هو النشط للحضور.`:'. توقيتات الامتحانات وعرض اليوم فقط محفوظان.'}`;
  if(kind()==='exam'&&$('schedule-exam-pause').checked&&action!=='clear')$('schedule-confirm-text').textContent+=` إيقاف الدراسة من ${$('schedule-exam-from').value} إلى ${$('schedule-exam-to').value}.`;
  if(action==='replace'){const change=M.changes(snapshot[kind()].rows,rows,kind(),$('schedule-term').value);$('schedule-confirm-text').textContent+=` ${change.retained} دون تغيير؛ ${change.added} جديد أو معدل؛ ${change.removed} يُزال من الجدول الحالي مع حفظ التاريخ.`;}
  d.showModal();
 }
 async function save(){
  if(busy)return;busy=true;const button=$('schedule-confirm-save');button.disabled=true;button.textContent='جارٍ الحفظ…';$('schedule-confirm-cancel').disabled=true;
  // Capture all reviewed values before the request. Never automatically retry a mutation.
  const action=$('schedule-confirm').dataset.action,payload=pendingPayload||{kind:kind(),term:term(),rows:rows,revision:snapshot[kind()].revision,confirm:'CONFIRM',pause:{is_active:$('schedule-exam-pause').checked,starts_on:$('schedule-exam-from').value,ends_on:$('schedule-exam-to').value}};
  try{const result=await api(action,payload);reset();await load();message(action==='pause.save'?'تم تحديث فترة إيقاف الدراسة.':`تم الحفظ: ${result.count} صف؛ ${result.retained||0} دون تغيير، ${result.added||0} جديد أو معدل. النسخة السابقة في الأرشيف.`);localStorage.setItem('citl-schedule-update',String(Date.now()));root.dispatchEvent(new Event('citl-schedule-update'));}
  catch(e){message(e.message+' — إذا انقطع الاتصال أثناء الحفظ، حدّث البيانات للتأكد قبل إعادة المحاولة.',true);}
  finally{busy=false;button.disabled=false;button.textContent='تأكيد العملية';$('schedule-confirm-cancel').disabled=false;$('schedule-confirm').close();}
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
   const files=Array.from($('schedule-file').files);if(!files.length)return;rows=[];pdfResult=null;$('schedule-reviewed').checked=false;$('schedule-pdf-review').hidden=true;$('schedule-publish').disabled=true;
   const controller=new AbortController();conversion=controller;
   try{
    operation='replace';
    if(files.every(f=>/\.pdf$/i.test(f.name))){
     $('schedule-cancel-conversion').hidden=false;$('schedule-file').disabled=true;
     const result=await root.CITLPdfSchedule.convert(files,kind(),{year:Number($('schedule-exam-year').value),signal:controller.signal,stage:t=>message(t)});
     if(controller.signal.aborted)return;pdfResult=result;rows=M.parse(result.sql,'sql',kind());
     if(rows.length!==result.count)throw Error('عدد الصفوف لا يطابق تقرير المحرك؛ لم يُعتمد الملف');
     $('schedule-pdf-review').hidden=false;
     $('schedule-pdf-result').textContent=`استُخرج ${result.count} صف بنفس محرك البرنامج؛ ${result.skipped} سطر امتحان متخطى. راجع المعاينة والتقرير قبل الحفظ.`;
     if(result.skipped)throw Error('يوجد سطور لم يقرأها محرك البرنامج؛ راجع التقرير وأصلح الملف قبل النشر');
     const report=result.reports['validation_report.txt'];if(report&&!report.includes('No structural validation issues detected.'))throw Error('محرك البرنامج أبلغ عن مشكلات في البيانات؛ راجع تقرير التحويل قبل الرفع');
    }else{
     if(files.length!==1)throw Error('اختر ملف SQL أو CSV أو JSON واحدًا');const f=files[0];if(f.size>12*1024*1024)throw Error('الحد الأقصى 12 MB');rows=M.parse(await f.text(),f.name.split('.').pop().toLowerCase(),kind());
    }
    page=0;preview();
   }catch(e){rows=[];message(e.message,true);$('schedule-preview').replaceChildren();}
   finally{if(conversion===controller){conversion=null;$('schedule-cancel-conversion').hidden=true;$('schedule-file').disabled=false;}}
  };
  $('schedule-cancel-conversion').onclick=()=>conversion?.abort();
  $('schedule-download-sql').onclick=()=>pdfResult&&download(`CITL-${kind()}-extracted.sql`,pdfResult.sql);
  $('schedule-download-report').onclick=()=>pdfResult&&download('CITL-extraction-report.json',JSON.stringify(pdfResult.reports,null,2));
  $('schedule-bind').onclick=()=>{if(conversion)return;pdfResult=null;$('schedule-pdf-review').hidden=true;try{operation='bind';rows=M.normalize(snapshot[kind()].rows,kind());page=0;preview();}catch(e){message(e.message,true);}};
  $('schedule-attendance-refresh').onclick=async()=>{
   const termId=$('schedule-term').value;if(!termId)return message('اختر الترم لعرض الحضور والغياب',true);
   const button=$('schedule-attendance-refresh');button.disabled=true;
   try{const {data,error}=await client.rpc('citl_attendance_term_report',{p_term_id:termId});if(error)throw error;
    const table=el('table',''),head=el('tr','');['المنتدب','المحاضرات المنتهية','حضور QR','غياب'].forEach(v=>head.append(el('th',v)));table.append(head);
    data.forEach(r=>{const row=el('tr','');[r.instructor,r.total,r.present,r.absent].forEach(v=>row.append(el('td',v)));table.append(row);});
    $('schedule-attendance').replaceChildren(data.length?table:el('p','لا توجد محاضرات منتهية مؤهلة للاحتساب لهذا الترم.'));
   }catch(e){message(e.message,true);}finally{button.disabled=false;}
  };
  $('schedule-pause-form').onsubmit=e=>{e.preventDefault();confirmPause({starts_on:$('schedule-pause-from').value,ends_on:$('schedule-pause-to').value,reason:$('schedule-pause-reason').value,is_active:true});};
  $('schedule-clear').onclick=()=>confirm('clear');$('schedule-import-form').onsubmit=e=>{e.preventDefault();confirm(operation);};
  $('schedule-confirm-save').onclick=save;$('schedule-confirm-cancel').onclick=()=>{if(!busy)$('schedule-confirm').close();};
  $('schedule-confirm').addEventListener('click',e=>{if(e.target===e.currentTarget&&!busy)e.currentTarget.close();});$('schedule-confirm').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('schedule-reload').onclick=async()=>{if(busy)return;reset();await load();};
  $('schedule-template').onclick=()=>download(`CITL-${kind()}-template.json`,JSON.stringify(kind()==='study'?[{course_name:'اسم المقرر',course_code:'',instructor:'اسم المحاضر',room_name:'G004',day_of_week:'Saturday',time_slot:'08:30 - 09:20',period_order:1}]:[{course_name:'اسم المقرر',instructor:'اسم المحاضر',room_name:'G004',exam_date:'YYYY-MM-DD',start_time:'09:00',end_time:'11:00'}],null,2));
  load();
 }
 root.CITLScheduleImportUI=Object.freeze({init});
})(window);
