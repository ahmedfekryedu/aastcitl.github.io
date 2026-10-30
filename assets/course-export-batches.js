(function(root){'use strict';
// Each bounded part has its own SQL snapshot. Never claim a single cross-part snapshot.
async function run({ids,fetchPart,buildPart,onPart,progress=()=>{},cancel=()=>false}){
 const unique=[...new Set(ids)];if(!unique.length||unique.length!==ids.length)throw Error('اختر تقارير غير مكررة');
 const manifest={started_at:new Date().toISOString(),requested:ids.length,completed:0,status:'running',snapshot:'independent permission-checked snapshot per part',parts:[]};
 try{for(let offset=0;offset<ids.length;offset+=25){
  if(cancel())throw Error('أُلغي التصدير؛ الأجزاء السابقة محفوظة');
  const group=ids.slice(offset,offset+25),part=manifest.parts.length+1;
  progress({completed:manifest.completed,total:ids.length,part,message:'جلب بيانات الجزء '+part});
  let snapshot=await fetchPart(group);
  if(snapshot.reports?.length!==group.length||new Set(snapshot.reports.map(d=>d.report.id)).size!==group.length||snapshot.reports.some(d=>!group.includes(d.report.id)))throw Error('استجابة جزئية أو غير مطابقة؛ لم يجهز هذا الجزء');
  let blob=await buildPart(snapshot,{cancel,progress:message=>progress({completed:manifest.completed,total:ids.length,part,message})});
  if(cancel())throw Error('أُلغي التصدير');
  const file='CITL-reports-part-'+String(part).padStart(3,'0')+'.zip';
  await onPart({blob,file,part});
  manifest.parts.push({file,bytes:blob.size,extracted_at:snapshot.extracted_at,reports:snapshot.reports.map(d=>({id:d.report.id,revision:d.report.revision,course:d.offering.course_code,lecturer:d.identity.lecturer,term:snapshot.term_id}))});
  snapshot=null;blob=null;await new Promise(resolve=>setTimeout(resolve,0));
  manifest.completed+=group.length;progress({completed:manifest.completed,total:ids.length,part,message:'تم تجهيز الجزء '+part});
 }
 manifest.status='complete';
 }catch(e){manifest.status=cancel()?'cancelled':'partial_failure';manifest.error=e.message;}
 manifest.finished_at=new Date().toISOString();return manifest;
}
root.CITLCourseExportBatches={run};
})(window);
