(function(){'use strict';const URL='https://xgqukdbonzukxrpjovmb.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM',sb=window.supabase.createClient(URL,KEY,{auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true}}),token=new URLSearchParams(location.search).get('t')||'';

let busy=false;
function show(text,type){
  document.getElementById('loading').classList.add('hidden');
  const result=document.getElementById('result');result.textContent=text;result.className=type;
  document.getElementById('retry').classList.toggle('hidden',type==='success');
}
async function scan(){
  if(busy)return;busy=true;
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('result').className='hidden';document.getElementById('retry').classList.add('hidden');
  let timer;const controller=new AbortController();
  try{
    if(token.length<32)throw Error('رمز QR غير صالح. امسح الرمز المثبت داخل القاعة.');
    const work=async()=>{
      const {data,error}=await sb.auth.getSession();if(error)throw error;
      if(!data?.session){
        location.replace('/?next='+encodeURIComponent('/attendance/?t='+encodeURIComponent(token)));return;
      }
      if(controller.signal.aborted)throw Error('انتهت مهلة الاتصال؛ حاول مرة أخرى');
      const {data:out,error:rpcError}=await sb.rpc('citl_attendance_scan',{p_token:token}).abortSignal(controller.signal);
      if(rpcError||!out||out.ok===false||!out.scan)throw Error(rpcError?.message||out?.error||'تعذر تسجيل الحضور');
      return out;
    };
    const out=await Promise.race([work(),new Promise((_,reject)=>{
      timer=setTimeout(()=>{controller.abort();reject(Error('انتهت مهلة الاتصال؛ حاول مرة أخرى. لو تم التسجيل ستظهر رسالة بذلك عند إعادة المحاولة.'));},15000);
    })]);
    if(out)show(`تم تسجيل الحضور بنجاح: ${out.scan.course_name} – ${out.scan.room_name}`,'success');
  }catch(error){show(error?.message||'تعذر الاتصال؛ حاول مرة أخرى','error');}
  finally{clearTimeout(timer);busy=false;}
}
document.getElementById('retry').addEventListener('click',scan);scan();
})();
