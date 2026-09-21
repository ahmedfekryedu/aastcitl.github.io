(function (root) {
  'use strict';
  const API = 'https://media-api.aastcitl.me';
  const TYPES = {'image/jpeg':'image','image/png':'image','image/webp':'image','image/gif':'image','video/mp4':'video'};
  function validate(file) {
    const type = root.CITLVideoConverter?.isVideo(file) ? 'video' : TYPES[file.type];
    if (!type) throw new Error('اختر JPEG أو PNG أو WebP أو GIF أو فيديو MP4');
    if (!file.size || file.size > (type === 'video' ? 500 : 10) * 1024 * 1024) throw new Error('الحد الأقصى: الصور 10 ميجابايت، والفيديو 500 ميجابايت');
    return type;
  }
  async function validateVideo(file) {
    const tag = (view, at) => String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset+at,4));
    const codecs = [];
    function boxes(view,start,end,depth=0) {
      if(depth>8)throw new Error('بنية الفيديو غير صالحة');
      for(let at=start;at+8<=end;) {
        let size=view.getUint32(at),header=8;const type=tag(view,at+4);
        if(size===1){if(at+16>end)break;size=Number(view.getBigUint64(at+8));header=16;}
        if(size===0)size=end-at;
        if(size<header||at+size>end)break;
        if(['moov','trak','mdia','minf','stbl'].includes(type))boxes(view,at+header,at+size,depth+1);
        if(type==='stsd'&&at+header+8<=at+size){
          let entry=at+header+8;const count=view.getUint32(at+header+4);
          for(let i=0;i<count&&entry+8<=at+size;i++){
            const length=view.getUint32(entry);if(length<8||entry+length>at+size)break;
            codecs.push(tag(view,entry+4));entry+=length;
          }
        }
        at+=size;
      }
    }
    for(let at=0,steps=0;at+8<=file.size&&steps<10000;steps++) {
      const head=new DataView(await file.slice(at,at+16).arrayBuffer());let size=head.getUint32(0),header=8;const type=tag(head,4);
      if(size===1){if(head.byteLength<16)break;size=Number(head.getBigUint64(8));header=16;}
      if(size===0)size=file.size-at;
      if(!Number.isSafeInteger(size)||size<header||at+size>file.size)break;
      if(type==='moov'){
        if(size>32*1024*1024)throw new Error('تعذر فحص هذا الفيديو؛ صدّره بصيغة MP4 / H.264');
        boxes(new DataView(await file.slice(at,at+size).arrayBuffer()),0,size);break;
      }
      at+=size;
    }
    if(codecs.some(c=>['hvc1','hev1','dvh1','dvhe'].includes(c)))throw new Error('الفيديو بترميز HEVC / H.265، وقد لا يعمل على شاشة TV. حوّله إلى MP4 بترميز H.264 ثم ارفعه؛ لم يُرفع أي ملف.');
    if(!codecs.some(c=>['avc1','avc3'].includes(c)))throw new Error('اختر فيديو MP4 بترميز H.264 المتوافق مع الشاشة؛ تعذر تأكيد توافق هذا الملف.');
  }
  async function api(sb, path, method, body) {
    const {data, error} = await sb.auth.getSession();
    if (error || !data.session?.access_token) throw new Error('سجّل الدخول مرة أخرى لإدارة الإعلانات');
    let response;
    try {
      response = await fetch(API + path, {method, headers: {Authorization:'Bearer ' + data.session.access_token, ...(body ? {'Content-Type':'application/json'} : {})}, body:body ? JSON.stringify(body) : undefined, cache:'no-store', signal:AbortSignal.timeout(45000)});
    } catch (_) { throw new Error('تعذر الاتصال بخدمة الميديا؛ تحقق من الشبكة وإعدادات Cloudflare'); }
    if (!response.ok) {
      const result = method === 'HEAD' ? {} : await response.json().catch(() => ({}));
      throw new Error(result.message || (response.status === 401 ? 'انتهت الجلسة؛ سجّل الدخول مرة أخرى' : 'فشل التحقق من ملف الميديا أو صلاحية الوصول'));
    }
    return method === 'HEAD' ? response : response.json();
  }
  const isR2 = row => row?.storage_provider === 'r2' || /^https:\/\/media\.aastcitl\.me\//.test(row?.image_url || '');
  async function removeObject(sb, row) {
    if (isR2(row)) {
      if (!row.object_key) throw new Error('مفتاح ملف R2 غير موجود؛ لم يتم الحذف');
      return api(sb, '/api/media', 'DELETE', {objectKey:row.object_key});
    }
    if (row.storage_path) {
      const {error} = await sb.storage.from('tv-posters').remove([row.storage_path]);
      if (error) throw new Error('تعذر حذف ملف Supabase القديم: ' + error.message);
    }
  }
  function putFile(url, file, progress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url); xhr.timeout = 15 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', file.type);
      // No Supabase bearer token or R2 credentials are sent to this request.
      xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded * 100 / event.total)); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 403 ? 'انتهى رابط الرفع أو إعدادات R2 غير مطابقة؛ أعد اختيار الرفع' : 'فشل رفع الملف إلى R2؛ لم يُنشر الإعلان'));
      xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع؛ لم يُنشر الإعلان'));
      xhr.ontimeout = xhr.onabort = () => reject(new Error('توقف الرفع؛ أعد المحاولة'));
      xhr.send(file);
    });
  }
  async function upload(sb, file, progress, stage = () => {}, signal) {
    const mediaType = validate(file);
    const originalFilename = file.name;
    stage('جاري فحص الملف وتجهيز الرفع…');
    if (mediaType === 'video') {
      if (!root.CITLVideoConverter) throw new Error('أداة تجهيز الفيديو غير محملة؛ أعد فتح الصفحة.');
      file = await root.CITLVideoConverter.convert(file, {stage:text=>stage(text,'prepare'), signal});
      await validateVideo(file);
      if (file.size > 500 * 1024 * 1024) throw new Error('الفيديو المجهز يتجاوز الحد الأقصى للرفع.');
    }
    if (signal?.aborted) throw new Error('تم إلغاء تجهيز الفيديو؛ لم يُرفع الملف.');
    stage('جاري الاتصال بخدمة الرفع…');
    const signed = await api(sb, '/api/media/presign', 'POST', {filename:file.name, mimeType:file.type, mediaType, size:file.size});
    const row = {storage_provider:'r2', object_key:signed.objectKey, storage_path:signed.objectKey, image_url:signed.publicUrl, media_type:mediaType, mime_type:file.type, file_size:file.size, original_filename:originalFilename};
    // Do not allow an unexpected API response to send files to another host.
    const target = new URL(signed.uploadUrl);
    if (target.protocol !== 'https:' || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(target.hostname) || signed.publicUrl !== 'https://media.aastcitl.me/' + signed.objectKey) throw new Error('استجابة خدمة الرفع غير صالحة');
    try {
      await putFile(signed.uploadUrl, file, progress);
      stage('اكتمل الرفع؛ جاري التحقق من الملف…');
      const verified = await api(sb, '/api/media?objectKey=' + encodeURIComponent(row.object_key), 'HEAD');
      if (Number(verified.headers.get('X-Media-Size')) !== file.size || verified.headers.get('X-Media-Type') !== file.type) throw new Error('الملف المرفوع غير مكتمل؛ لم يتم نشره');
      return row;
    } catch (error) {
      try { await removeObject(sb, row); } catch (_) { error.message += ' (تعذر تنظيف ملف الرفع غير المنشور تلقائيًا)'; }
      throw error;
    }
  }
  async function save(sb, {old, metadata, file, progress = () => {}, stage = () => {}, signal}) {
    if (!old && !file) throw new Error('اختر ملف الإعلان أولًا');
    const fresh = file ? await upload(sb, file, progress, stage, signal) : null;
    stage('جاري حفظ الإعلان في النظام…');
    const id = old?.id;
    const values = {...metadata, ...(fresh || {})};
    let result;
    try {
      result = old ? await sb.from('tv_posters').update(values).eq('id', id).eq('image_url', old.image_url).select('*').single()
        : await sb.from('tv_posters').insert([{...values, is_active:true}]).select('*').single();
    } catch (error) { result = {error}; }
    if (result.error || !result.data) {
      // A lost response can follow a committed write. Read back before deleting any uploaded object.
      let check;
      try { check = await sb.from('tv_posters').select('*').eq(old ? 'id' : 'object_key', old ? id : fresh?.object_key).maybeSingle(); } catch (_) { check = {error:true}; }
      if (fresh && !check.error && check.data?.object_key === fresh.object_key) result = {data:check.data};
      else {
        let cleanupFailed = false;
        if (fresh && !check.error) try { await removeObject(sb, fresh); } catch (_) { cleanupFailed = true; }
        throw new Error(check.error ? 'تعذر تأكيد الحفظ. أعد تحميل قائمة الإعلانات قبل المحاولة؛ احتفظنا بالملف لتجنب حذف إعلان محفوظ.' : 'لم يتم حفظ الإعلان؛ الملف السابق محفوظ. ' + (result.error?.message || 'قد يكون عُدّل من نافذة أخرى') + (cleanupFailed ? ' — تعذر تنظيف الملف غير المنشور تلقائيًا.' : ''));
      }
    }
    let warning = '';
    if (fresh && old) try { await removeObject(sb, old); } catch (_) { warning = 'تم نشر الملف الجديد، لكن تعذر حذف الملف القديم من التخزين؛ يلزم تنظيفه لاحقًا.'; }
    return {row:result.data, warning};
  }
  async function remove(sb, row) {
    // Hide first: if database deletion fails after R2 deletion, a broken file is never left active on TV.
    const hidden = await sb.from('tv_posters').update({is_active:false}).eq('id',row.id).eq('image_url',row.image_url).select('id').single();
    if (hidden.error || !hidden.data) throw new Error('تعذر إخفاء الإعلان قبل الحذف؛ حدّث القائمة وأعد المحاولة');
    await removeObject(sb, row);
    const deleted = await sb.from('tv_posters').delete().eq('id',row.id).eq('image_url',row.image_url).select('id');
    if (deleted.error || !deleted.data?.length) throw new Error('حُذف الملف والإعلان مخفي، لكن تعذر حذف السجل؛ أعد المحاولة بعد تحديث القائمة');
  }
  root.CITLMediaStorage = Object.freeze({validate, validateVideo, upload, save, remove, removeObject, isR2, putFile});
})(window);
