/* Shared meeting UX. Academic room reservations keep their independent form and RPC. */
(function(root){
 'use strict';
 const E=v=>root.CITLSecure.htmlEscape(v??''),P=root.CITLPermissions;
 const labels={pending:'بانتظار الاعتماد',confirmed:'معتمد',rejected:'مرفوض',cancelled:'ملغي',modification_requested:'تعديل بانتظار المراجعة',cancellation_requested:'إلغاء بانتظار المراجعة',deletion_requested:'حذف بانتظار المراجعة'};
 const reasons={meeting:'اجتماع',seminar:'ندوة',event:'فعالية / إيفنت',administrative:'استخدام إداري',other:'سبب آخر',makeup:'محاضرة تعويضية',revision:'مراجعة',extra:'محاضرة إضافية',room_change:'تغيير القاعة',section:'سكشن'};
 const cairo=()=>{if(root.CITLStudy)return root.CITLStudy.cairo();const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,minutes:Number(p.hour)*60+Number(p.minute)};};
 const department=k=>(typeof departments!=='undefined'?departments[k]?.name:null)||k||'غير محدد';
 const clock=s=>String(s||'').slice(0,5),mins=s=>{const [h,m]=clock(s).split(':').map(Number);return h*60+m;};
 function duration(start,end){const n=Math.round(mins(end)-mins(start));if(!Number.isFinite(n)||n<0)return 'غير محددة';const h=Math.floor(n/60),m=n%60;return [h?(h===1?'ساعة':h===2?'ساعتان':h+' ساعات'):'',m?m+' دقيقة':''].filter(Boolean).join(' و')||'0 دقيقة';}
 function normalize(m){return {...m,startTime:clock(m.startTime||m.start_time),endTime:clock(m.endTime||m.end_time),createdAt:m.createdAt||m.created_at,createdBy:m.profiles?.full_name||m.createdBy||'',creatorEmail:m.profiles?.email||m.creatorEmail||null};}
 function kind(m){return m.booking_type==='lecture'?'محاضرة / سكشن':reasons[m.booking_reason]|| (m.booking_type==='other'?'استخدام إداري / آخر':'اجتماع');}
 function details(m){return [['نوع الحجز',kind(m)],['الجهة الحاجزة',department(m.department)],['القاعة',m.rooms?.name||m.room_name|| (typeof rooms!=='undefined'?rooms.find(r=>String(r.id)===String(m.room_id))?.name:null)||'—'],['مقدم الطلب',m.createdBy||'—'],['بريد مقدم الطلب',m.creatorEmail||'—'],['الحالة',labels[m.status]||m.status],['سبب الحجز',reasons[m.booking_reason]||m.booking_reason||'—'],['تفاصيل السبب',m.booking_reason_detail||'—']];}
 function list(items){return '<dl class="citl-meeting-fields">'+items.map(([a,b])=>'<div><dt>'+E(a)+'</dt><dd>'+E(b)+'</dd></div>').join('')+'</dl>';}
 function decorateDetails(m,host){host.querySelector('[data-meeting-extra]')?.remove();const section=document.createElement('section');section.dataset.meetingExtra='';section.innerHTML=list(details(m));
  if(m.pending_changes){const p=normalize({...m,...m.pending_changes});section.innerHTML+='<h4 class="citl-meeting-subtitle">التعديل المطلوب — لم يُعتمد بعد</h4>'+list([['العنوان',p.title],['التاريخ',p.date],['التوقيت',p.startTime+' – '+p.endTime],['المدة',duration(p.startTime,p.endTime)],['الجهة',department(p.department)],['نوع الحجز',kind(p)],['الحضور',p.attendees||'—'],['الملاحظات',p.description||'—'],['تفاصيل السبب',p.booking_reason_detail||'—']]);}
  host.querySelector('.space-y-4')?.before(section);if(!section.isConnected)host.append(section);
 }
 function canReview(){return P.full(root.currentUser)||P.can(root.currentUser,'can_approve')||P.can(root.currentUser,'can_delete');}
 let opening=false;
 async function open(id,management=true){if(opening)return;opening=true;try{
  const {data,error}=await root.sb.from('meetings').select('*, profiles!user_id(full_name,email), rooms!room_id(name)').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw Error('الحجز غير موجود أو غير متاح لحسابك');
  document.getElementById('notif-menu')?.classList.add('hidden');
  if(management){root.openAdminPanel(canReview()?'meetings':'my-bookings');if(canReview())await root.updateAdminMeetingsList?.();else await root.CITLMemberBookings?.load();}
  root.showMeetingDetails(normalize(data));
 }catch(error){root.showNotification?.('تعذر فتح تفاصيل الحجز: '+error.message,'error');}finally{opening=false;}}
 function addDetailsButton(row,m){if(row.querySelector('[data-meeting-action=viewMeetingFromAdmin]'))return;const cell=row.lastElementChild;if(!cell)return;const b=document.createElement('button');b.type='button';b.className='citl-ac-button secondary';b.dataset.meetingAction='viewMeetingFromAdmin';b.textContent='التفاصيل';cell.prepend(b);}
 function rememberAdminEdit(){document.getElementById('add-meeting-modal').style.zIndex='1800';}
 async function afterSave(id){const wasAdmin=document.getElementById('admin-panel-modal')?.classList.contains('show');if(wasAdmin){if(canReview())await root.updateAdminMeetingsList?.();else await root.CITLMemberBookings?.load();}if(id&&!wasAdmin)await open(id,false);await upcoming(true);}
 let loading=null,upcomingRows=null,lastLoad=0,upcomingOwner=null,visibleUpcoming=6;
 function renderUpcoming(){const host=document.getElementById('ai-suggestions');if(!host||root.CITLRoomAvailability?.isFree())return;const now=cairo(),rows=(upcomingRows||[]).filter(m=>(m.date>now.date||(m.date===now.date&&mins(m.end_time)>now.minutes)));
  rows.sort((a,b)=>(a.date+' '+a.start_time).localeCompare(b.date+' '+b.start_time));
  const approved=rows.filter(m=>m.status!=='pending').length;
  const text=rows.length?'<div class="citl-upcoming-summary"><span><strong>مواعيد جميع القاعات</strong><small>مرتبة من الأقرب · حسب صلاحيات حسابك</small></span><span class="citl-upcoming-count"><b>'+approved+'</b> معتمد'+(rows.length-approved?' · '+(rows.length-approved)+' بانتظار الاعتماد':'')+'</span></div><div class="citl-upcoming-meetings">'+rows.slice(0,visibleUpcoming).map((m,i)=>'<article data-status="'+E(m.status)+'"><button type="button" data-open-booking="'+E(m.id)+'"><span class="citl-upcoming-card-top"><small class="citl-upcoming-state">'+E(labels[m.status])+'</small>'+(i===0?'<small class="citl-upcoming-nearest">أقرب موعد</small>':'')+'</span><strong>'+E(m.title)+'</strong><span>'+E(m.rooms?.name||'قاعة')+' · '+E(department(m.department))+'</span><span>'+E(new Date(m.date+'T12:00:00Z').toLocaleDateString('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</span><span class="citl-upcoming-time"><bdi>'+E(clock(m.start_time)+' – '+clock(m.end_time))+'</bdi><small>'+E(kind(m))+' · '+E(duration(m.start_time,m.end_time))+'</small></span></button><div class="citl-upcoming-actions"><button type="button" data-detail-booking="'+E(m.id)+'">تفاصيل الحجز</button><button type="button" data-locate-booking="'+E(m.id)+'">عرض في الجدول ←</button></div></article>').join('')+'</div>'+(rows.length>visibleUpcoming?'<button type="button" class="citl-upcoming-more" data-more-bookings>عرض حجوزات أخرى ('+(rows.length-visibleUpcoming)+')</button>':'')+(rows.length===100?'<small class="citl-upcoming-limit">تُعرض أقرب 100 نتيجة. جميع الحجوزات في إدارة الحجوزات.</small>':''):'<div class="citl-admin-empty">لا توجد حجوزات قاعات قادمة متاحة للعرض.</div>';
  if(host.innerHTML!==text){host.innerHTML=text;host.dataset.upcoming=text;host.querySelectorAll('[data-open-booking],[data-detail-booking]').forEach(b=>b.onclick=()=>open(b.dataset.openBooking||b.dataset.detailBooking,true));host.querySelectorAll('[data-locate-booking]').forEach(b=>b.onclick=()=>locate(b.dataset.locateBooking));host.querySelector('[data-more-bookings]')?.addEventListener('click',()=>{visibleUpcoming+=6;renderUpcoming();});}

 }
 function upcoming(force=false){if(root.CITLRoomAvailability?.isFree()){root.CITLRoomAvailability.assistant();return;}const owner=root.currentUser?.id;if(!owner)return;const host=document.getElementById('ai-suggestions');if(!host)return;
  if(upcomingOwner!==owner){upcomingRows=null;lastLoad=0;visibleUpcoming=6;upcomingOwner=owner;}if(upcomingRows)renderUpcoming();if(loading||(!force&&Date.now()-lastLoad<15000))return loading;
  if(!upcomingRows)host.innerHTML=root.CITLLoading?.summary(2)||'';
  loading=(async()=>{try{const now=cairo();const {data,error}=await root.sb.from('meetings').select('id,title,department,date,start_time,end_time,status,booking_type,booking_reason,room_id,rooms!room_id(name)').gte('date',now.date).in('status',['confirmed','modification_requested','cancellation_requested','pending']).order('date').order('start_time').limit(100);if(error)throw error;if(root.currentUser?.id!==owner)return;upcomingRows=(data||[]).filter(m=>['confirmed','modification_requested','cancellation_requested','pending'].includes(m.status));lastLoad=Date.now();host.dataset.upcoming='';renderUpcoming();}catch(error){if(!upcomingRows)host.innerHTML='<div class="citl-admin-empty">تعذر تحميل الحجوزات القادمة. <button type="button" data-retry-bookings class="citl-ac-button secondary">إعادة المحاولة</button></div>';host.querySelector('[data-retry-bookings]')?.addEventListener('click',()=>upcoming(true));}finally{loading=null;}})();return loading;
 }
 function weekPicker(){document.querySelector('.citl-meeting-date-picker')?.remove();const wrapper=document.getElementById('week-dropdown-wrapper');if(wrapper)wrapper.style.removeProperty('display');}
 let locating=false;
 async function locate(id){if(locating)return;locating=true;try{
  const {data:m,error}=await root.sb.from('meetings').select('id,room_id,date,status,booking_type').eq('id',id).maybeSingle();if(error)throw error;if(!m)throw Error('الحجز غير متاح');
  if(root.CITLRoomAvailability?.isFree())document.querySelector('[data-mode=bookings]')?.click();
  await root.selectRoom(m.room_id);root.jumpToWeek(m.date+'T12:00:00');
  const block=[...document.querySelectorAll('#calendar-container [data-booking-id]')].find(b=>b.dataset.bookingId===String(m.id));
  if(block){block.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});block.classList.add('citl-booking-highlight');setTimeout(()=>block.classList.remove('citl-booking-highlight'),2500);}
  else {document.getElementById('calendar-container')?.scrollIntoView({behavior:'smooth',block:'start'});root.showNotification?.(m.status==='pending'?'الحجز بانتظار الاعتماد؛ لن يشغل القاعة قبل الموافقة.':'تم فتح أسبوع الحجز؛ حدّث البيانات إذا لم يظهر.','info');}
 }catch(error){root.showNotification?.('تعذر عرض الحجز في الجدول: '+error.message,'error');}finally{locating=false;}}
 function hiddenBlocks(){const calendar=document.getElementById('calendar-container');if(!calendar?.getClientRects().length||root.CITLRoomAvailability?.isFree()||document.querySelector('.modal.show'))return [];const parent=calendar.parentElement.getBoundingClientRect();return [...calendar.querySelectorAll('.meeting-block')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&(r.top>innerHeight-35||r.bottom<0||r.right<=Math.max(0,parent.left)||r.left>=Math.min(innerWidth,parent.right));});}
 function hiddenBookings(){const indicator=document.getElementById('scroll-indicator');if(!indicator)return;if(indicator.parentElement!==document.body)document.body.append(indicator);const blocks=hiddenBlocks();for(const c of ['opacity-0','translate-y-10','pointer-events-none'])indicator.classList.toggle(c,!blocks.length);document.getElementById('hidden-count').textContent=blocks.length;indicator.setAttribute('aria-hidden',String(!blocks.length));const button=indicator.querySelector('button');if(button)button.disabled=!blocks.length;}
 function scrollToBooking(){const b=hiddenBlocks()[0];if(b)b.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});}
 root.addEventListener('scroll',hiddenBookings,true);
 root.addEventListener('resize',hiddenBookings);
 // Modal/mode switches can hide the calendar without causing any scroll.
 new MutationObserver(records=>{if(records.some(r=>r.target.classList?.contains('modal')||r.target.id==='calendar-container'))hiddenBookings();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','style']});
 // Handle historic notification routes too; new clicks pass the exact ID directly.
 let linked=false;function deepLink(){if(linked||!root.currentUser)return;const p=new URLSearchParams(location.search);if(p.get('notification')!=='meeting')return;linked=true;if(p.get('meeting'))open(p.get('meeting'),true);else root.openAdminPanel(canReview()?'meetings':'my-bookings');}
 root.addEventListener('citl-profile-loaded',deepLink);setTimeout(deepLink,0);
 root.CITLMeetingUI=Object.freeze({duration,normalize,decorateDetails,open,addDetailsButton,rememberAdminEdit,afterSave,upcoming,weekPicker,locate,hiddenBookings,scrollToBooking,department,kind,status:s=>labels[s]||s});
})(window);
