(function(root){
  'use strict';
  root.CITLStudySettings={
    populate(config={}){for(const [id,key,fallback]of [['study-rows-per-page','studyRowsPerPage',4],['study-slides-per-poster','studySlidesPerPoster',2],['study-rotation-mode','studyRotationMode','interleaved']]){const el=document.getElementById(id);if(el)el.value=config[key]??fallback;}const auto=document.getElementById('study-adaptive-duration');if(auto)auto.checked=config.studyAdaptiveDuration!==false;},
    values(){return {studyRowsPerPage:Number(document.getElementById('study-rows-per-page')?.value||4),studySlidesPerPoster:Number(document.getElementById('study-slides-per-poster')?.value||2),studyRotationMode:document.getElementById('study-rotation-mode')?.value||'interleaved',studyAdaptiveDuration:document.getElementById('study-adaptive-duration')?.checked!==false};}
  };
})(window);
