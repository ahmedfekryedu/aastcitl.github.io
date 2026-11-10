(function(root){'use strict';
let activeCancel=null;
root.CITLAttendanceLive={update(text,state='checking'){
 let bar=document.getElementById('ar8-location-live');
 if(!bar){bar=document.createElement('div');bar.id='ar8-location-live';bar.className='ar8-location-live';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');(document.querySelector('header.citl-main-header')||document.body).append(bar);}
 bar.dataset.state=state;bar.textContent=text;bar.hidden=!text;
},clear(){activeCancel?.();this.update('');}};
root.CITLAttendanceLocation=function({host,el,button,dialog,purpose='attendance',actions:showActions=true}){
 const building=purpose==='building';
 const box=el('section',null,'ar8-location-notice'),copy=el('div'),title=el('strong',building?'الموقع لتحديد المبنى':'الموقع لتسجيل الحضور'),message=el('p','فعّل الموقع في الهاتف واسمح للمتصفح باستخدامه أثناء الحضور.','ar8-muted'),actions=el('div',null,'ar8-actions');
 box.setAttribute('aria-label','جاهزية الموقع');if(building)message.textContent='اضغط «موقعي الحالي» ثم اسمح للمتصفح بالموقع. القياس يحرك الخريطة فقط؛ ارسم حدود المبنى واعتمدها بنفسك.';copy.append(title,message);box.append(copy,actions);host.append(box);let opened=null;
 const messages={1:'إذن الموقع غير متاح. راجع سماح المتصفح والموقع وخدمة الموقع في الهاتف.',2:'تعذر تحديد مكانك الآن. تأكد من تشغيل الموقع وتحسّن الإشارة داخل المبنى.',3:'استغرق تحديد الموقع وقتًا طويلًا. راجع الإعدادات ثم أعد المحاولة.',unsupported:'هذا المتصفح لا يتيح تحديد الموقع. افتح الصفحة في Chrome أو Safari محدث.',insecure:'تحديد الموقع يحتاج فتح الموقع باتصال آمن HTTPS.'};
 function notify(text,kind='info'){if(!box.isConnected)return;message.textContent=text;box.dataset.state=kind;if(!building)root.CITLAttendanceLive.update(text,kind);}
 function help(code){
  if(opened?.open){opened.querySelector('[data-location-message]').textContent=messages[code]||messages[1];return;}
  const d=dialog(building?'السماح بالموقع لتحديد المبنى':'تشغيل الموقع للحضور');opened=d;d.classList.add('ar8-location-help');const intro=el('p',messages[code]||'اسمح للهاتف والمتصفح والموقع باستخدام الموقع الدقيق.','ar8-location-explanation');intro.dataset.locationMessage='';d.append(intro);
  const iphone=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const instructions=[['أندرويد — Chrome',[
   'من إعدادات الهاتف، شغّل «الموقع».',
   'من إعدادات التطبيقات افتح Chrome ← الأذونات ← الموقع، واسمح أثناء الاستخدام. فعّل الموقع الدقيق إذا ظهر.',
   'داخل Chrome افتح الإعدادات ← إعدادات المواقع ← الموقع، واسمح لهذا الموقع. إذا كان ضمن المواقع المحظورة غيّر إذنه.',
   'ارجع لهذه الصفحة واضغط «إعادة فحص الموقع»، ووافق على طلب المتصفح إن ظهر.'
  ],'https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DAndroid&hl=ar'],['آيفون — Safari وChrome',[
   'افتح الإعدادات ← الخصوصية والأمان ← خدمات الموقع، ثم شغّل خدمات الموقع.',
   'من قائمة التطبيقات اختر Safari Websites / مواقع Safari أو المتصفح المستخدم، واسمح أثناء الاستخدام مع تفعيل «الموقع الدقيق».',
   'إذا رفضت إذن الموقع داخل Safari، افتح قائمة الصفحة بجوار العنوان ← إعدادات موقع الويب، وراجع إذن الموقع. قد تختلف أسماء القوائم حسب إصدار الهاتف.',
   'ارجع للصفحة واضغط «إعادة فحص الموقع»، واسمح عند ظهور طلب المتصفح.'
  ],'https://support.apple.com/ar-ae/102647']];
  instructions.forEach(([label,steps,url],i)=>{const group=el('details',null,'ar8-location-steps');group.open=iphone?i===1:i===0;group.addEventListener('toggle',()=>{if(group.open)d.querySelectorAll('.ar8-location-steps').forEach(other=>{if(other!==group)other.open=false;});});group.append(el('summary',label));const list=el('ol');for(const step of steps)list.append(el('li',step));group.append(list);const link=el('a','دليل الشركة الرسمي');link.href=url;link.target='_blank';link.rel='noopener noreferrer';group.append(link);d.append(group);});
  d.append(el('p',building?'الفحص يحدد مركز الخريطة فقط؛ لا يحفظ حدودًا أو يسجل حضورًا.':'المتصفح لا يستطيع تشغيل الموقع نيابةً عنك. الفحص لا يسجل حضورًا؛ التسجيل يتم من زر محاضرتك بعد تحقق النظام. ويمكنك استخدام كاميرا الهاتف لمسح رمز القاعة المطبوع.','ar8-muted'));
  const tools=el('div',null,'ar8-actions');d.append(tools);button('إعادة فحص الموقع',async()=>{try{await measure();intro.textContent=building?'وصل قياس الموقع. أغلق الإرشادات واضغط «موقعي الحالي» للانتقال إلى مكانك.':'وصل قياس الموقع بنجاح. أغلق الإرشادات ثم سجّل حضور محاضرتك.';}catch(_){}},tools);button(building?'العودة للخريطة':'العودة للمحاضرات',()=>d.close(),tools);
 }
 async function measure({maxAccuracy=15,maxAge=15}={}){
  activeCancel?.();maxAccuracy=building?maxAccuracy:Math.min(15,Number(maxAccuracy)||15);maxAge=Math.min(15,Math.max(1,Number(maxAge)||15));
  notify('جارٍ تحديد موقعك بدقة — اسمح باستخدام الموقع الدقيق…','checking');
  try{
   const p=await new Promise((resolve,reject)=>{
    if(!root.isSecureContext)return reject({code:'insecure'});
    if(!navigator.geolocation)return reject({code:'unsupported'});
    let watch=null,best=null,done=false;
    const cleanup=()=>{clearTimeout(timer);if(watch!==null)navigator.geolocation.clearWatch(watch);root.removeEventListener('pagehide',cancel);if(activeCancel===cancel)activeCancel=null;};
    const finish=(error,value)=>{if(done)return;done=true;cleanup();error?reject(error):resolve(value);};
    const cancel=()=>finish({code:'cancelled'});activeCancel=cancel;root.addEventListener('pagehide',cancel,{once:true});
    const timer=setTimeout(()=>{if(best&&best.coords.accuracy<=maxAccuracy&&Date.now()-best.timestamp<=maxAge*1000)finish(null,best);else finish({code:best?'accuracy':3});},20000);
    const received=p=>{if(done)return;const c=p.coords;if(!Number.isFinite(c.accuracy)||c.accuracy<0.1||!Number.isFinite(c.latitude)||Math.abs(c.latitude)>90||!Number.isFinite(c.longitude)||Math.abs(c.longitude)>180||!Number.isFinite(p.timestamp)||Date.now()-p.timestamp>maxAge*1000||p.timestamp>Date.now()+5000)return;
     if(!best||Date.now()-best.timestamp>maxAge*1000||c.accuracy<best.coords.accuracy)best=p;
     notify('جارٍ تحديد الموقع — دقة القراءة الحالية '+Math.ceil(c.accuracy)+' متر؛ المطلوب '+maxAccuracy+' متر أو أفضل.','checking');
     if(c.accuracy<=maxAccuracy)finish(null,p);
    };
    watch=navigator.geolocation.watchPosition(received,e=>{if(e.code===1)finish(e);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    if(done&&watch!==null)navigator.geolocation.clearWatch(watch);
   });
   notify(building?'وصل قياس الموقع؛ حدد حدود المبنى بدقة على الخريطة قبل الحفظ.':'وصل قياس مناسب؛ جارٍ التحقق من نطاق مبنى محاضرتك…',building?'ready':'checking');
   return {latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};
  }catch(e){const code=e.code||2;if(code==='cancelled')throw Error('أُلغي قياس الموقع.');const message=code==='accuracy'?'لم تصل قراءة بدقة '+maxAccuracy+' متر أو أفضل. فعّل الموقع الدقيق وأعد الفحص قرب نافذة، أو استخدم رمز القاعة.':messages[code]||messages[2];notify(message,'warning');if(box.isConnected&&code!=='accuracy')help(code);throw Error(message);}
 }
 if(showActions)button('فحص الموقع',async()=>{try{await measure();}catch(_){}},actions);button('إرشادات التشغيل',()=>help(),actions);
 if(!root.isSecureContext)notify(messages.insecure,'warning');
 else if(!navigator.geolocation)notify(messages.unsupported,'warning');
 else navigator.permissions?.query({name:'geolocation'}).then(p=>{if(p.state==='denied')notify(messages[1],'warning');}).catch(()=>{});
 return {measure,status:notify};
};
})(window);
