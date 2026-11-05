(function(root){'use strict';
root.CITLAttendanceLocation=function({host,el,button,dialog,purpose='attendance',actions:showActions=true}){
 const building=purpose==='building';
 const box=el('section',null,'ar8-location-notice'),copy=el('div'),title=el('strong',building?'الموقع لتحديد المبنى':'الموقع لتسجيل الحضور'),message=el('p','فعّل الموقع في الهاتف واسمح للمتصفح باستخدامه أثناء الحضور.','ar8-muted'),actions=el('div',null,'ar8-actions');
 box.setAttribute('aria-label','جاهزية الموقع');if(building)message.textContent='اضغط «موقعي الحالي» ثم اسمح للمتصفح بالموقع. القياس يحرك الخريطة فقط؛ ارسم حدود المبنى واعتمدها بنفسك.';copy.append(title,message);box.append(copy,actions);host.append(box);let opened=null;
 const messages={1:'إذن الموقع غير متاح. راجع سماح المتصفح والموقع وخدمة الموقع في الهاتف.',2:'تعذر تحديد مكانك الآن. تأكد من تشغيل الموقع وتحسّن الإشارة داخل المبنى.',3:'استغرق تحديد الموقع وقتًا طويلًا. راجع الإعدادات ثم أعد المحاولة.',unsupported:'هذا المتصفح لا يتيح تحديد الموقع. افتح الصفحة في Chrome أو Safari محدث.',insecure:'تحديد الموقع يحتاج فتح الموقع باتصال آمن HTTPS.'};
 function notify(text,kind='info'){if(!box.isConnected)return;message.textContent=text;box.dataset.state=kind;}
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
 async function measure(){
  notify('جارٍ طلب قياس حديث من الهاتف…');
  try{
   const p=await new Promise((resolve,reject)=>{
    if(!root.isSecureContext)return reject({code:'insecure'});
    if(!navigator.geolocation)return reject({code:'unsupported'});
    const timer=setTimeout(()=>reject({code:3}),18000);
    navigator.geolocation.getCurrentPosition(p=>{clearTimeout(timer);resolve(p);},e=>{clearTimeout(timer);reject(e);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
   });
   notify(building?'وصل قياس الموقع؛ حدد حدود المبنى بدقة على الخريطة قبل الحفظ.':'وصل قياس الموقع. يتحقق النظام من حدود المبنى ودقة القياس عند تسجيل الحضور.','ready');
   return {latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};
  }catch(e){const code=e.code||2;notify(messages[code]||messages[2],'warning');if(box.isConnected)help(code);throw Error(messages[code]||messages[2]);}
 }
 if(showActions)button('فحص الموقع',async()=>{try{await measure();}catch(_){}},actions);button('إرشادات التشغيل',()=>help(),actions);
 if(!root.isSecureContext)notify(messages.insecure,'warning');
 else if(!navigator.geolocation)notify(messages.unsupported,'warning');
 else navigator.permissions?.query({name:'geolocation'}).then(p=>{if(p.state==='denied')notify(messages[1],'warning');}).catch(()=>{});
 return {measure};
};
})(window);
