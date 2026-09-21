(function(root){
 'use strict';
 async function convert(files,kind,{year,stage=()=>{},signal}={}){
  files=Array.from(files||[]);
  if(!files.length||files.length>30||files.some(f=>!/\.pdf$/i.test(f.name))||files.reduce((n,f)=>n+f.size,0)>50*1024*1024)throw Error('اختر حتى ٣٠ ملف PDF، بإجمالي لا يتجاوز 50 MB');
  if(kind==='study'&&files.length!==1)throw Error('جدول الدراسة يُقرأ من ملف PDF واحد مثل البرنامج الأصلي');
  if(kind==='exam'&&(!Number.isInteger(Number(year))||Number(year)<2000||Number(year)>2100))throw Error('اختر سنة الامتحانات قبل التحويل');
  if(signal?.aborted)throw new DOMException('تم الإلغاء','AbortError');
  const payload=await Promise.all(files.map(async f=>({name:f.name,bytes:await f.arrayBuffer()})));
  if(signal?.aborted)throw new DOMException('تم الإلغاء','AbortError');
  return new Promise((resolve,reject)=>{
   const worker=new Worker('/assets/pdf-schedule-worker.js?v=20260921-r6.1');
   const finish=(error,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.terminate();error?reject(error):resolve(result);};
   const cancel=()=>finish(new DOMException('تم إلغاء التحويل؛ لم يُرفع الجدول','AbortError'));
   const timer=setTimeout(()=>finish(Error('انتهت مهلة التحويل. جرّب البرنامج المكتبي لهذا الملف.')),10*60*1000);
   signal?.addEventListener('abort',cancel,{once:true});
   worker.onmessage=({data})=>{if(data.stage)stage(data.stage);else if(data.error)finish(Error(data.error));else if(data.result)finish(null,data.result);};
   worker.onerror=()=>finish(Error('تعذر تشغيل محرك PDF. تحقق من تحميل ملفات الموقع أو استخدم البرنامج المكتبي.'));
   worker.postMessage({files:payload,kind,year},payload.map(x=>x.bytes));
  });
 }
 root.CITLPdfSchedule=Object.freeze({convert});
})(window);
