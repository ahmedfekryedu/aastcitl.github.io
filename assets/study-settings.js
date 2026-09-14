(function(root){
  'use strict';
  const el=id=>document.getElementById(id);
  function sync(){
    const enabled=el('study-enhanced-enabled')?.checked!==false;
    const grouped=el('study-rotation-mode')?.value==='grouped';
    const fields=el('study-enhanced-options');if(fields){fields.disabled=!enabled;fields.hidden=!enabled;}
    for(const id of ['study-rows-per-page','study-rotation-mode','study-adaptive-duration'])if(el(id))el(id).disabled=!enabled;
    if(el('study-slides-per-poster'))el('study-slides-per-poster').disabled=!enabled||grouped;
    el('study-frequency-field')?.classList.toggle('citl-field-disabled',grouped);
    const hint=el('study-rotation-hint');if(hint)hint.textContent=grouped?'التداخل متوقف: تُعرض جميع صفحات الجداول، ثم الإعلانات المفعّلة بالترتيب.':'التداخل مفعّل: يظهر إعلان بعد العدد المحدد من صفحات الجداول.';
    const modeHint=el('study-enhanced-hint');if(modeHint)modeHint.textContent=enabled?'التخصيص مفعّل. يمكنك تعديل الخيارات التالية وحفظ إعدادات القاعات.':'العرض الأساسي: كل الجداول ثم الإعلانات، بالمدة المحددة للقاعة ومن غير زيادة تلقائية. توزيع المحاضرات تلقائي حسب مساحة الشاشة. اختياراتك محفوظة عند إعادة التفعيل.';
  }
  document.addEventListener('change',e=>{if(['study-enhanced-enabled','study-rotation-mode'].includes(e.target.id))sync();});
  root.CITLStudySettings={
    populate(config={}){
      for(const [id,key,fallback]of [['study-rows-per-page','studyRowsPerPage',4],['study-slides-per-poster','studySlidesPerPoster',2],['study-rotation-mode','studyRotationMode','interleaved']])if(el(id))el(id).value=config[key]??fallback;
      if(el('study-adaptive-duration'))el('study-adaptive-duration').checked=config.studyAdaptiveDuration!==false;
      if(el('study-enhanced-enabled'))el('study-enhanced-enabled').checked=config.studyEnhancedDisplayEnabled!==false;
      sync();
    },
    values(){return {studyEnhancedDisplayEnabled:el('study-enhanced-enabled')?.checked!==false,studyRowsPerPage:Number(el('study-rows-per-page')?.value||4),studySlidesPerPoster:Number(el('study-slides-per-poster')?.value||2),studyRotationMode:el('study-rotation-mode')?.value||'interleaved',studyAdaptiveDuration:el('study-adaptive-duration')?.checked!==false};}
  };
})(window);
