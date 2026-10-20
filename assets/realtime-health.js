(function(root){
 'use strict';
 const channels=new Map();
 let timer=null,busy=false;
 async function refresh(){
  if(busy||document.hidden||navigator.onLine===false||!root.currentUser?.id)return;
  const jobs=[...channels.values()].filter(x=>x.failed&&x.owner===root.currentUser.id);
  if(!jobs.length)return;
  busy=true;
  try{await Promise.allSettled(jobs.map(x=>Promise.resolve().then(x.read)));}
  finally{busy=false;}
 }
 function track(key,status,read){
  const owner=root.currentUser?.id;
  if(!owner)return;
  if(status==='SUBSCRIBED')channels.delete(key);
  else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status))channels.set(key,{failed:true,owner,read});
  if(channels.size&&!timer)timer=setInterval(refresh,45000);
  if(!channels.size&&timer){clearInterval(timer);timer=null;}
 }
 root.addEventListener('online',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 root.CITLRealtimeHealth=Object.freeze({track,refresh});
})(window);
