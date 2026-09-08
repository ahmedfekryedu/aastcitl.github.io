(function(root){
  'use strict';
  const R=root.CITLRuntime;
  function portalURL(filters={}){
    const url=new URL(filters.view==='academic'?'/study/':'/today/',root.location.origin);
    for(const key of ['date','room','status','q'])if(filters[key])url.searchParams.set(key,filters[key]);
    return url.href;
  }
  function state(row,kind,date=R.date()){
    if(row.status==='cancelled'||(Array.isArray(row.cancelled_dates)&&row.cancelled_dates.includes(date)))return 'cancelled';
    const slot=kind==='exams'?{start:R.time(row.start_time,false),end:R.time(row.end_time,false)}:R.slot(row.time_slot);
    if(!slot||slot.start===null||slot.end===null||slot.end<=slot.start)return 'unknown';
    if(date<R.date())return 'ended';
    if(date>R.date())return 'upcoming';
    const now=R.minutes();return now>=slot.end?'ended':now>=slot.start?'now':'upcoming';
  }
  const labels={now:'جاري الآن',upcoming:'قادمة',ended:'انتهت',cancelled:'ملغاة',unknown:'موعد غير محدد'};
  root.CITLSchedule={portalURL,state,labels};
})(window);
