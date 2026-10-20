(function(root){
 'use strict';
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const states={confirmed:'معتمد',pending:'بانتظار الاعتماد',rejected:'مرفوض',cancelled:'ملغى',deleted:'محذوف',modification_requested:'طلب تعديل',cancellation_requested:'طلب إلغاء',deletion_requested:'طلب حذف'};
 const actions={cancel:'إلغاء المحاضرة',replace:'إحلال محاضر',move_room:'تغيير القاعة',replace_and_move:'إحلال وتغيير قاعة'};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const mins=x=>Number(String(x).slice(0,2))*60+Number(String(x).slice(3,5));
 const department=k=>(typeof departments!=='undefined'?departments[k]?.name:null)||k||'';
 const clock=x=>String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
 let data=null,serial=0,loading=false,host;
 function permitted(){return root.CITLPermissions.can(root.currentUser,'can_monitor_rooms');}
 function mount(){
  if(host)return;const reference=document.querySelector('.admin-tab[data-tab=rooms]'),content=document.getElementById('admin-rooms-tab');if(!reference||!content)return;
  const button=reference.cloneNode(true);button.dataset.tab='room-monitor';button.removeAttribute('onclick');button.querySelector('span').textContent='متابعة القاعات والمحاضرات';const icon=button.querySelector('i');if(icon)icon.className='fas fa-eye';button.onclick=()=>root.switchAdminTab('room-monitor');button.style.display=permitted()?'flex':'none';reference.after(button);
  host=document.createElement('section');host.id='admin-room-monitor-tab';host.className='admin-tab-content hidden';
  host.innerHTML='<h2>متابعة القاعات والمحاضرات</h2><p>عرض فقط — الحجوزات والمحاضرات والإجراءات. الفترات الفارغة لا تعني السماح بالحجز خارج شروطه.</p><div class="citl-monitor-tools"><label>اليوم<input type="date" data-date></label><label>القاعة<select data-room><option value="">جميع القاعات</option></select></label><button class="citl-ac-button" data-refresh>تحديث</button></div><p data-status role="status"></p><div data-cards class="citl-monitor-cards"></div>';
  content.after(host);const date=new URLSearchParams(location.search).get('date');host.querySelector('[data-date]').value=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:today();host.querySelector('[data-date]').onchange=()=>load();host.querySelector('[data-refresh]').onclick=()=>load();host.querySelector('[data-room]').onchange=draw;
 }
 function draw(){if(!data||!host)return;const choice=host.querySelector('[data-room]').value;
  host.querySelector('[data-cards]').innerHTML=data.rooms.filter(r=>!choice||choice===(r.id||r.academic_name)).map(r=>{
   const lectures=data.lectures.filter(l=>l.room_name===r.academic_name),bookings=data.bookings.filter(b=>b.room_id===r.id),changes=data.actions.filter(a=>a.room_name===r.academic_name||a.replacement_room===r.academic_name);
   const occupied=[...lectures,...bookings.filter(b=>['confirmed','modification_requested','cancellation_requested','deletion_requested'].includes(b.status))].map(x=>[mins(x.start_time),mins(x.end_time)]).filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])).sort((a,b)=>a[0]-b[0]);
   let cursor=510;const free=[];for(const [start,end]of occupied){if(start>cursor)free.push([cursor,Math.min(start,1100)]);cursor=Math.max(cursor,end);}if(cursor<1100)free.push([cursor,1100]);
   const nowParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const at=Number(nowParts.hour)*60+Number(nowParts.minute);const live=data.date===today()?(occupied.some(([start,end])=>start<=at&&end>at)?'مشغولة الآن':'فارغة الآن'):'';
   const item=(title,sub,cls='')=>'<li class="'+cls+'"><strong>'+E(title)+'</strong><small>'+E(sub)+'</small></li>';
   return '<article><h3>'+E(r.name)+(live?' — '+live:'')+'</h3><h4>المحاضرات الفعلية</h4><ul>'+ (lectures.map(l=>item(l.course_name,l.instructor+' · '+String(l.start_time).slice(0,5)+' – '+String(l.end_time).slice(0,5))).join('')||'<li>لا توجد محاضرات في هذا اليوم</li>')+'</ul><h4>الحجوزات</h4><ul>'+ (bookings.map(b=>item(b.title,({lecture:'محاضرة / سكشن',meeting:'اجتماع',seminar:'ندوة',event:'فعالية',other:'استخدام آخر'}[b.booking_type]||'حجز قاعة')+' · '+(states[b.status]||b.status)+' · '+String(b.start_time).slice(0,5)+' – '+String(b.end_time).slice(0,5)+' · '+(b.booked_by||'')+' · '+department(b.department))).join('')||'<li>لا توجد حجوزات</li>')+'</ul><h4>الإلغاء والإحلال وتغيير القاعة</h4><ul>'+ (changes.map(a=>item(actions[a.action_type]||a.action_type,a.course_name+' · '+a.instructor+' · '+a.time_slot+(a.replacement_room?' ← '+a.replacement_room:'')+(a.replacement_instructor?' · '+a.replacement_instructor:'')+(a.reason?' · '+a.reason:''),'changed')).join('')||'<li>لا توجد إجراءات</li>')+'</ul><h4>فترات فارغة بين 08:30 و18:20</h4><div class="citl-monitor-free">'+(free.filter(x=>x[1]>x[0]).map(x=>'<bdi>'+clock(x[0])+' – '+clock(x[1])+'</bdi>').join('')||'مشغولة خلال هذه الفترة')+'</div></article>';
  }).join('')||'<div class="citl-admin-empty">لا توجد قاعات مطابقة</div>';
 }
 async function load(quiet=false){mount();if(!host)return;if(!permitted()){serial++;data=null;host.querySelector('[data-cards]').replaceChildren();host.querySelector('[data-status]').textContent='هذه المتابعة غير متاحة لصلاحيات حسابك.';return;}if(loading&&quiet)return;const mine=++serial;loading=true;const status=host.querySelector('[data-status]');status.textContent=quiet?'':'جاري تحديث المتابعة…';if(!quiet)host.querySelector('[data-cards]').innerHTML='<div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';
  try{const result=await root.CITLRequests.rpc(root.sb,'citl_room_monitor',{p_date:host.querySelector('[data-date]').value});if(mine!==serial||!permitted())return;data=result;const select=host.querySelector('[data-room]'),value=select.value;select.innerHTML='<option value="">جميع القاعات</option>'+data.rooms.map(r=>'<option value="'+E(r.id||r.academic_name)+'">'+E(r.name)+'</option>').join('');select.value=value;status.textContent='آخر تحديث: '+new Date(data.generated_at).toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo'});draw();}
  catch(e){if(mine===serial){data=null;host.querySelector('[data-cards]').replaceChildren();status.textContent='تعذر تأكيد حالة القاعات. '+e.message;}}finally{if(mine===serial)loading=false;}
 }
 root.CITLRoomMonitor=Object.freeze({mount,load});mount();root.addEventListener('citl-profile-loaded',()=>{mount();if(host&&!host.classList.contains('hidden'))void load();});
 setInterval(()=>{if(host&&!document.hidden&&!host.classList.contains('hidden'))void load(true);},60000);
})(window);
