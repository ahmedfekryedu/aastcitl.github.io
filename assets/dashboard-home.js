(function(root){
  'use strict';
  const S=root.CITLStudy,M=root.CITLDashboardModel,E=S.escape;
  const state={user:null,rows:[],actions:[],meetings:[],errors:[],ready:false,view:null,day:'',updated:null};
  let pending,started=false,queued;
  const $=id=>document.getElementById(id);
  const clock=minutes=>minutes===null?'—':`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  const dateLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('ar-EG',{day:'numeric',month:'long',timeZone:'Africa/Cairo'});
  const dayLabel=day=>S.labels[S.days.indexOf(day)]||day;
  const denied=()=>root.showNotification?.('هذا القسم غير متاح لصلاحيات حسابك','error');
  function openAdmin(tab){
    const r=M.role(state.user);
    if(!r.manager||(tab==='meetings'&&!r.meetings)||(tab==='users'&&!r.users)||(['news','rooms','reports'].includes(tab)&&!r.full))return denied();
    root.openAdminPanel();if(tab)root.switchAdminTab(tab);
  }
  async function readAll(table,select='*',configure=q=>q){
    const rows=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await configure(root.sb.from(table).select(select)).order('id',{ascending:true}).range(offset,offset+499);
      if(error)throw error;if(!Array.isArray(data))throw Error('تعذر قراءة البيانات');rows.push(...data);
      if(data.length<500)return rows;
    }
  }
  function updateNews(config){
    const el=$('news-ticker-content');if(!el)return;
    const text=String(config?.text||'أهلًا بكم في نظام الكلية');el.textContent=text.split('\n').filter(Boolean).join('   ✦   ');
    el.setAttribute('data-last-text',text);
    const speed=35+(Number(config?.sliderVal)||50)*1.6;
    document.documentElement.style.setProperty('--ticker-speed',`${Math.max(10,(el.scrollWidth+(el.parentElement?.clientWidth||800))/speed)}s`);
  }
  function metric(label,value,note='',gold=false){return `<div class="dh-metric${gold?' gold':''}"><div class="dh-metric-label">${E(label)}</div><div class="dh-metric-value">${E(value)}</div><div class="dh-metric-note">${E(note)}</div></div>`;}
  const empty=(title,body='')=>`<div class="dh-empty"><strong>${E(title)}</strong>${E(body)}</div>`;
  function badge(item,personal=false){
    if(item.cancelled)return '<span class="dh-badge cancelled">ملغاة</span>';
    if(personal&&!item.effectiveOwn)return '<span class="dh-badge changed">لمحاضر بديل</span>';
    if(item.live)return '<span class="dh-badge live">جارية الآن</span>';
    if(item.moved||item.replaced)return '<span class="dh-badge changed">معدّلة</span>';
    return '<span class="dh-badge">مجدولة</span>';
  }
  function lectureList(items){return `<ul class="dh-list">${items.map(x=>`<li><div class="dh-time">${clock(x.start)}</div><div class="dh-item-copy"><strong>${E(x.course_name||'محاضرة')}</strong><p>${E(x.effectiveInstructor||'')} · <bdi>${E(x.room||'القاعة غير محددة')}</bdi> · ${E(x.time)}</p></div>${badge(x)}</li>`).join('')}</ul>`;}
  function panel(title,body,subtitle='',action=''){return `<section class="dh-panel"><div class="dh-panel-head"><div><h3>${E(title)}</h3>${subtitle?`<p>${E(subtitle)}</p>`:''}</div>${action}</div>${body}</section>`;}
  function meetingList(rows,requests=false){
    return `<ul class="dh-list">${rows.map(x=>`<li><div class="dh-time">${E(String(x.start_time||'').slice(0,5))}</div><div class="dh-item-copy"><strong>${E(x.title||'حجز')}</strong><p>${E(dateLabel(x.date))} · ${E(root.getDashboardDepartmentLabel?.(x.department)||'')}</p></div>${requests?'<button class="dh-button" data-dh-admin="meetings">مراجعة</button>':'<span class="dh-badge">مؤكد</span>'}</li>`).join('')}</ul>`;
  }
  function renderFaculty(items,stats,now){
    $('dh-title').textContent='جدولي الدراسي';
    $('dh-subtitle').textContent=M.names(state.user).length?`الأسبوع الحالي · ${dateLabel(M.week(now).start)} — ${dateLabel(M.week(now).end)}`:'اربط اسمك الأكاديمي بحسابك ليظهر جدولك هنا';
    const failed=state.errors.some(x=>['schedule','actions'].includes(x));
    $('dh-metrics').innerHTML=metric('محاضرات اليوم',failed?'—':stats.ownToday.length,dayLabel(now.day))+metric('محاضرات الأسبوع',failed?'—':stats.assigned.length,'حسب الجدول الحالي')+metric('ساعات التدريس',failed?'—':stats.hours,'خلال هذا الأسبوع')+metric('القاعات',failed?'—':new Set(stats.assigned.map(x=>x.room).filter(Boolean)).size,'قاعات محاضراتك',true);
    const next=stats.next;
    const link=`<a class="dh-button" href="/schedules/" aria-label="فتح صفحة الجداول وربط اسمي">${M.names(state.user).length?'فتح الجداول':'ربط اسمي'}</a>`;
    const focus=`<div class="dh-focus"><div class="dh-focus-copy">${failed?'<strong>تعذر تحديث جدولك</strong>':next?`<span class="dh-focus-label">${next.live?'محاضرتك الآن':'المحاضرة القادمة'}</span><strong>${E(next.course_name)}</strong><span>${E(dayLabel(next.day))} · <bdi>${E(next.time)}</bdi> · القاعة <bdi>${E(next.room||'غير محددة')}</bdi>${next.moved?' · تم نقل القاعة':''}</span>`:`<strong>${M.names(state.user).length?'لا توجد محاضرات قادمة هذا الأسبوع':'ابدأ بربط اسمك الأكاديمي'}</strong><span>${M.names(state.user).length?'أي جدول جديد باسمك يظهر تلقائيًا.':'اختر اسمك المعتمد من صفحة الجداول.'}</span>`}</div>${link}</div>`;
    const options=[['','الأسبوع كاملًا'],...S.days.map((d,i)=>[d,S.labels[i]])].map(([v,l])=>`<option value="${v}"${state.day===v?' selected':''}>${l}</option>`).join('');
    const filtered=stats.own.filter(x=>!state.day||x.day===state.day);
    const table=filtered.length?`<div class="dh-scroll" tabindex="0" aria-label="جدول محاضرات الأسبوع"><table class="dh-table"><thead><tr><th>اليوم</th><th>المادة</th><th>الوقت</th><th>القاعة</th><th>الحالة</th></tr></thead><tbody>${filtered.map(x=>`<tr class="${x.cancelled?'dh-cancelled':''}"><td class="dh-day"><strong>${E(dayLabel(x.day))}</strong><small>${E(dateLabel(x.date))}</small></td><td class="dh-course"><strong>${E(x.course_name)}</strong><small>${E(x.course_code||'')}${x.replaced?` · ${E(x.effectiveInstructor)}`:''}</small>${x.action?.reason?`<small>${E(x.action.reason)}</small>`:''}</td><td><bdi>${E(x.time)}</bdi></td><td><bdi>${E(x.room||'—')}</bdi></td><td>${badge(x,true)}</td></tr>`).join('')}</tbody></table></div>`:empty(M.names(state.user).length?'لا توجد محاضرات باسمك في هذا العرض':'ابدأ بربط اسمك الأكاديمي',M.names(state.user).length?'قد يكون الجدول قيد التحديث. ارتباط حسابك باسمك محفوظ.':'الربط باسمك المعتمد يتيح عرض جدولك تلقائيًا.');
    $('dh-workspace').innerHTML=`<div class="dh-personal">${focus}${panel('تفاصيل الجدول',failed?empty('تعذر تحميل التفاصيل'):table,'',`<select id="dh-day-filter" class="dh-select" aria-label="يوم الجدول">${options}</select>`)}</div>`;
  }
  function summaryCard(title,totalLabel,total,facts,footer,extraClass=''){
    return `<article class="dh-summary-card ${extraClass}"><div class="dh-summary-head"><h3>${E(title)}</h3>${metric(totalLabel,total)}</div><div class="dh-facts">${facts.join('')}</div><div class="dh-summary-foot">${footer}</div></article>`;
  }
  function renderOverview(items,stats,now){
    const r=M.role(state.user),failed=state.errors.some(x=>['schedule','actions'].includes(x)),meetingFailed=state.errors.includes('meetings');
    $('dh-title').textContent=r.manager?'متابعة اليوم':'نظرة على اليوم';
    $('dh-subtitle').textContent=`${dayLabel(now.day)}، ${dateLabel(now.date)} · توقيت القاهرة`;
    const available=stats.available.length,busy=stats.rooms.length-available;
    const usage=stats.rooms.length?Math.round(busy/stats.rooms.length*100):0;
    const next=stats.today.filter(x=>x.start!==null&&x.start>now.minutes).sort((a,b)=>a.start-b.start)[0];
    const ended=stats.today.filter(x=>x.end!==null&&x.end<=now.minutes).length;
    const upcoming=stats.today.filter(x=>x.start!==null&&x.start>now.minutes).length;
    const cancelled=items.filter(x=>x.date===now.date&&x.cancelled).length;
    const roomDetails=failed?'تعذر تحديث القاعات':`<span>الإشغال حسب المحاضرات</span><details class="dh-room-details"><summary>القاعات المتاحة</summary><div>${stats.available.map(x=>`<span><bdi>${E(x)}</bdi></span>`).join('')||'لا توجد قاعات متاحة دراسيًا الآن'}</div></details>`;
    const rooms=summaryCard('حالة القاعات الآن','قاعات الدراسة',failed?'—':stats.rooms.length,[metric('قاعات بلا محاضرات',failed?'—':available),metric('مشغولة الآن',failed?'—':busy),metric('نسبة الإشغال',failed?'—':usage+'%')],roomDetails);
    const lectureFooter=failed?'تعذر تحديث المحاضرات':`<span class="dh-next-lecture" title="${E(next?next.course_name+' · '+next.room:'')}">${next?`القادمة <bdi>${clock(next.start)}</bdi> · ${E(next.course_name)}`:stats.live.length?'المحاضرات الحالية مستمرة':'لا توجد محاضرات تالية اليوم'}</span>${cancelled?`<span class="dh-cancel-note">ملغاة اليوم: ${cancelled}</span>`:''}`;
    const lectures=summaryCard('محاضرات اليوم','محاضرات اليوم',failed?'—':stats.today.length,[metric('محاضرات جارية',failed?'—':stats.live.length),metric('انتهت',failed?'—':ended),metric('لم تبدأ',failed?'—':upcoming)],lectureFooter,'dh-lecture-summary');
    let administration='';
    if(r.meetings){
      const b=M.bookings(state.meetings,state.user,now);
      const nextText=meetingFailed?'تعذر التحديث':b.next?`التالي <bdi>${clock(b.next.start)}</bdi>`:'لا يوجد حجز تالٍ اليوم';
      administration=summaryCard('الحجوزات الإدارية','حجوزات مؤكدة اليوم',meetingFailed?'—':b.confirmed.length,[metric('حجوزات جارية',meetingFailed?'—':b.live.length),metric('طلبات تحتاج إجراء',meetingFailed?'—':b.requests.length),metric('تعارضات القاعات',meetingFailed||b.conflicts===null?'—':b.conflicts)],`<span>${nextText}</span><button class="dh-button" data-dh-admin="meetings">مراجعة الحجوزات</button>`,'dh-admin-summary');
    }
    $('dh-workspace').innerHTML=`<div class="dh-summary-grid${r.meetings?' dh-with-admin':''}">${rooms}${lectures}${administration}</div>${r.users&&!r.meetings?'<div class="dh-permission-link"><button class="dh-button" data-dh-admin="users">إدارة المستخدمين</button></div>':''}`;
    $('dh-metrics').innerHTML='';
  }

  function render(){
    if(!state.user)return;const now=S.cairo(),r=M.role(state.user);
    if(!r.faculty&&state.view==='faculty')state.view='overview';
    if(!r.manager&&r.faculty)state.view='faculty';
    if(!state.view)state.view=r.faculty?'faculty':'overview';
    $('dashboard-home').dataset.view=state.view;
    $('dh-metrics').hidden=state.view!=='faculty';
    const items=M.lectures(state.rows,state.actions,state.user,now),stats=M.statistics(items,state.user,now);
    $('dh-role-tabs').hidden=!(r.manager&&r.faculty);
    for(const button of $('dh-role-tabs').querySelectorAll('button'))button.setAttribute('aria-selected',String(button.dataset.dhView===state.view));
    $('dh-admin-link').hidden=!r.manager;
    $('dh-errors').hidden=!state.errors.length;
    $('dh-errors').textContent=state.errors.includes('profile')?'تعذر التحقق من حسابك؛ أعد المحاولة.':'تعذر تحديث بعض البيانات. الأرقام غير المتاحة تظهر بشرطة، ويمكنك إعادة المحاولة.';
    if(state.view==='faculty')renderFaculty(items,stats,now);else renderOverview(items,stats,now);
    $('dh-updated').textContent=state.updated?'آخر تحديث '+new Date(state.updated).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}):'جاري التحديث';
    $('dh-loading').hidden=true;$('dh-content').hidden=false;
  }
  async function refresh(){
    if(!started)return;if(pending)return pending;
    pending=(async()=>{
      $('dh-refresh').disabled=true;
      let profile;
      try{profile=await root.CITLAuth.loadProfile();}
      catch(error){
        state.user=null;state.rows=[];state.actions=[];state.meetings=[];state.errors=['profile'];
        $('dh-content').hidden=true;$('dh-loading').hidden=false;$('dh-loading').innerHTML=empty('تعذر التحقق من حسابك','استخدم إعادة المحاولة للمتابعة.');
        $('dh-admin-link').hidden=true;
        root.clearDashboardPrivateState?.();root.CITLAuth.showFailure(error);return;
      }
      const oldKey=state.user&&JSON.stringify([state.user.id,M.role(state.user),M.names(state.user)]);
      $('citl-connection-recovery')?.remove();
      const newKey=JSON.stringify([profile.id,M.role(profile),M.names(profile)]);
      if(oldKey&&oldKey!==newKey){state.view=null;state.meetings=[];state.rows=[];state.actions=[];root.clearDashboardPrivateState?.();$('dh-content').hidden=true;}
      state.user=profile;root.setDashboardProfile?.(profile);
      const r=M.role(profile),week=M.week(),today=S.cairo().date;
      $('dh-admin-link').hidden=!r.manager;
      const jobs=[S.loadAll(root.sb),readAll('schedule_actions','*',q=>q.gte('action_date',week.start).lte('action_date',week.end)),
        r.meetings?readAll('meetings','id,title,date,start_time,end_time,status,department,room_id',q=>q.or(`date.eq.${today},status.in.(pending,modification_requested,cancellation_requested,deletion_requested)`)):Promise.resolve([]),
        root.sb.from('site_settings').select('setting_value').eq('setting_key','news_config').maybeSingle()];
      const result=await Promise.allSettled(jobs);state.errors=[];
      ['rows','actions','meetings'].forEach((key,i)=>{state[key]=result[i].status==='fulfilled'?result[i].value:[];if(result[i].status==='rejected')state.errors.push(['schedule','actions','meetings'][i]);});
      // A missing action feed must never show an old room or an uncancelled personal lecture as current.
      if(state.errors.includes('actions'))state.rows=[];
      const news=result[3];if(news.status==='fulfilled'&&!news.value.error)updateNews(news.value.data?.setting_value);
      else if(!$('news-ticker-content')?.getAttribute('data-last-text'))updateNews({text:'تعذر تحديث شريط الأخبار مؤقتًا'});
      state.updated=Date.now();state.ready=true;render();
    })().finally(()=>{pending=null;$('dh-refresh').disabled=false;});
    return pending;
  }
  function requestRefresh(){clearTimeout(queued);queued=setTimeout(refresh,250);}
  function start(){
    if(started)return refresh();started=true;
    $('dh-refresh').addEventListener('click',refresh);
    $('dashboard-home').addEventListener('click',event=>{
      const admin=event.target.closest('[data-dh-admin]');if(admin){openAdmin(admin.dataset.dhAdmin);return;}
      const tab=event.target.closest('[data-dh-view]');if(tab){state.view=tab.dataset.dhView;render();}
    });
    $('dashboard-home').addEventListener('change',event=>{if(event.target.id==='dh-day-filter'){state.day=event.target.value;render();}});
    setInterval(()=>{if(!document.hidden)refresh();},60000);
    root.addEventListener('focus',requestRefresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh();});
    const channel=root.sb.channel('dashboard-home-current');
    ['academic_schedule','schedule_actions','profiles','meetings','site_settings'].forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table},requestRefresh));channel.subscribe();
    return refresh();
  }
  root.CITLDashboard=Object.freeze({start,refresh,openAdmin});
})(window);
