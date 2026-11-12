/* Optional diagnostics only. No filtered position or estimated accuracy leaves this module. */
(function(root){'use strict';
 root.CITLGPSStability={create(){
  let filter=null,previous=null,origin=null,count=0,residual=0,available=false;
  try{if(root.kalmanFilter?.KalmanFilter){filter=new root.kalmanFilter.KalmanFilter({observation:2,dynamic:'constant-position'});available=true;}}catch(_){}
  return {observe(p){
   if(!available||count>=64)return {available,count};
   try{
    const c=p.coords;if(!origin)origin=[c.latitude,c.longitude];
    const dx=(((c.longitude-origin[1]+540)%360)-180)*111320*Math.cos(origin[0]*Math.PI/180),dy=(c.latitude-origin[0])*111320;
    previous=filter.filter({previousCorrected:previous,observation:[dx,dy]});count++;
    residual=Math.hypot(dx-previous.mean[0][0],dy-previous.mean[1][0]);
    if(!Number.isFinite(residual))throw Error('Invalid stability result');
    return {available:true,count,state:count<3?'collecting':residual<=Math.max(5,c.accuracy)?'consistent':'variable'};
   }catch(_){available=false;filter=null;previous=null;return {available:false,count};}
  }};
 }};
})(window);
