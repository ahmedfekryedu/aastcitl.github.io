/* Exact QR payloads composed over the supplied artwork; entirely local exports. */
(function(root){
 'use strict';
 const TEMPLATE='/assets/faculty-qr-template.png?v=20261014-r6.8.16.1',Q={x:360,y:423,size:534},L={x:350,y:958,width:554,height:30};
 let templatePromise,pdfPromise;
 function template(){return templatePromise||(templatePromise=fetch(TEMPLATE).then(async response=>{if(!response.ok)throw Error('تعذر تحميل قالب QR');const bytes=await response.arrayBuffer(),url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})),image=new Image();try{image.src=url;await image.decode();return {image,bytes};}finally{URL.revokeObjectURL(url);}}).catch(error=>{templatePromise=null;throw error;}));}
 function pdfLibrary(){if(root.PDFLib)return Promise.resolve(root.PDFLib);return pdfPromise||(pdfPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/pdf-lib-1.17.1.min.js';script.onload=()=>resolve(root.PDFLib);script.onerror=()=>{script.remove();pdfPromise=null;reject(Error('تعذر تحميل أداة PDF؛ أعد المحاولة'));};document.head.append(script);}));}
 async function parts(room){if(!room.url||room.deleted)throw Error('لا يوجد رمز صالح لهذه القاعة');await document.fonts.load('700 28px Cairo');const qr=document.createElement('canvas');await root.QRCode.toCanvas(qr,room.url,{width:1024,margin:4,errorCorrectionLevel:'H'});const label=document.createElement('canvas');label.width=L.width*2;label.height=L.height*2;const ctx=label.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,label.width,label.height);ctx.fillStyle='#111';ctx.textAlign='center';ctx.textBaseline='middle';let size=56;const name=String(room.room_name);do{ctx.font='700 '+size+'px Cairo';size-=2;}while(size>22&&ctx.measureText(name).width>label.width-24);if(room.reference_code){ctx.font='700 28px Cairo';ctx.fillText(name,label.width/2,18);ctx.font='700 22px Arial';ctx.fillText(room.reference_code,label.width/2,48);}else{ctx.fillText(name,label.width/2,label.height/2);}return {qr,label};}
 function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 const filename=room=>'QR-'+String(room.room_name).replace(/[^\p{L}\p{N}_-]/gu,'_');
 async function png(room){const [{image},{qr,label}]=await Promise.all([template(),parts(room)]),canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(qr,Q.x,Q.y,Q.size,Q.size);ctx.imageSmoothingEnabled=true;ctx.drawImage(label,L.x,L.y,L.width,L.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('تعذر تجهيز الصورة');save(blob,filename(room)+'-template.png');}
 async function pdf(rooms,progress=()=>{}){const eligible=rooms.filter(r=>r.url&&!r.deleted);if(!eligible.length)throw Error('لا توجد أكواد لتنزيلها');const [{image,bytes},lib]=await Promise.all([template(),pdfLibrary()]),doc=await lib.PDFDocument.create(),background=await doc.embedPng(bytes);doc.setTitle('CITL Faculty Room QR');doc.setCreator('CITL Smart System');
  const pageWidth=595.28,pageHeight=841.89,multiple=eligible.length>1,margin=multiple?14:20,gap=12;
  const cellWidth=multiple?(pageWidth-2*margin-gap)/2:pageWidth-2*margin;
  const cellHeight=multiple?(pageHeight-2*margin-gap)/2:pageHeight-2*margin;
  const scale=Math.min(cellWidth/image.naturalWidth,cellHeight/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  let page;
  for(let i=0;i<eligible.length;i++){
   progress(i+1,eligible.length);
   const slot=multiple?i%4:0;
   if(slot===0)page=doc.addPage([pageWidth,pageHeight]);
   const column=slot%2,row=Math.floor(slot/2),left=margin+column*(cellWidth+gap)+(cellWidth-width)/2;
   const bottom=pageHeight-margin-row*(cellHeight+gap)-(cellHeight+height)/2;
   const {qr,label}=await parts(eligible[i]);
   page.drawImage(background,{x:left,y:bottom,width,height});
   const qrImage=await doc.embedPng(qr.toDataURL('image/png')),labelImage=await doc.embedPng(label.toDataURL('image/png'));
   page.drawImage(qrImage,{x:left+Q.x*scale,y:bottom+height-(Q.y+Q.size)*scale,width:Q.size*scale,height:Q.size*scale});
   page.drawImage(labelImage,{x:left+L.x*scale,y:bottom+height-(L.y+L.height)*scale,width:L.width*scale,height:L.height*scale});
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  save(new Blob([await doc.save()],{type:'application/pdf'}),'CITL-Room-QR.pdf');
 }
 root.CITLRoomQrExport=Object.freeze({png,pdf});
})(window);
