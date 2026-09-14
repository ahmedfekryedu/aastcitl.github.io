(function(root){
  'use strict';
  const M=root.CITLStudy,cacheKey='citl-tv-study-day-v1';
  let config={},playlist=[],lastGood=null,stale=false,currentKey='',posterOffset=0,posterTotal=0,adsPerCycle=0;
  let lastMarkup='',qrImage=null;
  const storage={get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}},set(key,v){try{localStorage.setItem(key,JSON.stringify(v));}catch(_){}}};
  const clamp=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):fallback;
  function configure(value){config={rows:clamp(value?.studyRowsPerPage,2,5,4),every:clamp(value?.studySlidesPerPoster,1,6,2),mode:value?.studyRotationMode==='grouped'?'grouped':'interleaved',adaptive:value?.studyAdaptiveDuration!==false};}
  function accept(result,date){
    if(!result.error&&Array.isArray(result.data)){lastGood={date,at:Date.now(),rows:result.data};stale=false;storage.set(cacheKey,lastGood);return result.data;}
    stale=true;const cached=lastGood?.date===date?lastGood:storage.get(cacheKey);
    if(cached?.date===date&&Array.isArray(cached.rows)){lastGood=cached;return cached.rows;}
    lastGood=null;return [];
  }
  function status(){
    if(!stale)return '';
    const time=lastGood?new Date(lastGood.at).toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="study-sync" role="status">${(root.navigator.onLine===false?'الجهاز غير متصل بالإنترنت':'تعذر تحديث الجداول مؤقتًا')+(lastGood?' · نعرض آخر تحديث اليوم '+M.escape(time):' · جارٍ إعادة المحاولة')}</div>`;
  }
  function capacity(){const h=document.getElementById('content-container')?.clientHeight||1100;return Math.min(config.rows||4,Math.max(2,Math.floor((h-330)/125)));}
  function build(rooms,data,posters){
    const now=M.cairo(),limit=capacity(),pages=[];
    for(const room of rooms){
      const rows=(data[room]||[]).filter(r=>M.day(r)===now.day&&M.state(r,now)!=='ended').sort(M.compare);
      const box=document.getElementById('content-container');
      const subjectWidth=Math.max(160,(box?.clientWidth||1080)-365);
      const needed=Math.max(125,...rows.map(r=>75+Math.ceil(String(r.course_name||'').length/Math.max(12,Math.floor(subjectWidth/16)))*42+Math.ceil(String(r.instructor||'').length/Math.max(15,Math.floor(subjectWidth/12)))*33));
      const roomLimit=Math.min(limit,Math.max(1,Math.floor(((box?.clientHeight||1100)-360)/needed)));
      for(let p=0;p<Math.ceil(rows.length/roomLimit);p++)pages.push({kind:'study',key:`room:${room}:${p}`,room,rows:rows.slice(p*roomLimit,(p+1)*roomLimit),all:rows,page:p+1,total:Math.ceil(rows.length/roomLimit)});
    }
    posterTotal=posters.length;
    const ads=posters.map((poster,i)=>({kind:'poster',key:`poster:${poster.id??i}`,poster,index:i}));
    if(!pages.length){playlist=ads;}
    else if(config.mode==='grouped'||!ads.length){playlist=[...pages,...ads];}
    else{
      // Keep all academic pages once per cycle, while rotating every poster fairly across cycles.
      playlist=[];let ad=posterOffset;
      pages.forEach((page,i)=>{playlist.push(page);if((i+1)%config.every===0||i===pages.length-1)playlist.push({...ads[ad++%ads.length],key:ads[(ad-1)%ads.length].key+':slot:'+i});});
    }
    adsPerCycle=playlist.filter(p=>p.kind==='poster').length;
    const index=playlist.findIndex(p=>p.key===currentKey);
    return index>=0?index:0;
  }
  function nextCycle(){posterOffset+=Math.max(1,adsPerCycle);}
  function focus(row,title){return `<div class="study-focus ${title==='الآن'?'study-focus-live':''}"><span>${title}</span><strong>${row?M.escape(row.course_name):title==='الآن'?'لا توجد محاضرة جارية':'لا توجد محاضرات تالية'}</strong>${row?`<small dir="ltr">${M.escape(M.slot(row.time_slot).label)}</small>`:''}</div>`;}
  function renderRoom(page,container){
    const now=M.cairo(),all=page.all,live=all.find(r=>M.state(r,now)==='live'),next=all.find(r=>M.state(r,now)==='next');
    const formattedDate=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
    const labels={live:'جارية الآن',next:'قادمة',cancelled:'ملغاة',scheduled:'مجدولة',ended:'انتهت'};
    const markup=`<section class="room-card study-screen">
      <header class="study-heading"><div class="study-heading-main"><div class="study-qr-box"><canvas id="study-tv-qr" aria-label="امسح لعرض جداول اليوم لكل القاعات على هاتفك"></canvas></div><div class="study-heading-title"><h2>جدول القاعة <bdi dir="auto">${M.escape(page.room)}</bdi></h2><div class="study-date"><i class="fas fa-calendar-day" aria-hidden="true"></i><span>يوم ${M.escape(formattedDate)}</span></div></div></div>${page.total>1?`<div class="study-page"><i class="fas fa-layer-group" aria-hidden="true"></i><span>صفحة ${page.page} من ${page.total}</span></div>`:''}</header>
      ${status()}<div class="study-focus-grid">${focus(live,'الآن')}${focus(next,'التالي')}</div>
      <div class="study-table-head"><span>التوقيت</span><span>المقرر والمحاضر</span><span>الحالة</span></div>
      <div class="study-rows" style="--study-count:${page.rows.length}">${page.rows.map(row=>{const state=M.state(row,now);return `<article class="study-row study-${state}"><div class="study-time" dir="ltr">${M.escape(M.slot(row.time_slot).label).replace(' – ','<br><span>إلى</span><br>')}</div><div class="study-subject"><h3>${M.escape(row.course_name||'مقرر غير مسمى')}</h3><p>${M.escape(row.instructor||'المحاضر غير محدد')}</p><small dir="auto">${M.escape(row.course_code||'')}</small></div><span class="study-state">${labels[state]}</span></article>`;}).join('')}</div>
      <div class="study-screen-foot"><span>جدول القاعة · ${all.length} محاضرات متبقية</span><span>التوقيت المحلي للقاهرة</span></div>
    </section>`;
    if(lastMarkup===markup&&container.querySelector('.study-rows')){const card=container.firstElementChild;card.style.opacity='';card.style.transform='';return;}
    lastMarkup=markup;container.innerHTML=markup;
    const url=new URL('/study/',location.origin);url.searchParams.set('day','today');
    const canvas=document.getElementById('study-tv-qr');
    if(qrImage){canvas.width=132;canvas.height=132;canvas.getContext('2d').drawImage(qrImage,0,0);return;}
    if(root.QRCode)root.QRCode.toCanvas(canvas,url.href,{width:132,margin:4,errorCorrectionLevel:'M',color:{dark:'#101630',light:'#ffffff'}},error=>{if(error){const fallback=document.createElement('span');fallback.className='study-qr-error';fallback.textContent='تعذر تحميل الرمز';canvas.replaceWith(fallback);}else{qrImage=document.createElement('canvas');qrImage.width=132;qrImage.height=132;qrImage.getContext('2d').drawImage(canvas,0,0);}});
  }
  function render(index,container,roomMs,posterMs,showPoster){
    const page=playlist[index%Math.max(playlist.length,1)];
    if(!page){container.innerHTML=`<section class="room-card study-screen study-empty">${status()}<h2>${stale&&!lastGood?'جدول اليوم غير متاح حاليًا':'لا توجد محاضرات متبقية في القاعات المختارة'}</h2><p>تُحدّث الشاشة تلقائيًا</p></section>`;return roomMs;}
    currentKey=page.key;
    if(page.kind==='poster'){showPoster(page.poster,page.index+1,posterTotal);return page.poster.duration?clamp(page.poster.duration,2,600,20)*1000:posterMs;}
    renderRoom(page,container);
    return config.adaptive?Math.min(120000,Math.max(roomMs,8000+page.rows.length*2500)):roomMs;
  }
  root.CITLTVStudy={configure,accept,build,render,status,nextCycle,length:()=>playlist.length,snapshot:()=>playlist.map(({all,rows,poster,...p})=>p),currentDate:()=>lastGood?.date};
  configure({});
})(window);
