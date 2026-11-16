(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const label=r=>r.status==='confirmed'?'معتمد — اكتملت الموافقتان':r.status==='cancelled'?'تم إلغاء الحجز':r.status==='rejected'||r.state==='rejected'?'الطلب مرفوض':r.state==='approved'?'وافق المحاضر — ينتظر مسؤول الحجوزات':'ينتظر موافقة المحاضر أولًا';
 const client=()=>root.sb?.rpc?root.sb:root.supabase?.rpc?root.supabase:null;
 async function rpc(action,payload={}){const sb=client();if(!sb)throw Error('لم يكتمل تسجيل الدخول؛ أعد المحاولة.');const {data,error}=await sb.rpc('citl_lecture_time_api149',{p_action:action,p_payload:payload});if(error)throw Error(error.code==='PGRST202'?'يلزم تثبيت SQL149 قبل استخدام طلب وقت من المحاضرة.':error.message||'تعذر تحميل الطلب');return data;}
 let current=null;
 async function open(id){
  if(!/^\d+$/.test(String(id)))return;
  current?.close();const d=document.createElement('dialog');current=d;d.className='citl-lecture-slot';d.dir='rtl';d.setAttribute('aria-labelledby','citl-lecture-review-title');
  d.innerHTML='<header><h2 id="citl-lecture-review-title">موافقة المحاضر على وقت الاجتماع</h2><button type="button" data-close aria-label="إغلاق">×</button></header><div class="citl-slot-body" aria-live="polite">جاري تحميل الطلب…</div><footer><button type="button" data-close>إغلاق</button></footer>';
  const previous=document.activeElement;d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());d.onclose=()=>{d.remove();if(current===d)current=null;if(previous?.isConnected)previous.focus({preventScroll:true});};document.body.append(d);d.showModal();
  const body=d.querySelector('.citl-slot-body');
  async function load(){try{const r=await rpc('get',{id});if(!d.isConnected)return;render(r);}catch(e){if(!d.isConnected)return;body.replaceChildren();const p=document.createElement('p');p.textContent=e.message;const b=document.createElement('button');b.type='button';b.textContent='إعادة المحاولة';b.onclick=load;body.append(p,b);}}
  function render(r){
   if(r.state==='not_required_or_legacy'){
    body.innerHTML='<p>لا توجد موافقة محاضر مرتبطة بهذا الطلب. إذا كان يتعارض مع محاضرة، اطلب موافقتها أولًا.</p>';
    if(r.can_register){const b=document.createElement('button');b.textContent='طلب موافقة المحاضر';b.onclick=async()=>{b.disabled=true;try{render(await rpc('register',{id}));}catch(e){const p=document.createElement('p');p.textContent=e.message;body.append(p);}finally{b.disabled=false;}};body.append(b);}return;
   }
   body.innerHTML='<strong>'+esc(label(r))+'</strong><div class="citl-slot-impact">'+esc(r.title)+'\n'+esc(r.room_name)+' · '+esc(r.date)+'\nمقدم الطلب: '+esc(r.requested_by)+'\n'+esc(root.CITLLectureBookingSlot.summary(r.conflicts,r.start_time.slice(0,5),r.end_time.slice(0,5)))+'</div><div>'+r.decisions.map(x=>'<p>'+esc(x.name)+' — '+esc(x.decision==='approve'?'وافق':x.decision==='reject'?'رفض':'بانتظار القرار')+'</p>').join('')+'</div><p class="citl-slot-note">موافقة المحاضر لا تؤكد الحجز وحدها. ينتقل الطلب بعدها لمسؤول الحجوزات، ويظل باقي وقت المحاضرة محفوظًا.</p>';
   const details=document.createElement('dl');details.className='citl-slot-booking-details';
   const reason={meeting:'اجتماع',seminar:'ندوة',event:'فعالية',administrative:'استخدام إداري',other:'سبب آخر'};
   const department=(typeof departments!=='undefined'?departments[r.department]?.name:null)||r.department||'غير محدد';
   for(const [title,value] of [['الجهة الحاجزة',department],['نوع / سبب الحجز',reason[r.booking_reason]||r.booking_reason||'اجتماع'],['تفاصيل سبب الحجز',r.booking_reason_detail||'لم تُضف تفاصيل'],['الحضور',r.attendees||'لم يُحدّد'],['الملاحظات',r.description||'لا توجد ملاحظات']]){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=value;row.append(dt,dd);details.append(row);}body.querySelector('.citl-slot-impact').after(details);
   if(r.can_decide){
    const actions=document.createElement('div');actions.className='citl-slot-presets';const approve=document.createElement('button'),reject=document.createElement('button');approve.textContent='أوافق على الوقت المحدد';reject.textContent='رفض الطلب';actions.append(approve,reject);body.append(actions);
    async function decide(decision){approve.disabled=reject.disabled=true;try{render(await rpc('respond',{id,decision}));void refresh();void root.checkUserNotifications?.();}catch(e){const p=document.createElement('p');p.className='citl-slot-error';p.textContent=e.message;body.append(p);approve.disabled=reject.disabled=false;}}
    approve.onclick=()=>decide('approve');reject.onclick=()=>decide('reject');
   }
   if(r.can_final_approve){const b=document.createElement('button');b.textContent='فتح مراجعة مسؤول الحجوزات';b.onclick=()=>{d.close();if(root.CITLMeetingUI)root.CITLMeetingUI.open(id,true);else root.location.assign('/dashboard/?notification=meeting&meeting='+encodeURIComponent(id));};body.append(b);}
  }
  await load();
 }
 async function mount(m,section){
  if(section.querySelector('[data-lecture-consent]'))return;
  const box=document.createElement('div');box.dataset.lectureConsent='true';box.className='citl-booking-occupancy';section.prepend(box);
  const text=document.createElement('p'),button=document.createElement('button');button.type='button';button.className='citl-ac-button secondary';button.textContent='موافقة المحاضر';button.onclick=()=>open(m.id);box.append(text,button);text.textContent='جاري قراءة موافقة المحاضر…';
  try{const r=await rpc('get',{id:m.id});if(box.isConnected)text.textContent=r.state==='not_required_or_legacy'?'طلب سابق: تحقّق من موافقة المحاضر قبل الاعتماد.':label(r);}catch(e){text.textContent=e.message;}
 }
 let panel=null;
 async function refresh(){
  if(!/\/smrm\/?(?:index\.html)?$/.test(location.pathname)||!client())return;
  try{const rows=await rpc('list');if(!panel){panel=document.createElement('section');panel.className='citl-lecture-requests';panel.setAttribute('aria-label','طلبات وقت المحاضرات');document.querySelector('main')?.prepend(panel);}
   panel.hidden=!rows.length;panel.innerHTML='<strong>طلبات استخدام وقت من محاضراتي</strong><p>راجع الوقت المطلوب. موافقتك تسبق اعتماد مسؤول الحجوزات.</p>';
   for(const r of rows){const b=document.createElement('button');b.type='button';b.textContent=r.title+' · '+r.date+' · '+r.start_time.slice(0,5)+'–'+r.end_time.slice(0,5);b.onclick=()=>open(r.id);panel.append(b);}
  }catch(_){/* Deep-link dialog and booking checks expose errors; optional inbox does not block room calendar. */}
 }
 let started=false;
 function start(){if(!client()||!root.currentUser)return false;if(!started){started=true;void refresh();const id=new URL(location.href).searchParams.get('lectureTimeRequest');if(id)void open(id);}return true;}
 root.addEventListener('citl:profile-loaded',()=>{started=false;start();});
 let attempts=0;const timer=setInterval(()=>{if(start()||++attempts>=60)clearInterval(timer);},500);
 root.CITLLectureBookingApproval=Object.freeze({open,mount,refresh});
})(window);
