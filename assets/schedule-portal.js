(function(){
 'use strict';
 const R=CITLRuntime,S=CITLSchedule,$=id=>document.getElementById(id),esc=R.escape;
 const params=new URLSearchParams(location.search);
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const view=document.body.dataset.scheduleType==='academic'?'academic':'exams';
 let followToday=!validDate(params.get('date')),generation=0,refreshTimer,busy=false;
 const data={academic:[],exams:[]},loaded={academic:'',exams:''},failed={academic:false,exams:false},updated={academic:null,exams:null};
 $('schedule-date').value=followToday?R.date():params.get('date');
 let lastValidDate=$('schedule-date').value;
 $('search').value=(params.get('q')||'').slice(0,150);
 $('status-filter').value=['now','upcoming','ended','cancelled'].includes(params.get('status'))?params.get('status'):'';
 let selectedRoom=params.get('room')||'';
 function filters(){return {view,date:followToday?'':$('schedule-date').value,room:selectedRoom,status:$('status-filter').value,q:$('search').value.trim()};}
 function syncURL(){history.replaceState(null,'',S.portalURL(filters()));}
 function rows(){return loaded[view]===$('schedule-date').value?data[view]:[];}
 function rebuildRooms(){
   const names=[...new Set(rows().map(x=>x.room_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
   if(selectedRoom&&!names.includes(selectedRoom))names.unshift(selectedRoom);
   $('room-filter').innerHTML='<option value="">كل القاعات</option>'+names.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
   $('room-filter').value=selectedRoom;
 }
 function normalize(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/[\u064B-\u065F]/g,'').trim();}
 function render(){
   const date=$('schedule-date').value,kind=view==='exams'?'الامتحانات':'المحاضرات';
   const query=normalize($('search').value),status=$('status-filter').value;
   const matching=rows().filter(x=>(!selectedRoom||x.room_name===selectedRoom)&&(!query||normalize([x.course_name,x.course_code,x.instructor,x.room_name,x.academic_level,x.group_number].join(' ')).includes(query)));
   $('stat-total').textContent=matching.length;
   $('stat-now').textContent=matching.filter(x=>S.state(x,view,date)==='now').length;
   $('stat-next').textContent=matching.filter(x=>S.state(x,view,date)==='upcoming').length;
   $('result-title').textContent=`${kind} · ${new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}`;
   $('data-notice').hidden=!failed[view];
   $('data-notice').textContent=loaded[view]===date?'تعذر التحديث. المعروض هو آخر بيانات تم تحميلها لهذا التاريخ؛ أعد المحاولة للتأكد من آخر التغييرات.':'تعذر تحميل هذا الجدول. تحقق من الاتصال ثم اضغط تحديث.';
   $('sync-status').dataset.error=String(failed[view]);
   $('sync-status').textContent=busy?'جارٍ تحديث الجداول…':updated[view]&&loaded[view]===date?'آخر تحديث '+new Intl.DateTimeFormat('ar-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}).format(updated[view])+' · توقيت القاهرة':'لم يتم تحميل بيانات لهذا التاريخ';
   const filtered=matching.filter(x=>!status||S.state(x,view,date)===status).sort((a,b)=>start(a)-start(b)||String(a.room_name||'').localeCompare(String(b.room_name||''),'ar',{numeric:true}));
   $('result-summary').textContent=`${filtered.length} نتيجة${selectedRoom?' · '+selectedRoom:''} · المواعيد بتوقيت القاهرة`;
   $('print-schedule').disabled=!filtered.length;
   if(!filtered.length){
     const waiting=busy&&loaded[view]!==date,error=failed[view]&&loaded[view]!==date,hasFilters=query||selectedRoom||status;
     $('results').innerHTML=`<div class="empty"><span class="empty-icon" aria-hidden="true">▦</span><h3>${waiting?'جارٍ تحميل الجداول…':error?'الجدول غير متاح حاليًا':hasFilters?'لا توجد نتائج مطابقة':`لا توجد ${kind} في هذا اليوم`}</h3><p>${waiting?'ستظهر المواعيد هنا بعد تحميلها.':error?'يمكنك إعادة المحاولة من زر تحديث.':hasFilters?'جرّب تغيير البحث أو القاعة أو الحالة.':'اختر تاريخًا آخر من أعلى الصفحة.'}</p>${hasFilters&&!waiting&&!error?'<button class="button" id="clear-filters" type="button">مسح عوامل التصفية</button>':''}</div>`;
     $('clear-filters')?.addEventListener('click',()=>{$('search').value='';$('status-filter').value='';selectedRoom='';rebuildRooms();render();syncURL();});return;
   }
   const groups=new Map();for(const row of filtered){const key=view==='exams'?String(row.start_time||'').slice(0,5):R.hhmm(start(row));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
   $('results').innerHTML=[...groups].map(([time,group])=>`<section class="period"><div class="period-heading"><time>${esc(time==='24:00'?'غير محدد':time)}</time><span>${group.length} ${view==='exams'?'لجنة':'محاضرة'}</span></div>${group.map(card).join('')}</section>`).join('');
 }
 function start(row){return view==='exams'?(R.time(row.start_time,false)??1440):(R.slot(row.time_slot)?.start??1440);}
 function card(row){
   const state=S.state(row,view,$('schedule-date').value),exam=view==='exams',slot=exam?{start:R.time(row.start_time,false),end:R.time(row.end_time,false)}:R.slot(row.time_slot);
   const times=slot&&slot.start!==null&&slot.end!==null?`${R.hhmm(slot.start)} – ${R.hhmm(slot.end)}`:'موعد غير محدد';
   const meta=[row.course_code,exam&&row.academic_level?`الفرقة ${row.academic_level}`:'',exam&&row.group_number?`مجموعة ${row.group_number}`:'',exam&&row.course_language?`لغة ${row.course_language==='E'?'إنجليزية':row.course_language==='A'?'عربية':row.course_language}`:''].filter(Boolean);
   const changes=[];if(!exam&&row.original_room&&row.original_room!==row.room_name)changes.push('تم نقل المحاضرة من '+row.original_room);if(!exam&&row.original_instructor&&row.original_instructor!==row.instructor)changes.push('تم تحديث المحاضر');
   return `<article class="schedule-card ${state}"><div class="card-time">${esc(times)}<small>توقيت القاهرة</small></div><div class="course"><h3>${esc(row.course_name||'مقرر غير محدد')}</h3><p>${esc(row.instructor||'المحاضر غير محدد')}</p><div class="course-meta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div>${changes.length?`<p class="change-note">${esc(changes.join(' · '))}</p>`:''}</div><div class="room-block"><small>القاعة</small><strong dir="auto">${esc(row.room_name||'غير محددة')}</strong><span class="badge ${state}">${S.labels[state]}</span></div></article>`;
 }
 async function refresh(){
   if(!validDate($('schedule-date').value))$('schedule-date').value=lastValidDate;
   lastValidDate=$('schedule-date').value;
   const request=++generation,date=$('schedule-date').value;busy=true;$('refresh').disabled=true;render();
   try{
     const result=view==='academic'
       ?await R.effective(supabaseClient,date)
       :await R.all(()=>supabaseClient.from('exam_schedule').select('*').eq('exam_date',date).order('start_time').order('id'));
     if(request!==generation)return;
     data[view]=result;loaded[view]=date;updated[view]=new Date();failed[view]=false;
   }catch(error){if(request!==generation)return;failed[view]=true;}
   busy=false;$('refresh').disabled=false;rebuildRooms();render();syncURL();
 }
 function changeDate(){if(!validDate($('schedule-date').value)){$('schedule-date').value=lastValidDate;return;}lastValidDate=$('schedule-date').value;followToday=false;syncURL();refresh();}
 $('schedule-date').addEventListener('change',changeDate);
 $('go-today').addEventListener('click',()=>{followToday=true;$('schedule-date').value=R.date();syncURL();refresh();});
 $('refresh').addEventListener('click',refresh);
 $('search').addEventListener('input',()=>{render();syncURL();});
 $('room-filter').addEventListener('change',()=>{selectedRoom=$('room-filter').value;render();syncURL();});
 $('status-filter').addEventListener('change',()=>{render();syncURL();});
 $('print-schedule').addEventListener('click',()=>window.print());
 function queueRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!document.hidden)refresh();},500);}
 const channel=supabaseClient.channel('public-schedule-'+view);
 for(const table of view==='academic'?['academic_schedule','schedule_actions']:['exam_schedule']){
   channel.on('postgres_changes',{event:'*',schema:'public',table},queueRefresh);
 }
 channel.subscribe();
 function tick(){if(document.hidden)return;if(followToday&&$('schedule-date').value!==R.date()){$('schedule-date').value=R.date();}if(!busy)refresh();}
 setInterval(tick,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});window.addEventListener('online',tick);
 rebuildRooms();refresh();
})();
