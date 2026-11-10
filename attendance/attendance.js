(async function(){'use strict';const URL='https://xgqukdbonzukxrpjovmb.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM',sb=window.supabase.createClient(URL,KEY,{auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true}}),token=new URLSearchParams(location.search).get('t')||'';
window.sb=sb;
try{await window.CITLAuth.loadProfile();}catch(error){window.CITLAuth.showFailure(error);return;}
window.presenceTracker?.startForPage('attendance');
let busy=false,preview=null,generation=0,expiry,controller;
const loading=document.getElementById('loading'),result=document.getElementById('result'),retry=document.getElementById('retry');
const confirm=document.createElement('button');confirm.type='button';confirm.id='confirm-lecture';confirm.className=retry.className;confirm.textContent='تأكيد حضوري لهذه المحاضرة';confirm.hidden=true;retry.before(confirm);
function invalidate(){generation++;preview=null;clearTimeout(expiry);confirm.hidden=true;confirm.classList.add('hidden');controller?.abort();}
function show(text,type){loading.classList.add('hidden');result.textContent=text;result.className=type;retry.classList.toggle('hidden',type==='success');}
async function request(action,payload){
 controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{const {data,error}=await sb.rpc('citl_attendance_qr142',{p_action:action,p_payload:{token,...payload}}).abortSignal(controller.signal);if(error||!data?.ok)throw Error(error?.message||'تعذر التحقق من الحضور');return data;}finally{clearTimeout(timer);}
}
async function load(){
 if(busy)return;invalidate();const turn=generation;busy=true;loading.classList.remove('hidden');result.className='hidden';retry.classList.add('hidden');
 try{
  if(token.length<32||token.length>512)throw Error('رمز القاعة غير صالح. امسح الرمز المثبت داخل القاعة.');
  const {data,error}=await sb.auth.getSession();if(error)throw error;
  if(!data?.session){location.replace('/?next='+encodeURIComponent('/attendance/?t='+encodeURIComponent(token)));return;}
  const out=await request('preview',{});if(turn!==generation||document.hidden)return;
  if(!out.preview?.session_id||!out.confirmation_required)throw Error('لم تتوفر معاينة مؤكدة للمحاضرة؛ لم يُسجل حضور.');
  preview=out.preview;
  show([preview.course_name,'كود المادة: '+(preview.course_code||'—'),'\u2066'+preview.lecture_date+' · '+preview.start_time.slice(0,5)+' – '+preview.end_time.slice(0,5)+'\u2069','القاعة: '+preview.room_name,'لم يُسجل حضور بعد. راجع المحاضرة ثم اضغط التأكيد.'].join('\n'),'info');result.style.whiteSpace='pre-line';const lines=result.textContent.split('\n');result.replaceChildren();lines.forEach((text,i)=>{const line=document.createElement(i===0?'h2':i===1?'small':'div');line.textContent=text;if(i<2)line.className=i===0?'qr-course-name':'qr-course-code';result.append(line);});
  retry.classList.add('hidden');confirm.hidden=false;confirm.classList.remove('hidden');confirm.disabled=false;
  expiry=setTimeout(()=>{invalidate();show('انتهت صلاحية المعاينة. حدّثها للتأكد من المحاضرة الحالية.','info');},Math.min(60000,Math.max(0,Date.parse(preview.previewed_at)+60000-Date.now())));
 }catch(e){if(turn===generation)show('لم يُسجل حضور: '+(e.message||'تعذر الاتصال. حدّث المعاينة.'),'error');}
 finally{busy=false;}
}
confirm.addEventListener('click',async()=>{
 if(busy||!preview||document.hidden)return;
 const selected=preview;invalidate();const turn=generation;busy=true;confirm.disabled=true;loading.classList.remove('hidden');retry.classList.add('hidden');
 try{const out=await request('confirm',{session_id:selected.session_id,lecture_date:selected.lecture_date,previewed_at:selected.previewed_at});if(turn!==generation)return;if(!out.scan)throw Error('لم يتوفر تأكيد التسجيل');show(out.already_saved?'الحضور مسجل بالفعل؛ لم تُنشأ واقعة أخرى.':'تم تسجيل الحضور عبر رمز القاعة لهذه المحاضرة: '+out.scan.course_name+' — '+out.scan.room_name,'success');}
 catch(e){if(turn===generation)show('تعذر تأكيد النتيجة. حدّث المعاينة وراجع سجل الحضور قبل المحاولة مجددًا. '+(e.message||''),'error');}
 finally{busy=false;}
});
retry.querySelector('span').textContent='تحديث معاينة المحاضرة';retry.addEventListener('click',load);
document.addEventListener('visibilitychange',()=>{if(document.hidden){invalidate();show('عدت لصفحة القاعة. حدّث معاينة المحاضرة قبل التأكيد.','info');}});
window.addEventListener('pagehide',invalidate);
window.addEventListener('pageshow',e=>{if(e.persisted){invalidate();show('حدّث معاينة المحاضرة قبل تأكيد الحضور.','info');}});
load(); // Preview only. No recording on load, reload, return, retry, or GPS check.
})();
