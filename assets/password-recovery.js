/* Password recovery uses Supabase Auth only; never modifies profiles or approval state. */
(function(root){
 'use strict';
 const params=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const recovery=params.get('password-recovery')==='1'||fragment.get('type')==='recovery';
 const incomingToken=fragment.get('type')==='recovery'?fragment.get('access_token'):null;
 let sb,form,valid=false,checking=true,busy=false;
 function status(message){form.querySelector('[data-status]').textContent=message;}
 function ready(session){valid=!!session?.user;checking=false;if(form){form.querySelector('[data-save]').disabled=!valid;status(valid?'اكتب كلمة مرور جديدة لحسابك.':'الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.');}}
 function request(){
  if(document.getElementById('citl-password-request'))return;
  const d=document.createElement('dialog');d.id='citl-password-request';d.className='citl-password-dialog';d.dir='rtl';
  d.innerHTML='<header><strong>استعادة كلمة المرور</strong><button type="button" data-close aria-label="إغلاق">×</button></header><form><p>أدخل بريد حسابك المسجل لإرسال رابط تعيين كلمة مرور جديدة.</p><label>البريد الإلكتروني<input type="email" name="email" required autocomplete="email" dir="ltr"></label><p data-status role="status"></p><button type="submit">إرسال رابط الاستعادة</button></form>';
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
  const style=document.createElement('style');style.textContent='.citl-password-dialog{width:min(440px,calc(100vw - 28px));box-sizing:border-box;padding:0;border:1px solid #dce1ef;border-radius:16px;color:#2a3475;background:#fff;font-family:Cairo,sans-serif;max-height:90dvh;overflow:auto}.citl-password-dialog::backdrop{background:#15204099}.citl-password-dialog header{display:flex;align-items:center;justify-content:space-between;padding:16px;background:#2a3475;color:#fff;border-bottom:3px solid #f3a628}.citl-password-dialog header button{width:32px;height:32px;border-radius:8px;background:#ffffff22;color:#fff;font-size:24px;border:0}.citl-password-dialog form,.citl-password-reset{padding:20px;display:grid;gap:14px}.citl-password-dialog p,.citl-password-reset p{font-size:12px;line-height:1.9}.citl-password-dialog label,.citl-password-reset label{display:grid;gap:6px;font-size:13px;font-weight:700}.citl-password-dialog input,.citl-password-reset input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #d5daea;border-radius:9px;background:#fff;color:#24315b}.citl-password-dialog [type=submit],.citl-password-reset button{padding:11px;border:0;border-radius:9px;background:#2a3475;color:#fff;font:inherit;cursor:pointer}.citl-password-dialog button:disabled,.citl-password-reset button:disabled{opacity:.55;cursor:default}.citl-password-reset{padding:0;color:#2a3475}.citl-password-reset h2{font-size:20px;font-weight:800}.citl-password-reset a{font-size:13px;font-weight:700;color:#2a3475;text-align:center}';document.head.append(style);
  document.querySelectorAll('[data-forgot-password]').forEach(b=>b.onclick=request);
  if(!recovery)return;
  document.getElementById('loginForm').classList.add('hidden');document.getElementById('signupForm').classList.add('hidden');document.body.classList.remove('opacity-0');
  form=document.createElement('form');form.className='citl-password-reset';form.id='citl-password-reset';
  form.innerHTML='<h2>تعيين كلمة مرور جديدة</h2><p data-status role="status">جاري التحقق من رابط الاستعادة…</p><label>كلمة المرور الجديدة<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label>تأكيد كلمة المرور<input name="confirmation" type="password" minlength="8" required autocomplete="new-password"></label><button type="submit" data-save disabled>حفظ كلمة المرور</button><button type="button" data-request>إرسال رابط استعادة جديد</button><a href="/">العودة لتسجيل الدخول</a>';
  document.getElementById('loginForm').after(form);form.querySelector('[data-request]').onclick=request;
  form.onsubmit=async e=>{e.preventDefault();if(busy||!valid)return;const password=form.elements.password.value;if(password!==form.elements.confirmation.value){status('كلمتا المرور غير متطابقتين.');return;}if(password.length<8){status('استخدم 8 أحرف على الأقل.');return;}
   busy=true;form.querySelector('[data-save]').disabled=true;root.showLoader?.('جاري حفظ كلمة المرور الجديدة…');
   try{const {error}=await sb.auth.updateUser({password});if(error)throw error;valid=false;form.querySelectorAll('input').forEach(i=>{i.value='';i.disabled=true;});form.querySelector('[data-save]').hidden=true;status('تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.');localStorage.removeItem('currentUser');localStorage.removeItem('sessionToken');await sb.auth.signOut({scope:'local'}).catch(()=>{});history.replaceState(null,'','/?password-recovery=1');}
   catch(error){status(error?.status===401||error?.status===403?'انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.':'تعذر حفظ كلمة المرور. تأكد أنها مختلفة عن القديمة وتوافق متطلبات الأمان ثم حاول مجددًا.');}
   finally{busy=false;form.querySelector('[data-save]').disabled=!valid;root.hideLoader?.();}
  };
  // Only an Auth-verified recovery event/token can activate this form; an existing login is insufficient.
  sb.auth.getSession().then(({data,error})=>{if(valid){if(location.hash)history.replaceState(null,'','/?password-recovery=1');return;}if(!error&&incomingToken&&data?.session?.access_token===incomingToken)ready(data.session);else ready(null);if(location.hash)history.replaceState(null,'','/?password-recovery=1');}).catch(()=>ready(null));
 }
 root.CITLPasswordRecovery=Object.freeze({init,isRecovery:recovery});
})(window);
