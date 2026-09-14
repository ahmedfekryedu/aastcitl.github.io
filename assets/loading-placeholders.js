(function(root){
  'use strict';
  const line='<span class="citl-skeleton-line" aria-hidden="true"></span>';
  const label='<span class="citl-loading-label">جارٍ تحميل البيانات…</span>';
  const summary=()=>label+'<div class="citl-skeleton-grid" aria-hidden="true">'+Array.from({length:3},()=>'<div class="citl-skeleton-card"><span class="citl-skeleton-line short"></span><span class="citl-skeleton-line tall"></span>'+line+'</div>').join('')+'</div>';
  const table=(columns=6)=>`<tr class="citl-loading-row"><td colspan="${columns}"><div class="citl-skeleton-table" role="status">${label}${line.repeat(4)}</div></td></tr>`;
  let bookingBusy=false;
  function booking(busy){
    bookingBusy=!!busy;
    const button=document.getElementById('save-meeting'),spinner=document.getElementById('save-loading');
    if(button){button.disabled=bookingBusy;button.setAttribute('aria-busy',String(bookingBusy));}
    if(spinner){spinner.hidden=!bookingBusy;spinner.classList.toggle('hidden',!bookingBusy);spinner.setAttribute('aria-hidden',String(!bookingBusy));}
  }
  root.CITLLoading={summary,table,booking,isBooking:()=>bookingBusy};
  const initial=document.getElementById('dh-loading');if(initial)initial.innerHTML=summary();
})(window);
