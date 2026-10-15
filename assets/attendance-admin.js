(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const allowed=()=>root.CITLPermissions?.full(root.currentUser);
 const api=(action,payload)=>root.amRpc('citl_admin_attendance',{p_action:action,p_payload:payload});
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let key='',serial=0;
 function selected(){return {visitor:root.amSelectedReportVisitor?.(),term:document.getElementById('am-reports-term')?.value};}
 function mount(){
  const summary=document.getElementById('am-report-summary');if(!summary)return;
  const {visitor,term}=selected();let host=document.getElementById('citl-attendance-admin');
  if(!allowed()||!visitor?.profile_id||!term){host?.remove();key='';serial++;return;}
  if(host&&key===visitor.id+':'+term)return;key=visitor.id+':'+term;serial++;
  if(!host){host=document.createElement('section');host.id='citl-attendance-admin';host.className='citl-admin-section';summary.before(host);}
  host.innerHTML='<div class="citl-admin-section-head"><div><h3>تسجيل حضور بواسطة الإدارة</h3><p>للمنتدب المحدد في الترم الحالي. يُحفظ اسم المدير وسبب الإجراء، دون ادعاء مسح QR أو وجوده على شبكة الكلية.</p></div></div><form class="citl-correction-form"><div class="citl-correction-grid"><label>يوم المحاضرة<input name="date" type="date" required max="'+today()+'" value="'+today()+'"></label><label>المحاضرة<select name="session" required><option value="">جاري تحميل المحاضرات…</option></select></label></div><label>سبب التسجيل أو التصحيح<textarea name="reason" required minlength="3" maxlength="1000" rows="2"></textarea></label><div class="citl-correction-actions"><button type="submit" disabled>تسجيل حضور المنتدب</button><button type="button" data-refresh>تحديث المحاضرات</button></div><p data-status role="status"></p></form>';
  const f=host.querySelector('form'),select=f.elements.session,status=f.querySelector('[data-status]'),save=f.querySelector('[type=submit]');let sessions=[],saving=false;
  async function load(){if(saving)return;const turn=++serial;save.disabled=true;status.textContent='جاري قراءة مواعيد المنتدب…';
   try{const data=await api('options',{term_id:term,visitor_id:visitor.id,date:f.elements.date.value});if(turn!==serial)return;sessions=data.sessions;select.replaceChildren(new Option('اختر المحاضرة',''));for(const s of sessions)select.add(new Option(s.course_name+' · '+s.room_name+' · '+s.start_time.slice(0,5)+'–'+s.end_time.slice(0,5)+(s.status==='present'?' · مسجل بالفعل':s.status==='rejected'?' · حضور ملغى إداريًا':''),s.session_id));save.disabled=!sessions.length;status.textContent=sessions.length?'اختر المحاضرة واكتب سبب التسجيل الإداري.':'لا توجد محاضرات قابلة للتحضير لهذا المنتدب في اليوم المحدد؛ لا يُسمح بتحضير محاضرة ملغاة أو لم تبدأ.';}
   catch(error){if(turn===serial){sessions=[];select.replaceChildren(new Option('تعذر تحميل المحاضرات',''));status.textContent=error.message;}}
  }
  f.elements.date.onchange=load;f.querySelector('[data-refresh]').onclick=load;
  f.onsubmit=async event=>{event.preventDefault();if(saving||save.disabled||!f.reportValidity())return;const session=sessions.find(s=>s.session_id===select.value);if(!session)return;saving=true;f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=true);status.textContent='جاري تسجيل الحضور…';
   try{const result=await api('present',{term_id:term,visitor_id:visitor.id,date:f.elements.date.value,session_id:session.session_id,revision:session.revision,reason:f.elements.reason.value.trim()});status.textContent=result.already_saved?'الحضور مسجل بالفعل، لم يتم تكراره.':'تم تسجيل حضور المنتدب وإرسال إشعاره.';root.showNotification?.(status.textContent,'success');await root.amLoadVisitorAttendance();}
   catch(error){status.textContent=error.message;}finally{saving=false;f.querySelectorAll('button,input,select,textarea').forEach(x=>x.disabled=false);}
  };load();
 }
 async function cancel(scan,button){
  if(!allowed())return;const {visitor,term}=selected();if(!visitor)return;
  const reason=await root.CITLRegistrationCorrection.rejectionReason({title:'إلغاء تسجيل حضور المنتدب',description:'سيُلغى احتساب هذا الحضور فقط، وتظل المحاضرة نفسها وسجل التصحيح محفوظين. اكتب السبب لإظهاره للمنتدب.',confirmText:'إلغاء احتساب الحضور'});if(!reason)return;
  button.disabled=true;
  try{await api('cancel',{term_id:term,visitor_id:visitor.id,scan_id:scan.id,revision:scan.revision,reason});root.showNotification?.('تم إلغاء احتساب الحضور مع حفظ سجل التصحيح.','success');await root.amLoadVisitorAttendance();}
  catch(error){root.showNotification?.(error.message,'error');button.disabled=false;}
 }
 function decorate(row,scan){
  const last=row.lastElementChild;if(!last)return;
  if(scan.status==='rejected'){last.textContent='ملغى إداريًا';row.style.opacity='.7';}
  else if(scan.recording_source==='admin')last.textContent='تسجيل إداري';
  if(scan.admin_reason){const note=document.createElement('small');note.style.display='block';note.textContent=scan.admin_reason;last.append(note);}
  if(allowed()&&scan.status!=='rejected'){const button=document.createElement('button');button.type='button';button.className='citl-ac-button secondary';button.textContent='إلغاء الحضور';button.style.marginTop='6px';button.onclick=()=>cancel(scan,button);last.append(button);}
 }
 root.CITLAttendanceAdmin=Object.freeze({mount,decorate});
})(window);
