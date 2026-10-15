/* Academic slots have a dedicated form; the meeting form and recurrence remain independent. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const reasons={makeup:'محاضرة تعويضية',revision:'مراجعة قبل الامتحان',extra:'محاضرة إضافية',room_change:'تغيير مؤقت للقاعة',section:'سكشن إضافي',other:'سبب آخر'};
 let active=null;
 async function open(room,date,start,end){
  if(root.CITLServices&&!await root.CITLServices.enter('lecture_booking'))return;
  if(active?.open)return;
  const owner=root.currentUser?.id;if(!owner)return root.showNotification?.('يلزم تسجيل الدخول أولًا','error');
  const d=document.createElement('dialog');active=d;d.id='citl-academic-room-booking';d.className='citl-head-dialog citl-ac-dialog';d.dir='rtl';
  d.innerHTML='<header><strong>حجز قاعة لمحاضرة / سكشن</strong><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-ac-body"><dl class="citl-claim-details"><div><dt>القاعة</dt><dd>'+E(room.name)+'</dd></div><div><dt>التاريخ</dt><dd>'+E(new Date(date+'T12:00:00Z').toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'}))+'</dd></div><div><dt>وقت المحاضرة</dt><dd><bdi>'+E(start)+' – '+E(end)+'</bdi></dd></div></dl><form><div data-loading class="citl-admin-placeholder" role="status"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div><fieldset disabled class="citl-academic-booking-fields"><div class="citl-ac-toolbar"><label>المادة من جدولك<select name="course" required><option value="">اختر المادة</option></select></label><label data-manual hidden>اسم المحاضرة / السكشن<input name="manual" maxlength="300"></label><label>سبب الحجز<select name="reason" required><option value="">اختر السبب</option>'+Object.entries(reasons).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><label>تفاصيل السبب<textarea name="detail" rows="3" maxlength="500" placeholder="اكتب توضيحًا عند الحاجة"></textarea></label></div><p class="citl-ac-muted">يُراجع تعارض القاعة مجددًا عند الحفظ. اعتماد الحجز حسب صلاحيات الحساب الحالية.</p><div class="citl-ac-buttons"><button type="submit" class="citl-ac-button">حفظ حجز المحاضرة</button><button type="button" data-cancel class="citl-ac-button secondary">إلغاء</button></div></fieldset><p role="status" data-status></p><button type="button" data-retry hidden class="citl-ac-button secondary">إعادة تحميل المواد</button></form></div>';
  let saving=false,attempt=null,loadSerial=0;const form=d.querySelector('form'),f=form.elements,status=d.querySelector('[data-status]'),fieldset=d.querySelector('fieldset'),loader=d.querySelector('[data-loading]'),retry=d.querySelector('[data-retry]');
  const close=()=>{if(!saving)d.close();};d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;d.addEventListener('cancel',e=>{if(saving)e.preventDefault();});d.addEventListener('close',()=>{loadSerial++;d.remove();if(active===d)active=null;});
  d.onclick=e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();};
  const sync=()=>{const manual=f.course.value==='manual';d.querySelector('[data-manual]').hidden=!manual;f.manual.required=manual;f.detail.required=f.reason.value==='other';};f.course.onchange=f.reason.onchange=sync;
  async function load(){const serial=++loadSerial;fieldset.disabled=true;loader.hidden=false;retry.hidden=true;status.textContent='';try{
    const courses=await root.CITLRequests.rpc(root.sb,'citl_booking_courses',{});if(serial!==loadSerial||!d.isConnected)return;if(root.currentUser?.id!==owner)throw Error('تغير الحساب؛ أعد فتح الحجز');
    f.course.replaceChildren(new Option('اختر المادة من جدولك',''));const unique=new Map();for(const c of courses||[])if(c.name&&!unique.has(c.name))unique.set(c.name,c);for(const c of unique.values())f.course.add(new Option(c.name,c.id));f.course.add(new Option('المادة غير موجودة — كتابة الاسم يدويًا','manual'));if(!unique.size)f.course.value='manual';sync();fieldset.disabled=false;
   }catch(error){if(serial===loadSerial){status.textContent='تعذر تحميل المواد: '+error.message;retry.hidden=false;}}finally{if(serial===loadSerial)loader.hidden=true;}}
  retry.onclick=load;
  form.onsubmit=async e=>{e.preventDefault();if(saving||fieldset.disabled||!form.reportValidity())return;if(root.currentUser?.id!==owner){status.textContent='تغير الحساب؛ أغلق النموذج وأعد فتحه.';return;}
   const payload={room_name:room.name,date,start_time:start,end_time:end,schedule_id:f.course.value==='manual'?null:f.course.value,course_name:f.course.value==='manual'?f.manual.value.trim():null,reason:f.reason.value,reason_detail:f.detail.value.trim()||null};
   const fingerprint=JSON.stringify(payload);if(attempt&&attempt.fingerprint!==fingerprint){status.textContent='يوجد طلب سابق لم تتأكد نتيجته. أعد المحاولة بنفس البيانات أو راجع سجل حجوزاتك قبل إنشاء طلب مختلف.';return;}
   if(!attempt)attempt={fingerprint,id:crypto.randomUUID()};payload.request_id=attempt.id;saving=true;fieldset.disabled=true;d.querySelector('[data-close]').disabled=true;status.textContent='جاري حفظ حجز المحاضرة…';
   try{const result=await root.CITLRequests.rpc(root.sb,'citl_book_academic_room',{p_payload:payload});if(!result?.ok)throw Error('لم تؤكد الخدمة حفظ الحجز');attempt=null;saving=false;d.close();root.showNotification?.(result.status==='confirmed'?'تم حجز القاعة للمحاضرة بنجاح':'تم إرسال حجز المحاضرة للاعتماد','success');root.CITLRoomAvailability?.refresh(true);root.CITLMemberBookings?.refresh?.();}
   catch(error){if(error.code&&error.code!=='20'&&error.code!=='57014')attempt=null;status.textContent=error.code==='PGRST202'?'يلزم تطبيق تحديث الحجز الدراسي 034.':error.message;}
   finally{saving=false;if(d.isConnected){fieldset.disabled=false;d.querySelector('[data-close]').disabled=false;}}
  };
  document.body.append(d);d.showModal();await load();
 }
 root.CITLAcademicRoomReservation=Object.freeze({open});
})(window);
