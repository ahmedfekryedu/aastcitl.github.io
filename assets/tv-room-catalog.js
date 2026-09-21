(function(root){
 'use strict';
 const key=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names=rows=>{const unique=new Map();for(const row of rows){const name=String(row.room_name??'').trim();if(name&&!unique.has(key(name)))unique.set(key(name),name);}return [...unique.values()].sort((a,b)=>key(a).localeCompare(key(b),'en',{numeric:true}));};
 const select=(available,chosen)=>Array.isArray(chosen)?available.filter(name=>chosen.some(value=>key(value)===key(name))):[...available];
 async function load(client){
  const rows=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await client.from('academic_schedule').select('id,room_name').order('id').range(offset,offset+999);
   if(error)throw error;if(!Array.isArray(data))throw new Error('تعذر تحميل قاعات الجداول');
   rows.push(...data);if(data.length<1000)break;if(offset>=100000)throw new Error('حجم الجدول أكبر من حد القراءة');
  }
  return names(rows);
 }
 root.CITLTVRooms=Object.freeze({key,names,select,load,escape});
})(window);
