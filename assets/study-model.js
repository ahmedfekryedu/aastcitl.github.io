(function(root){
  'use strict';
  const days=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
  const labels=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const normalize=v=>String(v??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim().toLowerCase();
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cairo(now=new Date()){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'long'}).formatToParts(now).map(p=>[p.type,p.value]));
    return {date:`${parts.year}-${parts.month}-${parts.day}`,day:parts.weekday,minutes:Number(parts.hour)*60+Number(parts.minute)};
  }
  function slot(value){
    const text=String(value||'').replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[–—]/g,'-');
    const tokens=[...text.matchAll(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|ص|م)?/gi)];
    const parse=t=>{let h=Number(t[1]),m=Number(t[2]);if(h>23||m>59)return null;const marker=(t[3]||'').toUpperCase();if(marker){h%=12;if(marker==='PM'||marker==='م')h+=12;}else if(h<7)h+=12;return h*60+m;};
    const start=tokens[0]?parse(tokens[0]):null;let end=tokens[1]?parse(tokens[1]):null;
    if(start!==null && tokens.length===1)end=start+110;
    if(start===null||end===null||end<=start||end>=1440)return {start:null,end:null,label:text||'الوقت غير محدد'};
    const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    return {start,end,label:`${clock(start)} – ${clock(end)}`};
  }
  const day=row=>days.find((d,i)=>normalize(d)===normalize(row.day_of_week)||normalize(labels[i])===normalize(row.day_of_week))||String(row.day_of_week||'');
  function runsOn(row,date){return !(row.study_pauses||[]).some(p=>date>=p.starts_on&&date<=p.ends_on)&&(!row.term_id||(row.term_active===true&&!!date&&date>=row.term_starts_on&&date>=(row.effective_from||row.term_starts_on)&&(!row.term_ends_on||date<=row.term_ends_on)));}
  function state(row,now=cairo(),date=now.date){
    if((row.study_pauses||[]).some(p=>date>=p.starts_on&&date<=p.ends_on))return 'paused';
    if(!runsOn(row,date))return 'out_of_term';
    if(row.status==='cancelled'||(Array.isArray(row.cancelled_dates)&&row.cancelled_dates.includes(date)))return 'cancelled';
    const t=slot(row.time_slot);
    if(day(row)!==now.day||date!==now.date||t.start===null)return 'scheduled';
    return now.minutes>=t.end?'ended':now.minutes>=t.start?'live':'next';
  }
  function weekDate(weekday,now=cairo()){const d=new Date(now.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days.indexOf(weekday)-days.indexOf(now.day));return d.toISOString().slice(0,10);}
  const compare=(a,b)=> (slot(a.time_slot).start??9999)-(slot(b.time_slot).start??9999)||String(a.course_name||'').localeCompare(String(b.course_name||''),'ar');
  function filter(rows,{query='',room='',weekday=''}={}){
    const words=normalize(query).split(' ').filter(Boolean);
    return rows.filter(r=>(!room||r.room_name===room)&&(!weekday||day(r)===weekday)&&words.every(w=>normalize([r.course_name,r.course_code,r.instructor,r.room_name].join(' ')).includes(w)));
  }
  async function loadAll(client,weekday){
    const rows=[];const size=500;
    for(let offset=0;;offset+=size){
      let q=client.from('academic_schedule').select('*').order('id',{ascending:true}).range(offset,offset+size-1);
      if(weekday)q=q.eq('day_of_week',weekday);
      const {data,error}=await q;if(error)throw error;if(!Array.isArray(data))throw new Error('تعذر قراءة الجداول');
      rows.push(...data);if(data.length<size)return rows;
      if(offset>=100000)throw new Error('حجم الجدول أكبر من حد العرض؛ راجع الإدارة');
    }
  }
  root.CITLStudy=Object.freeze({days,labels,normalize,escape,cairo,slot,day,state,runsOn,weekDate,compare,filter,loadAll});
})(window);
