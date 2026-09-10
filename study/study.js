(function(){
  'use strict';
  const M=window.CITLStudy,$=id=>document.getElementById(id),key='citl-mobile-study-day-v1';
  window.CITLStudyConnection={url:'https://xgqukdbonzukxrpjovmb.supabase.co',key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM'};
  const client=window.supabase.createClient(window.CITLStudyConnection.url,window.CITLStudyConnection.key,{global:{fetch:window.CITLReadFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  let rows=[],loadedDate='',at=0,busy=false,first=true,offline=false;
  const initial=new URLSearchParams(location.search);
  const state={query:initial.get('q')||'',room:initial.get('room')||'',followToday:initial.get('day')==='today',weekday:initial.get('day')==='today'?M.cairo().day:M.days.includes(initial.get('day'))?initial.get('day'):''};
  const labels={live:'جارية الآن',next:'قادمة اليوم',cancelled:'ملغاة',scheduled:'مجدولة',ended:'انتهت اليوم'};
  function updateDate(){const now=new Date();$('study-date').innerHTML=`${new Intl.DateTimeFormat('ar-EG',{weekday:'long',timeZone:'Africa/Cairo'}).format(now)}<b>${new Intl.DateTimeFormat('ar-EG',{day:'numeric',timeZone:'Africa/Cairo'}).format(now)}</b>${new Intl.DateTimeFormat('ar-EG',{month:'short',timeZone:'Africa/Cairo'}).format(now)}`;$('study-year').textContent=now.getFullYear();}
  function render(){
    const now=M.cairo();if(state.followToday){state.weekday=now.day;$('study-day').value=now.day;}updateDate();const filtered=M.filter(rows,state);
    $('study-count').textContent=`${filtered.length} محاضرة`;$('study-results-title').textContent=state.weekday?`محاضرات ${M.labels[M.days.indexOf(state.weekday)]}`:'جدول الأسبوع';
    const groups=M.days.map((day,i)=>{const items=filtered.filter(r=>M.day(r)===day).sort(M.compare);if(!items.length)return '';
      return `<section class="day-group"><div class="day-heading"><h3>${M.labels[i]}${day===now.day?'<span class="today-label">اليوم</span>':''}</h3><span>${items.length} محاضرة</span></div><div class="day-cards">${items.map(row=>{const status=M.state(row,now,M.weekDate(M.day(row),now));return `<article class="lecture-card ${status}"><div class="lecture-body"><div class="lecture-top"><span class="lecture-time" dir="ltr">${M.escape(M.slot(row.time_slot).label)}</span><span class="lecture-state">${labels[status]}</span></div><h4>${M.escape(row.course_name||'مقرر غير مسمى')}</h4><p class="lecturer">${M.escape(row.instructor||'المحاضر غير محدد')}</p><span class="course-code" dir="auto">${M.escape(row.course_code||'')}</span></div><div class="lecture-room"><small>القاعة</small><strong dir="auto">${M.escape(row.room_name||'غير محددة')}</strong></div></article>`;}).join('')}</div></section>`;
    }).join('');
    $('study-results').innerHTML=groups||`<div class="empty-results"><h3>${loadedDate?'لا توجد محاضرات مطابقة':'لم يُحمّل الجدول بعد'}</h3><p>${loadedDate?'غيّر اسم البحث أو القاعة أو اليوم، أو امسح الفلاتر.':'اضغط تحديث الجدول عند عودة الاتصال.'}</p></div>`;
    $('study-updated').textContent=at?'آخر تحديث: '+new Date(at).toLocaleString('ar-EG',{timeZone:'Africa/Cairo',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  }
  function options(){const rooms=[...new Set(rows.map(r=>r.room_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));if(state.room&&!rooms.includes(state.room))rooms.push(state.room);
    $('study-room').replaceChildren(new Option('كل القاعات',''),...rooms.map(r=>new Option(r,r)));$('study-room').value=state.room;
  }
  function persistFilters(){const p=new URLSearchParams();if(state.room)p.set('room',state.room);if(state.weekday)p.set('day',state.followToday?'today':state.weekday);if(state.query)p.set('q',state.query);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
  async function load(){
    if(busy)return;busy=true;$('study-refresh').disabled=true;$('study-results').setAttribute('aria-busy','true');const date=M.cairo().date;
    if(loadedDate&&loadedDate!==date){rows=[];loadedDate='';at=0;render();}
    try{const incoming=await M.loadAll(client);if(M.cairo().date!==date)return;rows=incoming;at=Date.now();loadedDate=date;offline=false;$('study-status').textContent='';
      try{localStorage.setItem(key,JSON.stringify({rows,at,date}));}catch(_){}
      options();render();
    }catch(error){offline=true;if(first){try{const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached?.date===date&&Array.isArray(cached.rows)){rows=cached.rows;at=cached.at;loadedDate=date;options();}}catch(_){}}
      $('study-status').textContent=loadedDate?'تعذر التحديث. نعرض آخر جدول محفوظ اليوم؛ تحقق من وقت آخر تحديث.':'تعذر الاتصال لتحميل جدول اليوم. يمكنك إعادة المحاولة من زر التحديث.';render();
    }finally{first=false;busy=false;$('study-refresh').disabled=false;$('study-results').setAttribute('aria-busy','false');}
  }
  $('study-day').append(...M.days.map((d,i)=>new Option(M.labels[i],d)));$('study-day').value=state.weekday;$('study-search').value=state.query;
  $('study-search').addEventListener('input',()=>{state.query=$('study-search').value;persistFilters();render();});
  for(const [id,name]of [['study-room','room'],['study-day','weekday']])$(id).addEventListener('change',()=>{state[name]=$(id).value;if(name==='weekday')state.followToday=false;persistFilters();render();});
  $('study-today').addEventListener('click',()=>{state.followToday=true;state.weekday=M.cairo().day;$('study-day').value=state.weekday;persistFilters();render();});
  $('study-reset').addEventListener('click',()=>{state.followToday=false;state.query=state.room=state.weekday='';$('study-search').value=$('study-room').value=$('study-day').value='';persistFilters();render();});
  $('study-refresh').addEventListener('click',load);addEventListener('online',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  setInterval(()=>{if(!document.hidden){if(loadedDate!==M.cairo().date||offline)load();else render();}},30000);setInterval(()=>{if(!document.hidden)load();},120000);
  load();
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
