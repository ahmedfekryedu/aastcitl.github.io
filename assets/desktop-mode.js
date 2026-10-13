/* Chrome Android Request Desktop Site exposes a Linux desktop UA and a 980px
   layout viewport. Keep the existing desktop breakpoints on touch phones only.
   Normal Android/mobile browsing, desktop PCs and TV playback are untouched. */
(function(){
 'use strict';
 const ua=navigator.userAgent;
 if(/Chrome\//.test(ua)&&/X11; Linux x86_64/.test(ua)&&!/Android|Mobile/.test(ua)&&navigator.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<=1024){
  document.documentElement.classList.add('citl-desktop-request');
 }
})();
