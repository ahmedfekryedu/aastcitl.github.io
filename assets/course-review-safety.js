(function(root){'use strict';
// Advisory preview only; SQL remains the authoritative permission/state gate.
function rolloutPreview(offerings,records,proposal,now=Date.now()){
 const rules=records.filter(x=>x.department!==proposal.department).concat(proposal);
 return offerings.map(o=>{const rule=rules.find(x=>x.department===o.department);
 const reason=!rule?'القسم غير مضاف للإتاحة':!rule.active?'إتاحة القسم موقوفة':rule.starts_at&&Date.parse(rule.starts_at)>now?'موعد البداية لم يحن':rule.offering_ids?.length&&!rule.offering_ids.includes(o.id)?'المقرر غير مشمول':'مسموح ضمن نطاق الإتاحة';
 const blocked=reason!=='مسموح ضمن نطاق الإتاحة';
 return {...o,rollout_blocked:blocked,newly_blocked:!!o.operable&&blocked,rollout_reason:reason};});
}
// A completed disk write is awaited before accepting the next part. No Blob URLs.
function directorySink(directory){return async({blob,file})=>{const h=await directory.getFileHandle(file,{create:true});const stream=await h.createWritable();try{await stream.write(blob);await stream.close();}catch(e){try{await stream.abort();}catch{}throw e;}};}
function byteBudget(limit=150*1024*1024){let used=0;return {get used(){return used;},reserve(bytes,reserveForIndex=1024*1024){if(!Number.isFinite(bytes)||bytes<0||used+bytes>limit-reserveForIndex)throw Error('بلغت الأجزاء الجاهزة سقف الذاكرة؛ احفظ الأجزاء وحررها ثم استكمل المحدد المتبقي، أو استخدم الحفظ إلى مجلد');used+=bytes;let released=false;return ()=>{if(!released){used-=bytes;released=true;}};}};}
root.CITLCourseReviewSafety={rolloutPreview,directorySink,byteBudget};
})(window);
