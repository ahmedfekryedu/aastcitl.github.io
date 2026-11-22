(function(root){
  'use strict';
  const M=root.CITLStudy,cacheKey='citl-tv-study-day-v1';
  let config={},playlist=[],lastGood=null,stale=false,currentKey='',posterOffset=0,posterTotal=0,adsPerCycle=0;
  let lastMarkup='',qrImage=null;
  const storage={get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;}},set(key,v){try{localStorage.setItem(key,JSON.stringify(v));}catch(_){}}};
  const clamp=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):fallback;
  function configure(value){config={roomWindows:value?.studyRoomWindows||{},enabled:value?.studyEnhancedDisplayEnabled!==false,rows:clamp(value?.studyRowsPerPage,2,5,4),every:clamp(value?.studySlidesPerPoster,1,6,2),mode:value?.studyRotationMode==='grouped'?'grouped':'interleaved',adaptive:value?.studyAdaptiveDuration!==false};}
  function accept(result,date){
    if(!result.error&&Array.isArray(result.data)){lastGood={date,at:Date.now(),rows:result.data};stale=false;storage.set(cacheKey,lastGood);return result.data;}
    stale=true;const cached=lastGood?.date===date?lastGood:storage.get(cacheKey);
    if(cached?.date===date&&Array.isArray(cached.rows)){lastGood=cached;return cached.rows;}
    lastGood=null;return [];
  }
  function status(){
    if(!stale)return '';
    const time=lastGood?new Date(lastGood.at).toLocaleTimeString('ar-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="study-sync" role="status"><i class="fas fa-wifi" aria-hidden="true"></i> ${(root.navigator.onLine===false?'الجهاز غير متصل بالإنترنت':'تعذر تحديث الجداول مؤقتًا')+(lastGood?' · نعرض آخر تحديث اليوم '+M.escape(time):' · جارٍ إعادة المحاولة')}</div>`;
  }
  function capacity(){const h=document.getElementById('content-container')?.clientHeight||1100;return Math.min(config.enabled?(config.rows||4):5,Math.max(2,Math.floor((h-330)/125)));}
  function build(rooms,data,posters){
    const now=M.cairo(),limit=capacity(),pages=[];
    posters=posters.filter(p=>root.CITLDisplayDates.allows(p,now.date));
    rooms=rooms.filter(room=>root.CITLDisplayDates.allows(config.roomWindows?.[room],now.date));
    for(const room of rooms){
      const rows=(data[room]||[]).filter(r=>M.day(r)===now.day&&M.runsOn(r,now.date)&&M.state(r,now)!=='ended').sort(M.compare);
      const box=document.getElementById('content-container');
      const subjectWidth=Math.max(160,(box?.clientWidth||1080)-365);
      const needed=Math.max(125,...rows.map(r=>75+Math.ceil(String(r.course_name||'').length/Math.max(12,Math.floor(subjectWidth/16)))*42+Math.ceil(String(r.instructor||'').length/Math.max(15,Math.floor(subjectWidth/12)))*33));
      const roomLimit=Math.min(limit,Math.max(1,Math.floor(((box?.clientHeight||1100)-360)/needed)));
      for(let p=0;p<Math.ceil(rows.length/roomLimit);p++)pages.push({kind:'study',key:`room:${room}:${p}`,room,rows:rows.slice(p*roomLimit,(p+1)*roomLimit),all:rows,page:p+1,total:Math.ceil(rows.length/roomLimit)});
    }
    if (!pages.length && rooms.length) {
      const ended = rooms.some(room => (data[room] || []).some(r => M.day(r) === now.day && M.state(r,now) === 'ended'));
      pages.push({kind:'study-end',key:'study-day-status',ended});
    }
    posterTotal=posters.length;
    const ads=posters.map((poster,i)=>({kind:'poster',key:`poster:${poster.id??i}`,poster,index:i,total:posters.length}));
    if(!pages.length){playlist=ads;}
    else if(!config.enabled||config.mode==='grouped'||!ads.length){playlist=[...pages,...ads];}
    else{
      // Keep all academic pages once per cycle, while rotating every poster fairly across cycles.
      playlist=[];let ad=posterOffset;
      pages.forEach((page,i)=>{playlist.push(page);if((i+1)%config.every===0||i===pages.length-1)playlist.push({...ads[ad++%ads.length],key:ads[(ad-1)%ads.length].key+':slot:'+i});});
    }
    adsPerCycle=playlist.filter(p=>p.kind==='poster').length;
    let index=playlist.findIndex(p=>p.key===currentKey);
    if(index<0&&currentKey.startsWith('poster:')){
      const pid=currentKey.split(':')[1];
      index=playlist.findIndex(p=>p.kind==='poster'&&(p.key===`poster:${pid}`||p.key.startsWith(`poster:${pid}:`)));
    }
    return index>=0?index:0;
  }
  function nextCycle(){posterOffset+=Math.max(1,adsPerCycle);}
  function focus(row,title){
    const isLive=title==='الآن';
    const icon=isLive?'fa-broadcast-tower':'fa-forward';
    const badge=isLive?(row?'<span class="study-focus-pill live"><i class="fas fa-circle" aria-hidden="true"></i> الآن</span>':'<span class="study-focus-pill idle">متاحة</span>'):'<span class="study-focus-pill next"><i class="fas fa-clock" aria-hidden="true"></i> التالي</span>';
    return `<div class="study-focus ${isLive?(row?'study-focus-live':'study-focus-idle'):'study-focus-next'}">
      <div class="study-focus-top"><span class="study-focus-label"><i class="fas ${icon}" aria-hidden="true"></i> ${title}</span>${badge}</div>
      <strong>${row?M.escape(row.course_name):isLive?'القاعة متاحة حاليًا':'لا توجد محاضرات تالية'}</strong>
      <div class="study-focus-meta">${row?`<small class="study-focus-time" dir="ltr"><i class="far fa-clock" aria-hidden="true"></i> ${M.escape(M.slot(row.time_slot).label)}</small>${row.instructor?`<span class="study-focus-inst"><i class="fas fa-user-tie" aria-hidden="true"></i> ${M.escape(row.instructor)}</span>`:''}`:`<span class="study-focus-inst">${isLive?'جاهزة للاستخدام أو انتظار المحاضرة القادمة':'انتهت باقي الفترات المجدولة'}</span>`}</div>
    </div>`;
  }
  function renderRoom(page,container){
    const now=M.cairo(),all=page.all,live=all.find(r=>M.state(r,now)==='live'),next=all.find(r=>M.state(r,now)==='next');
    const formattedDate=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date());
    const labels={live:'جارية الآن',next:'قادمة',cancelled:'ملغاة',scheduled:'مجدولة',ended:'انتهت'};
    const icons={live:'fa-circle-play',next:'fa-clock',cancelled:'fa-ban',scheduled:'fa-calendar-check',ended:'fa-check'};
    const roomBadge=live
      ? `<span class="study-room-pill is-live"><span class="study-dot"></span> مشغولة الآن</span>`
      : `<span class="study-room-pill is-free"><i class="fas fa-check-circle" aria-hidden="true"></i> متاحة الآن</span>`;
    const markup=`<section class="room-card study-screen study-pro">
      <header class="study-heading">
        <div class="study-heading-main">
          <div class="study-qr-box"><canvas id="study-tv-qr" aria-label="امسح لعرض جداول اليوم لكل القاعات على هاتفك"></canvas><span class="study-qr-cap">امسح للجدول</span></div>
          <div class="study-heading-title">
            <div class="study-kicker-row">${roomBadge}<span class="study-count-chip"><i class="fas fa-list-ul" aria-hidden="true"></i> ${all.length} متبقية اليوم</span></div>
            <h2><i class="fas fa-door-open study-room-ico" aria-hidden="true"></i> قاعة <bdi dir="auto">${M.escape(page.room)}</bdi></h2>
            <div class="study-date"><i class="fas fa-calendar-day" aria-hidden="true"></i><span>يوم ${M.escape(formattedDate)}</span></div>
          </div>
        </div>
        ${page.total>1?`<div class="study-page"><i class="fas fa-layer-group" aria-hidden="true"></i><span>صفحة ${page.page} من ${page.total}</span></div>`:''}
      </header>
      ${status()}<div class="study-focus-grid">${focus(live,'الآن')}${focus(next,'التالي')}</div>
      <div class="study-table-head"><span><i class="far fa-clock" aria-hidden="true"></i> التوقيت</span><span><i class="fas fa-book-open" aria-hidden="true"></i> المقرر والمحاضر</span><span><i class="fas fa-signal" aria-hidden="true"></i> الحالة</span></div>
      <div class="study-rows" style="--study-count:${page.rows.length}">${page.rows.map((row,idx)=>{const state=M.state(row,now);const codeHtml=row.course_code?`<small class="study-code-pill" dir="auto"><i class="fas fa-hashtag" aria-hidden="true"></i> ${M.escape(row.course_code)}</small>`:'';return `<article class="study-row study-${state}" style="--row-delay:${idx*55}ms"><div class="study-time" dir="ltr">${M.escape(M.slot(row.time_slot).label).replace(' – ','<br><span>إلى</span><br>')}</div><div class="study-subject"><h3>${M.escape(row.course_name||'مقرر غير مسمى')}</h3><div class="study-subject-meta"><p><span class="study-inst-ico"><i class="fas fa-user-tie" aria-hidden="true"></i></span><span>${M.escape(row.instructor||'المحاضر غير محدد')}</span></p>${codeHtml}</div></div><span class="study-state"><i class="fas ${icons[state]||'fa-clock'}" aria-hidden="true"></i> ${labels[state]}</span></article>`;}).join('')}</div>
      <div class="study-screen-foot"><span><i class="fas fa-university" aria-hidden="true"></i> جدول القاعة · ${all.length} محاضرات متبقية</span><span><i class="far fa-clock" aria-hidden="true"></i> التوقيت المحلي للقاهرة</span></div>
    </section>`;
    if(lastMarkup===markup&&container.querySelector('.study-rows')){const card=container.firstElementChild;card.style.opacity='';card.style.transform='';return;}
    lastMarkup=markup;container.innerHTML=markup;
    drawStudyQr();
  }
  function drawStudyQr(){
    const url=new URL('/study/',location.origin);url.searchParams.set('day','today');
    const canvas=document.getElementById('study-tv-qr');
    if(!canvas)return;
    if(qrImage){canvas.width=qrImage.width;canvas.height=qrImage.height;canvas.getContext('2d').drawImage(qrImage,0,0);return;}
    if(root.QRCode)root.QRCode.toCanvas(canvas,url.href,{width:156,margin:4,errorCorrectionLevel:'M',color:{dark:'#101630',light:'#ffffff'}},error=>{if(error){const fallback=document.createElement('span');fallback.className='study-qr-error';fallback.textContent='تعذر تحميل الرمز';canvas.replaceWith(fallback);}else{qrImage=document.createElement('canvas');qrImage.width=canvas.width;qrImage.height=canvas.height;qrImage.getContext('2d').drawImage(canvas,0,0);}});
  }
  function render(index,container,roomMs,posterMs,showPoster){
    const page=playlist[index%Math.max(playlist.length,1)];
    if(!page){const markup='<section class="room-card study-screen study-empty"><h2>لا توجد محاضرات الآن</h2></section>';if(!container.querySelector('.study-empty'))container.innerHTML=markup;return roomMs;}
    currentKey=page.key;
    if(page.kind==='poster'){showPoster(page.poster,page.index+1,posterTotal);return page.poster.duration?clamp(page.poster.duration,2,600,20)*1000:posterMs;}
    if(page.kind==='study-end'){
      const title=stale&&!lastGood?'جدول اليوم غير متاح حاليًا':page.ended?'انتهى اليوم الدراسي':'لا توجد محاضرات اليوم في القاعات المختارة';
      const markup=`<section class="room-card study-screen study-pro study-end-screen"><header class="study-heading"><div class="study-heading-main"><div class="study-qr-box"><canvas id="study-tv-qr" aria-label="جداول الدراسة على الهاتف"></canvas><span class="study-qr-cap">امسح للجدول</span></div><div class="study-heading-title"><h2>الجداول الدراسية</h2></div></div></header>${status()}<div class="study-end-message"><h2>${title}</h2><p>يمكنك مراجعة الجداول الدراسية على هاتفك عبر رمز QR</p></div></section>`;
      if(lastMarkup!==markup||!container.querySelector('.study-end-screen')){lastMarkup=markup;container.innerHTML=markup;drawStudyQr();}
      container.firstElementChild.style.opacity='';return roomMs;
    }
    renderRoom(page,container);
    return config.enabled&&config.adaptive?Math.min(120000,Math.max(roomMs,8000+page.rows.length*2500)):roomMs;
  }
  root.CITLTVStudy={configure,accept,build,render,status,nextCycle,length:()=>playlist.length,snapshot:()=>playlist.map(({all,rows,poster,...p})=>p),currentDate:()=>lastGood?.date};
  configure({});
})(window);
