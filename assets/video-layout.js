(function(root){
 'use strict';
 const isSamsungTV=()=>/SMART-TV|SMARTTV|Tizen|Maple/i.test(navigator.userAgent)&&!/Android|Mobile/i.test(navigator.userAgent);
 const detach=new WeakMap();
 function release(video){detach.get(video)?.();detach.delete(video);}
 function attach(video,host,row,{tv=false}={}){
  release(video);
  if(row?.video_layout!=='native-cw')return;
  // The installed Samsung screen renders its video plane in physical landscape axes.
  // The encoded pixels already carry the clockwise turn. Do not transform that plane.
  const native=tv&&isSamsungTV()&&document.body.classList.contains('tv-rotate-cw');
  video.dataset.videoPlane=native?'native':'composited';
  host.style.position='relative';host.style.overflow='hidden';
  const resize=()=>{
   if(native){
    // Size in the unrotated CSS axes so the physical plane keeps square pixels.
    const ratio=(video.videoWidth&&video.videoHeight)?video.videoWidth/video.videoHeight:1920/1080;
    const width=Math.max(host.clientWidth,host.clientHeight/ratio),height=width*ratio;
    video.style.position='absolute';video.style.width=width+'px';video.style.height=height+'px';
    video.style.left=(host.clientWidth-width)/2+'px';video.style.top=(host.clientHeight-height)/2+'px';
    video.style.maxWidth='none';video.style.maxHeight='none';video.style.objectFit='fill';return;
   }
   video.style.position='absolute';video.style.width=host.clientHeight+'px';video.style.height=host.clientWidth+'px';
   video.style.left='50%';video.style.top='50%';video.style.maxWidth='none';video.style.maxHeight='none';
   video.style.setProperty('transform','translate(-50%, -50%) rotate(-90deg)','important');
   video.style.setProperty('-webkit-transform','translate(-50%, -50%) rotate(-90deg)','important');
  };
  resize();
  const observer=root.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(host);
  root.addEventListener('resize',resize);video.addEventListener('loadedmetadata',resize);
  detach.set(video,()=>{observer?.disconnect();root.removeEventListener('resize',resize);video.removeEventListener('loadedmetadata',resize);});
 }
 root.CITLVideoLayout=Object.freeze({attach,release,isSamsungTV});
})(window);
