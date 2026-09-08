(function(){
 'use strict';
 const R=CITLRuntime,S=CITLSchedule,e=R.escape;
 window.CITLDisplay={renderExams(page){
   const items=page.items||[],count=items.filter(x=>!x.isDivider).length;
   const date=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(page.dateStr+'T12:00:00Z'));
   return `<section class="room-card glass-panel exam-board ${count>7?'dense':''}" aria-label="جداول الامتحانات"><div class="exam-hero"><div><div class="exam-eyebrow" lang="en">CITL · EXAM SCHEDULE</div><h2>جداول امتحانات اليوم</h2><p>${e(date)} · توقيت القاهرة</p></div><div class="exam-pagination">صفحة <b>${page.currentPage}</b> من <b>${page.totalPages}</b></div></div><div class="exam-body"><div class="exam-columns"><div>المقرر والفرقة</div><div>محاضر المادة</div><div style="text-align:center">التوقيت</div><div style="text-align:center">القاعة</div><div style="text-align:center">الحالة</div></div><div class="exam-entries">${items.map(item=>{
     if(item.isDivider)return `<div class="exam-period"><span>الفترة ${item.isContinuation?'· يتبع':''}</span><time>${e(String(item.startTime||'').slice(0,5))} – ${e(String(item.endTime||'').slice(0,5))}</time></div>`;
     const x=item.exam,state=S.state(x,'exams',page.dateStr);
     return `<article class="exam-entry ${state}"><div><h3 class="exam-course">${e(x.course_name||'مقرر غير محدد')}</h3><p class="exam-meta">${e(x.course_code)} · الفرقة ${e(x.academic_level)} · مجموعة ${e(x.group_number)} · ${e(x.course_language==='E'?'إنجليزي':x.course_language==='A'?'عربي':x.course_language||'')}</p></div><div class="exam-instructor">${e(x.instructor||'غير محدد')}</div><div class="exam-time">${e(String(x.start_time||'').slice(0,5))}<br><span>–</span><br>${e(String(x.end_time||'').slice(0,5))}</div><div class="exam-room" dir="auto">${e(x.room_name||'غير محددة')}</div><div><span class="exam-badge ${state}">${S.labels[state]}</span></div></article>`;
   }).join('')}</div></div></section>`;
 }};
 let qrRequest=0;
 const qrImages=new Map();
 window.CITLDisplay.showScheduleQR=async kind=>{
   const request=++qrRequest;
   const link=document.getElementById('tv-portal-link'),img=document.getElementById('tv-portal-qr');
   link.hidden=true;
   if(!kind)return;
   const label=kind==='academic'?'الجداول الدراسية':'جداول الامتحانات';
   const url=S.portalURL({view:kind});
   link.href=url;link.setAttribute('aria-label','فتح '+label);
   img.alt='QR '+label;
   document.getElementById('tv-qr-title').textContent=label+' على هاتفك';
   document.getElementById('tv-qr-hint').textContent='امسح الرمز واحفظ الصفحة في المفضلة';
   try{
     if(!qrImages.has(kind))qrImages.set(kind,QRCode.toDataURL(url,{width:360,margin:4,errorCorrectionLevel:'M',color:{dark:'#172441',light:'#ffffff'}}));
     const source=await qrImages.get(kind);
     if(request!==qrRequest)return;
     img.src=source;img.hidden=false;link.hidden=false;
   }catch{qrImages.delete(kind);}
 };
})();
