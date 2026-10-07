(function(root){
 'use strict';
 const URL='https://xgqukdbonzukxrpjovmb.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhncXVrZGJvbnp1a3hycGpvdm1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTg4MDMsImV4cCI6MjA3OTQ3NDgwM30.3-70d7uB-zjVF7Jfr8ZjITT7suYPo3EWsYngO-sFVqM';
 root.sb=root.supabase.createClient(URL,KEY,{global:{fetch:root.CITLReadFetch},auth:{storageKey:'sb-main-auth',persistSession:true,autoRefreshToken:true}});
 const $=id=>document.getElementById(id);let busy=false,timer,entering=false;
 function enter(){if(entering)return;entering=true;clearTimeout(timer);location.replace('/dashboard/');}
 async function refresh(manual=false){
  if(busy)return;busy=true;$('account-refresh').disabled=true;
  try{
   const profile=await root.CITLAuth.loadProfile();
   if(!root.CITLAuth.facultyPending(profile)){enter();return;}
   const mine=await root.CITLRequests.rpc(root.sb,'citl_faculty_links',{p_action:'mine'}),request=mine.requests?.[0];
   const rejected=profile.faculty_verification_status==='rejected';
   $('account-state').textContent=rejected?'يحتاج الطلب إلى مراجعة':'بانتظار اعتماد الإدارة';
   $('account-title').textContent=rejected?'راجع الاسم الأكاديمي المطلوب':'حسابك جاهز، وفي انتظار الاعتماد';
   $('account-description').textContent=rejected?'لم تعتمد الإدارة طلب الربط. يمكنك تصحيح الاسم وإرسال طلب جديد من نفس الحساب.':'تم استلام طلب ربط حسابك بعضو هيئة التدريس. ستتاح لك خدمات النظام فور موافقة الإدارة.';
   $('account-name').textContent=profile.full_name||'عضو هيئة تدريس';$('account-email').textContent=profile.email||'';
   $('account-instructor').textContent=request?.instructor_name||'لم يتم إرسال طلب بعد';
   document.querySelectorAll('.account-skeleton').forEach(el=>el.classList.remove('account-skeleton'));
   $('account-edit').hidden=profile.faculty_verification_status==='pending';
   if(profile.faculty_verification_status==='pending')$('account-editor').replaceChildren();
   $('account-feedback').textContent=manual?'تم تحديث الحالة. طلبك '+(rejected?'يحتاج إلى مراجعة.':'ما زال بانتظار الاعتماد.'):'يتم تحديث حالة الطلب تلقائيًا.';
   document.querySelector('.account-card').setAttribute('aria-busy','false');
  }catch(error){
   if(!root.CITLAuth.redirectIfSignedOut(error))$('account-feedback').textContent='تعذر تحديث حالة الطلب الآن. حاول مرة أخرى؛ طلبك محفوظ.';
  }finally{busy=false;$('account-refresh').disabled=false;clearTimeout(timer);timer=setTimeout(()=>{if(!document.hidden)refresh();},20000);}
 }
 $('account-refresh').onclick=()=>refresh(true);
 $('account-edit').onclick=()=>root.CITLFaculty.renderClaimEditor($('account-editor'));
 $('account-logout').onclick=async()=>{try{const {error}=await root.sb.auth.signOut();if(error)throw error;localStorage.removeItem('currentUser');location.replace('/');}catch(_){$('account-feedback').textContent='تعذر تسجيل الخروج. أعد المحاولة.'}};
 root.addEventListener('citl-profile-loaded',event=>{if(!root.CITLAuth.facultyPending(event.detail))enter();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});root.addEventListener('online',()=>refresh());
 refresh();
})(window);
