(function(root){
 'use strict';
 const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const states={confirmed:'معتمد',pending:'بانتظار الاعتماد',rejected:'مرفوض',cancelled:'ملغى',deleted:'محذوف',modification_requested:'طلب تعديل',cancellation_requested:'طلب إلغاء',deletion_requested:'طلب حذف'};
 const actions={cancel:'إلغاء المحاضرة',replace:'إحلال محاضر',move_room:'تغيير القاعة',replace_and_move:'إحلال وتغيير قاعة'};
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const mins=x=>Number(String(x).slice(0,2))*60+Number(String(x).slice(3,5));
 const department=k=>(typeof departments!=='undefined'?departments[k]?.name:null)||k||'';
 const clock=x=>String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
 let data=null,serial=0,loading=false,host,page=0,expanded='',signature='';
 const pageSize=8;
 const normalize=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/[\u064b-\u065f]/g,'').replace(/\s+/g,' ').trim();
 function permitted(){return root.CITLPermissions.can(root.currentUser,'can_monitor_rooms');}
 function mount(){
  if(host)return;const reference=document.querySelector('.admin-tab[data-tab=rooms]'),content=document.getElementById('admin-rooms-tab');if(!reference||!content)return;
  const button=reference.cloneNode(true);button.dataset.tab='room-monitor';button.removeAttribute('onclick');button.querySelector('span').textContent='متابعة القاعات والمحاضرات';const icon=button.querySelector('i');if(icon)icon.className='fas fa-eye';button.onclick=()=>root.switchAdminTab('room-monitor');button.style.display=permitted()?'flex':'none';reference.after(button);
  host=document.createElement('section');host.id='admin-room-monitor-tab';host.className='admin-tab-content hidden';
  host.innerHTML='<h2>متابعة القاعات والمحاضرات</h2><p>عرض فقط — اختر اليوم والقاعة، ثم افتح التفاصيل عند الحاجة.</p><div class="citl-monitor-tools"><label class="monitor-search">بحث<input type="search" data-search placeholder="القاعة، المحاضر، المادة أو عنوان الحجز"></label><label>اليوم<input type="date" data-date></label><label>القاعة<select data-room><option value="">جميع القاعات</option></select></label><label>نوع المتابعة<select data-kind><option value="all">الكل</option><option value="lectures">محاضرات</option><option value="bookings">اجتماعات وفعاليات</option><option value="changes">إلغاء وإحلال وتغيير قاعة</option><option value="free">فترات فارغة</option></select></label><label>حالة القاعة<select data-state><option value="">كل الحالات</option><option value="busy">مشغولة في التوقيت المحدد</option><option value="free">فارغة في التوقيت المحدد</option></select></label><label>توقيت فحص الإشغال<input type="time" data-time></label><div class="monitor-filter-actions"><button class="citl-ac-button" data-refresh>تحديث</button><button class="citl-ac-button secondary" data-reset>مسح الفلاتر</button></div></div><div data-summary class="monitor-summary"></div><p data-status role="status"></p><div data-cards class="citl-monitor-cards"></div><div data-pages class="monitor-pages"></div>';
  content.after(host);const date=new URLSearchParams(location.search).get('date');host.querySelector('[data-date]').value=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:today();host.querySelector('[data-time]').value=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  const filter=()=>{page=0;expanded='';draw();};
  host.querySelector('[data-date]').onchange=()=>{page=0;expanded='';load();};host.querySelector('[data-refresh]').onclick=()=>load();
  for(const key of ['room','kind','state','time'])host.querySelector('[data-'+key+']').onchange=filter;
  host.querySelector('[data-search]').oninput=filter;
  host.querySelector('[data-reset]').onclick=()=>{for(const key of ['room','state','search'])host.querySelector('[data-'+key+']').value='';host.querySelector('[data-kind]').value='all';filter();};

 }
 function models(){return data.rooms.map(r=>{
  const lectures=data.lectures.filter(l=>l.room_name===r.academic_name),bookings=data.bookings.filter(b=>r.id&&b.room_id===r.id),changes=data.actions.filter(a=>a.room_name===r.academic_name||a.replacement_room===r.academic_name);
  const occupied=[...lectures,...bookings.filter(b=>['confirmed','modification_requested','cancellation_requested','deletion_requested'].includes(b.status))].map(x=>[mins(x.start_time),mins(x.end_time)]).filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1])).sort((a,b)=>a[0]-b[0]);
  let cursor=510;const free=[];for(const [start,end]of occupied){if(start>cursor&&cursor<1100)free.push([cursor,Math.min(start,1100)]);cursor=Math.max(cursor,end);}if(cursor<1100)free.push([cursor,1100]);
  const at=mins(host.querySelector('[data-time]').value),busy=occupied.some(([start,end])=>start<=at&&end>at);
  const search=normalize([r.name,r.academic_name,...lectures.flatMap(l=>[l.course_name,l.instructor]),...bookings.flatMap(b=>[b.title,b.booked_by,department(b.department)]),...changes.flatMap(a=>[a.course_name,a.instructor,a.replacement_instructor,a.replacement_room])].join(' '));
  return {...r,key:r.id||r.academic_name,lectures,bookings,changes,free,busy,search};
 });}
 function details(r,kind){
  const item=(title,sub,cls='')=>'<li class="'+cls+'"><strong>'+E(title)+'</strong><small>'+E(sub)+'</small></li>',times=x=>'\u2066'+String(x.start_time).slice(0,5)+' – '+String(x.end_time).slice(0,5)+'\u2069';
  const section=(title,items)=>'<section><h4>'+title+'</h4><ul>'+(items.join('')||'<li class="monitor-empty">لا توجد بيانات لهذا اليوم</li>')+'</ul></section>';
  let html='';
  if(['all','lectures'].includes(kind))html+=section('المحاضرات الفعلية',r.lectures.map(l=>item(l.course_name,l.instructor+' · '+times(l))));
  if(['all','bookings','lectures'].includes(kind))html+=section(kind==='lectures'?'حجوزات المحاضرات':'الحجوزات',r.bookings.filter(b=>kind==='all'||(kind==='lectures'?b.booking_type==='lecture':b.booking_type!=='lecture')).map(b=>item(b.title,({lecture:'محاضرة / سكشن',meeting:'اجتماع',seminar:'ندوة',event:'فعالية',other:'استخدام آخر'}[b.booking_type]||'حجز قاعة')+' · '+(states[b.status]||b.status)+' · '+times(b)+' · '+(b.booked_by||'')+' · '+department(b.department))));
  if(['all','changes'].includes(kind))html+=section('إجراءات المحاضرات',r.changes.map(a=>item(actions[a.action_type]||a.action_type,a.course_name+' · '+a.instructor+' · '+a.time_slot+(a.replacement_room?' ← '+a.replacement_room:'')+(a.replacement_instructor?' · '+a.replacement_instructor:'')+(a.reason?' · '+a.reason:''),'changed')));
  if(['all','free'].includes(kind))html+='<section><h4>فترات فارغة بين 08:30 و18:20</h4><div class="citl-monitor-free">'+(r.free.map(x=>'<bdi>'+clock(x[0])+' – '+clock(x[1])+'</bdi>').join('')||'لا توجد فترات فارغة')+'</div><p class="monitor-disclaimer">فترات الإشغال للمتابعة فقط، وليست تصريحًا بالحجز.</p></section>';
  return html;
 }
 function draw(){if(!data||!host)return;
  const field=k=>host.querySelector('[data-'+k+']').value,choice=field('room'),kind=field('kind'),state=field('state'),terms=normalize(field('search')).split(' ').filter(Boolean);
  const rows=models().filter(r=>(!choice||r.key===choice)&&terms.every(t=>r.search.includes(t))&&(!state||(state==='busy'?r.busy:!r.busy))&&(kind==='all'||kind==='free'&&r.free.length||kind==='changes'&&r.changes.length||kind==='lectures'&&(r.lectures.length||r.bookings.some(b=>b.booking_type==='lecture'))||kind==='bookings'&&r.bookings.some(b=>b.booking_type!=='lecture')));
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);
  const next=JSON.stringify([rows,page,expanded,kind,field('time')]);if(next===signature)return;signature=next;
  host.querySelector('[data-summary]').innerHTML=[['قاعات مطابقة',rows.length],['مشغولة في '+field('time'),rows.filter(r=>r.busy).length],['فارغة في '+field('time'),rows.filter(r=>!r.busy).length],['إجراءات المحاضرات',new Set(rows.flatMap(r=>r.changes.map(a=>a.id||JSON.stringify(a)))).size]].map(([label,n])=>'<div><strong>'+n+'</strong><span>'+E(label)+'</span></div>').join('');
  host.querySelector('[data-cards]').innerHTML=rows.slice(page*pageSize,(page+1)*pageSize).map((r,i)=>'<article><button type="button" class="monitor-room-row" data-expand="'+E(r.key)+'" aria-expanded="'+(expanded===r.key)+'" aria-controls="monitor-detail-'+i+'"><span class="monitor-room-name"><i class="fas fa-door-open" aria-hidden="true"></i><strong>'+E(r.name)+'</strong></span><span class="monitor-state '+(r.busy?'busy':'free')+'">'+(r.busy?'مشغولة':'فارغة')+' · <bdi>'+E(field('time'))+'</bdi></span><span class="monitor-counts">'+r.lectures.length+' محاضرات · '+r.bookings.length+' حجوزات · '+r.changes.length+' إجراءات</span><span class="monitor-expand">'+(expanded===r.key?'إخفاء التفاصيل −':'عرض التفاصيل +')+'</span></button><div id="monitor-detail-'+i+'" class="monitor-details" '+(expanded===r.key?'':'hidden')+'>'+ (expanded===r.key?details(r,kind):'')+'</div></article>').join('')||'<div class="citl-admin-empty">لا توجد نتائج تطابق البحث والفلاتر. جرّب مسح الفلاتر.</div>';
  host.querySelector('[data-pages]').innerHTML='<button type="button" class="citl-ac-button secondary" data-prev '+(page===0?'disabled':'')+'>السابق</button><span>صفحة '+(page+1)+' من '+pages+' · '+rows.length+' قاعة</span><button type="button" class="citl-ac-button secondary" data-next '+(page===pages-1?'disabled':'')+'>التالي</button>';
  host.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>{const key=b.dataset.expand;expanded=expanded===key?'':key;draw();Array.from(host.querySelectorAll('[data-expand]')).find(el=>el.dataset.expand===key)?.focus({preventScroll:true});});
  for(const [key,step]of [['prev',-1],['next',1]])host.querySelector('[data-'+key+']').onclick=()=>{page+=step;expanded='';draw();host.querySelector('[data-cards]').scrollIntoView({block:'nearest'});};
 }
 async function load(quiet=false){mount();if(!host)return;if(!permitted()){serial++;data=null;signature='';host.querySelector('[data-summary]').replaceChildren();host.querySelector('[data-pages]').replaceChildren();host.querySelector('[data-cards]').replaceChildren();host.querySelector('[data-status]').textContent='هذه المتابعة غير متاحة لصلاحيات حسابك.';return;}if(loading&&quiet)return;const mine=++serial;loading=true;const status=host.querySelector('[data-status]');status.textContent=quiet?'':'جاري تحديث المتابعة…';if(!quiet){data=null;signature='';host.querySelector('[data-summary]').replaceChildren();host.querySelector('[data-pages]').replaceChildren();host.querySelector('[data-cards]').innerHTML='<div class="citl-admin-placeholder"><span class="citl-skeleton-line"></span><span class="citl-skeleton-line"></span></div>';}
  try{const result=await root.CITLRequests.rpc(root.sb,'citl_room_monitor',{p_date:host.querySelector('[data-date]').value});if(mine!==serial||!permitted())return;data=result;const select=host.querySelector('[data-room]'),value=select.value;select.innerHTML='<option value="">جميع القاعات</option>'+data.rooms.map(r=>'<option value="'+E(r.id||r.academic_name)+'">'+E(r.name)+'</option>').join('');select.value=value;status.textContent='آخر تحديث: '+new Date(data.generated_at).toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo'});draw();}
  catch(e){if(mine===serial){data=null;signature='';host.querySelector('[data-summary]').replaceChildren();host.querySelector('[data-pages]').replaceChildren();host.querySelector('[data-cards]').replaceChildren();status.textContent='تعذر تأكيد حالة القاعات. '+e.message;}}finally{if(mine===serial)loading=false;}
 }
 root.CITLRoomMonitor=Object.freeze({mount,load});mount();root.addEventListener('citl-profile-loaded',()=>{mount();if(host&&!host.classList.contains('hidden'))void load();});
 setInterval(()=>{if(host&&!document.hidden&&!host.classList.contains('hidden'))void load(true);},60000);
})(window);
