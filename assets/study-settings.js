(function(root){
  'use strict';
  function sync(){
    const grouped=document.getElementById('study-rotation-mode')?.value==='grouped';
    const frequency=document.getElementById('study-slides-per-poster');if(frequency)frequency.disabled=grouped;
    const field=document.getElementById('study-frequency-field');if(field)field.classList.toggle('citl-field-disabled',grouped);
    const hint=document.getElementById('study-rotation-hint');if(hint)hint.textContent=grouped?'التداخل متوقف: تُعرض جميع صفحات الجداول، ثم الإعلانات المفعّلة بالترتيب.':'التداخل مفعّل: يظهر إعلان بعد العدد المحدد من صفحات الجداول.';
  }
  document.addEventListener('change',e=>{if(e.target.id==='study-rotation-mode')sync();});
  root.CITLStudySettings={
    populate(config={}){for(const [id,key,fallback]of [['study-rows-per-page','studyRowsPerPage',4],['study-slides-per-poster','studySlidesPerPoster',2],['study-rotation-mode','studyRotationMode','interleaved']]){const el=document.getElementById(id);if(el)el.value=config[key]??fallback;}const auto=document.getElementById('study-adaptive-duration');if(auto)auto.checked=config.studyAdaptiveDuration!==false;sync();},
    values(){return {studyRowsPerPage:Number(document.getElementById('study-rows-per-page')?.value||4),studySlidesPerPoster:Number(document.getElementById('study-slides-per-poster')?.value||2),studyRotationMode:document.getElementById('study-rotation-mode')?.value||'interleaved',studyAdaptiveDuration:document.getElementById('study-adaptive-duration')?.checked!==false};}
  };
})(window);
