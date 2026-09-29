(function(root){
  'use strict';
  const S=root.CITLStudy,P=root.CITLPermissions;
  const names=user=>(Array.isArray(user?.linked_instructors)?user.linked_instructors:[]).map(S.normalize).filter(Boolean);
  function role(user){
    const full=P.full(user),approve=P.can(user,'can_approve'),remove=P.can(user,'can_delete'),users=P.can(user,'can_manage_users');
    return {full,approve,remove,users,manager:full||approve||remove||users,meetings:full||approve||remove,
      faculty:user?.account_type==='faculty'||user?.account_type==='visiting_lecturer'||user?.is_visiting_lecturer===true};
  }
  function week(now=S.cairo()){
    const start=S.weekDate('Saturday',now),end=S.weekDate('Friday',now);
    return {start,end};
  }
  function lectures(rows,actions,user,now=S.cairo()){
    const linked=new Set(names(user)),range=week(now),byLecture=new Map();
    for(const a of actions)if(a.action_date>=range.start&&a.action_date<=range.end)byLecture.set(String(a.schedule_id)+'|'+a.action_date,a);
    return rows.map(row=>{
      const day=S.day(row);if(!S.days.includes(day))return null;
      const date=S.weekDate(day,now),action=byLecture.get(String(row.id)+'|'+date),slot=S.slot(row.time_slot);
      if(!S.runsOn(row,date))return null;
      const replaced=['replace','replace_and_move'].includes(action?.action_type),moved=['move_room','replace_and_move'].includes(action?.action_type);
      const effectiveInstructor=replaced?action.replacement_instructor:row.instructor;
      const cancelled=S.normalize(row.status)==='cancelled'||(Array.isArray(row.cancelled_dates)&&row.cancelled_dates.includes(date))||action?.action_type==='cancel';
      const originalOwn=linked.has(S.normalize(row.instructor)),effectiveOwn=linked.has(S.normalize(effectiveInstructor));
      return {...row,day,date,start:slot.start,end:slot.end,time:slot.label,action,originalOwn,effectiveOwn,
        room:moved?action.replacement_room:row.room_name,effectiveInstructor,cancelled,replaced,moved,
        own:originalOwn||effectiveOwn,assigned:effectiveOwn&&!cancelled,
        live:!cancelled&&date===now.date&&slot.start!==null&&now.minutes>=slot.start&&now.minutes<slot.end};
    }).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||(a.start??9999)-(b.start??9999)||String(a.course_name).localeCompare(String(b.course_name),'ar'));
  }
  function statistics(items,user,now=S.cairo()){
    const active=items.filter(x=>!x.cancelled),today=active.filter(x=>x.date===now.date),live=today.filter(x=>x.live);
    const rooms=new Set(active.map(x=>x.room).filter(Boolean)),busy=new Set(live.map(x=>x.room).filter(Boolean));
    const own=items.filter(x=>x.own),assigned=own.filter(x=>x.assigned),ownToday=assigned.filter(x=>x.date===now.date);
    const future=assigned.filter(x=>x.start!==null&&(x.date>now.date||(x.date===now.date&&x.end>now.minutes)));
    return {today,live,rooms:[...rooms].sort(),available:[...rooms].filter(x=>!busy.has(x)).sort(),own,assigned,ownToday,
      next:future[0]||null,hours:Math.round(assigned.reduce((sum,x)=>sum+(x.start===null?0:x.end-x.start),0)/60*10)/10};
  }
  function pending(rows,user){const r=role(user);return rows.filter(x=>(r.approve&&['pending','modification_requested','cancellation_requested','deletion_requested'].includes(x.status))||(r.remove&&['cancellation_requested','deletion_requested'].includes(x.status)));}
  function bookings(rows,user,now=S.cairo()){
    const minutes=value=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(value||''));return m&&+m[1]<24&&+m[2]<60?+m[1]*60+(+m[2]):null;};
    const confirmed=rows.filter(x=>x.date===now.date&&x.status==='confirmed').map(x=>({...x,start:minutes(x.start_time),end:minutes(x.end_time)}));
    const valid=confirmed.filter(x=>x.start!==null&&x.end!==null&&x.end>x.start);
    let conflicts=confirmed.some(x=>!x.room_id||x.start===null||x.end===null||x.end<=x.start)?null:0;
    if(conflicts!==null)for(let i=0;i<confirmed.length;i++)for(let j=i+1;j<confirmed.length;j++){
      const a=confirmed[i],b=confirmed[j];if(a.room_id===b.room_id&&a.start<b.end&&b.start<a.end)conflicts++;
    }
    return {confirmed,requests:pending(rows,user),live:valid.filter(x=>x.start<=now.minutes&&x.end>now.minutes),next:valid.filter(x=>x.start>now.minutes).sort((a,b)=>a.start-b.start)[0]||null,conflicts};
  }
  root.CITLDashboardModel=Object.freeze({role,names,week,lectures,statistics,pending,bookings});
})(window);
