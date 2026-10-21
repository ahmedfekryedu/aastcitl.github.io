/* Password recovery uses Supabase Auth only; never modifies profiles or approval state. */
(function(root){
 'use strict';
 const params=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const recovery=params.get('password-recovery')==='1'||fragment.get('type')==='recovery';
 const incomingToken=fragment.get('type')==='recovery'?fragment.get('access_token'):null;
 let sb,form,valid=false,checking=true,busy=false;
 function status(message,kind='info'){const el=form.querySelector('[data-status]');el.textContent=message;el.dataset.kind=kind;}
 function fields(enabled){const group=form.querySelector('[data-fields]');group.hidden=!enabled;group.disabled=!enabled;form.querySelector('[data-save]').disabled=!enabled;if(!enabled)group.querySelectorAll('input').forEach(i=>i.value='');}
 function ready(session){valid=!!session?.user;checking=false;if(form){fields(valid);status(valid?'اكتب كلمة مرور جديدة لحسابك.':'الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.',valid?'info':'error');}}
 function request(){
  if(document.getElementById('citl-password-request'))return;
  const d=document.createElement('dialog');d.id='citl-password-request';d.className='citl-password-dialog';d.dir='rtl';
  d.innerHTML='<header><strong><span aria-hidden="true">↗</span> استعادة كلمة المرور</strong><button type="button" data-close aria-label="إغلاق">×</button></header><form><p>أدخل بريد حسابك المسجل لإرسال رابط تعيين كلمة مرور جديدة.</p><label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email" dir="ltr"></label><p data-status role="status"></p><button type="submit">إرسال رابط الاستعادة</button></form>';
  document.body.append(d);d.querySelector('input').value=document.getElementById('email')?.value||document.getElementById('reg-email')?.value||'';
  let submitting=false,cooldown=0,timer;
  d.querySelector('[data-close]').onclick=()=>d.close();d.onclose=()=>{clearInterval(timer);d.remove();};
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();if(submitting||cooldown)return;submitting=true;const button=d.querySelector('[type=submit]'),label=d.querySelector('[data-status]');button.disabled=true;label.textContent='جاري إرسال رابط الاستعادة…';try{
   const {error}=await sb.auth.resetPasswordForEmail(d.querySelector('input').value.trim(),{redirectTo:location.origin+'/?password-recovery=1'});
   if(error)throw error;
   label.textContent='إذا كان البريد مرتبطًا بحساب، ستصلك رسالة برابط الاستعادة. راجع البريد غير المرغوب فيه أيضًا.';
   cooldown=60;timer=setInterval(()=>{cooldown--;button.textContent=cooldown?'إعادة الإرسال بعد '+cooldown+' ثانية':'إرسال رابط الاستعادة';if(!cooldown){clearInterval(timer);button.disabled=false;}},1000);
  }catch(error){label.textContent=error?.status===429?'تم إرسال طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.':'تعذر إرسال الرسالة. تحقق من الاتصال والبريد ثم أعد المحاولة.';}finally{submitting=false;if(!cooldown)button.disabled=false;}};
  d.showModal();
 }
 function init(client){
  sb=client;
  sb.auth.onAuthStateChange((event,session)=>{if(recovery&&event==='PASSWORD_RECOVERY')ready(session);});
  const style=document.createElement('style');style.textContent='\n.citl-password-dialog{width:min(440px,calc(100vw - 32px));box-sizing:border-box;padding:0;border:1px solid #e5e7eb;border-radius:18px;color:#374151;background:#fff;font-family:Cairo,sans-serif;max-height:90dvh;overflow:auto;box-shadow:0 24px 64px #15204040}\n.citl-password-dialog::backdrop{background:#15204099;backdrop-filter:blur(4px)}\n.citl-password-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;background:#2a3475;color:#fff;border-bottom:3px solid #f3a628}\n.citl-password-dialog header strong{display:flex;gap:10px;align-items:center;font-size:16px;font-weight:800}.citl-password-dialog header strong span{color:#f3a628;font-size:24px}\n.citl-password-dialog header button{display:grid;place-items:center;flex:none;width:32px;height:32px;padding:0;border-radius:8px;background:#ffffff18;color:#fff;font-size:24px;line-height:1;border:1px solid #ffffff30;cursor:pointer}\n.citl-password-dialog form,.citl-password-reset{padding:20px;display:grid;gap:16px}\n.citl-password-dialog p,.citl-password-reset p{margin:0;color:#6b7280;font-size:13px;line-height:1.9}\n.citl-password-dialog label,.citl-password-reset label{display:grid;gap:8px;font-size:13px;font-weight:700;color:#374151}\n.citl-password-dialog input,.citl-password-reset input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;color:#1f2937;font:inherit;outline:none}\n.citl-password-dialog input:focus,.citl-password-reset input:focus{border-color:#2a3475;box-shadow:0 0 0 3px #2a347512}\n.citl-password-dialog [type=submit],.citl-password-reset button{padding:12px;border:0;border-radius:10px;background:#2a3475;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-height:44px}\n.citl-password-dialog button:disabled,.citl-password-reset button:disabled{opacity:.55;cursor:default}\n.citl-password-reset{padding:0;color:#2a3475;font-family:Cairo,sans-serif}.citl-password-reset h2{margin:0;font-size:20px;font-weight:800}\n.citl-password-reset fieldset{min-width:0;border:0;margin:0;padding:0;display:grid;gap:16px}.citl-password-reset [hidden]{display:none!important}\n.citl-password-reset [data-request]{background:#f8f9fc;color:#2a3475;border:1px solid #dce1ef}\n.citl-password-reset a{font-size:13px;font-weight:700;color:#2a3475;text-align:center;text-decoration:none}\n.citl-password-reset [data-status][data-kind=error]{background:#fff8f5;border:1px solid #f2d7ce;color:#9a452e;border-radius:10px;padding:12px}\n.citl-password-reset [data-status][data-kind=success]{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:10px;padding:12px}\n.citl-password-dialog [data-status]:empty{display:none}.citl-password-dialog [data-status]:not(:empty){padding:12px;border-radius:10px;background:#f8f9fc;border:1px solid #e5e7eb}\n';document.head.append(style);
  document.querySelectorAll('[data-forgot-password]').forEach(b=>b.onclick=request);
  if(!recovery)return;
  document.getElementById('loginForm').classList.add('hidden');document.getElementById('signupForm').classList.add('hidden');document.body.classList.remove('opacity-0');
  form=document.createElement('form');form.className='citl-password-reset';form.id='citl-password-reset';
  form.innerHTML='<h2>تعيين كلمة مرور جديدة</h2><p data-status role="status">جاري التحقق من رابط الاستعادة…</p><fieldset data-fields hidden disabled><label>كلمة المرور الجديدة<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label>تأكيد كلمة المرور<input name="confirmation" type="password" minlength="8" required autocomplete="new-password"></label><button type="submit" data-save disabled>حفظ كلمة المرور</button></fieldset><button type="button" data-request>إرسال رابط استعادة جديد</button><a href="/">العودة لتسجيل الدخول</a>';
  document.getElementById('loginForm').after(form);form.querySelector('[data-request]').onclick=request;
  form.onsubmit=async e=>{e.preventDefault();if(busy||!valid)return;const password=form.elements.password.value;if(password!==form.elements.confirmation.value){status('كلمتا المرور غير متطابقتين.');return;}if(password.length<8){status('استخدم 8 أحرف على الأقل.');return;}
   busy=true;form.querySelector('[data-save]').disabled=true;root.showLoader?.('جاري حفظ كلمة المرور الجديدة…');
   try{const {error}=await sb.auth.updateUser({password});if(error)throw error;valid=false;fields(false);form.querySelector('[data-request]').hidden=true;status('تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.','success');localStorage.removeItem('currentUser');localStorage.removeItem('sessionToken');await sb.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'','/?password-recovery=1');}
   catch(error){const expired=error?.status===401||error?.status===403||['session_not_found','refresh_token_not_found','refresh_token_already_used'].includes(error?.code);if(expired){valid=false;fields(false);}status(expired?'انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.':'تعذر حفظ كلمة المرور. تأكد أنها مختلفة عن القديمة وتوافق متطلبات الأمان ثم حاول مجددًا.','error');}
   finally{busy=false;form.querySelector('[data-save]').disabled=!valid;root.hideLoader?.();}
  };
  // Only an Auth-verified recovery event/token can activate this form; an existing login is insufficient.
  sb.auth.getSession().then(({data,error})=>{if(valid){if(location.hash)history.replaceState(null,'','/?password-recovery=1');return;}if(!error&&incomingToken&&data?.session?.access_token===incomingToken)ready(data.session);else ready(null);if(location.hash)history.replaceState(null,'','/?password-recovery=1');}).catch(()=>ready(null));
 }
 root.CITLPasswordRecovery=Object.freeze({init,isRecovery:recovery});
})(window);
