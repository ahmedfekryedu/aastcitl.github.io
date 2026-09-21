(function (root) {
  'use strict';
  const BASE = '/assets/vendor/video/';
  const LIMIT = 500 * 1024 * 1024;
  const EXTENSIONS = /\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|3gp|mts|m2ts)$/i;
  const isVideo = file => !!file && (file.type?.startsWith('video/') || EXTENSIONS.test(file.name || ''));
  let busy = false;
  const cancelled = () => new DOMException('تم إلغاء تجهيز الفيديو؛ لم يُرفع أي ملف.', 'AbortError');

  // Single-thread FFmpeg runs in its own Worker, including on static hosting without COOP/COEP.
  // The original File is mounted read-only; do not duplicate a large input into WASM memory.
  async function convert(file, {stage = () => {}, signal} = {}) {
    if (busy) throw new Error('يوجد فيديو قيد التجهيز؛ انتظر أو ألغِ العملية الحالية.');
    if (!isVideo(file) || !file.size || file.size > LIMIT) throw new Error('اختر فيديو صالحًا بحجم لا يتجاوز 500 ميجابايت.');
    if (signal?.aborted) throw cancelled();
    busy = true;
    let ffmpeg, wasmURL, timedOut = false, timeout;
    const downloadController = new AbortController();
    const abort = () => { downloadController.abort(); ffmpeg?.terminate(); };
    const guard = () => { if (signal?.aborted) throw cancelled(); };
    try {
      stage('جاري تحميل أداة تجهيز الفيديو… أول استخدام يحتاج تنزيل الأداة.');
      const {FFmpeg} = await import(BASE + 'ffmpeg-0.12.15/index.js');
      guard();
      ffmpeg = new FFmpeg();
      signal?.addEventListener('abort', abort, {once:true});
      // Also covers module/core loading and hung workers, not just the encoder.
      timeout = setTimeout(() => { timedOut = true; abort(); }, 30 * 60 * 1000);
      // Two sub-25 MB assets also work with GitHub's browser uploader.
      const parts = await Promise.all([1,2].map(async part => {
        const response = await fetch(BASE + `core-0.12.10/ffmpeg-core.part${part}.bin`, {signal:downloadController.signal});
        if (!response.ok) throw new Error('runtime unavailable');
        return response.arrayBuffer();
      }));
      guard();
      wasmURL = URL.createObjectURL(new Blob(parts, {type:'application/wasm'}));
      await ffmpeg.load({coreURL:location.origin + BASE + 'core-0.12.10/ffmpeg-core.js', wasmURL});
      guard();
      await ffmpeg.createDir('/input');
      await ffmpeg.mount('WORKERFS', {blobs:[{name:'source', data:file}]}, '/input');
      const probe = async (path, out) => {
        const code = await ffmpeg.ffprobe(['-v','error','-show_streams','-show_format','-of','json',path,'-o',out]);
        // core 0.12.10 leaves ret at -1 for successful ffprobe; validate the JSON below.
        
        if(code !== 0 && code !== -1) throw new Error('تعذر قراءة الفيديو؛ قد يكون تالفًا أو بترميز غير مدعوم.');
        return JSON.parse(await ffmpeg.readFile(out, 'utf8'));
      };
      stage('جاري فحص الفيديو وأبعاده…');
      const source = await probe('/input/source', 'input.json');
      const video = source.streams?.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic);
      const duration = Number(video?.duration || source.format?.duration);
      if (!video || !Number.isFinite(duration) || duration <= 0) throw new Error('تعذر تحديد مدة الفيديو أو مسار الصورة؛ لم يُرفع الملف.');
      const progress = ({time}) => {
        const percent = Math.max(0, Math.min(99, Math.floor(time / 1000000 / duration * 100)));
        stage(`جاري تجهيز الفيديو للشاشة: ${percent}% — اترك الصفحة مفتوحة.`);
      };
      ffmpeg.on('progress', progress);
      stage('جاري تجهيز الفيديو للشاشة: 0% — اترك الصفحة مفتوحة.');
      const args = ['-hide_banner','-i','/input/source','-map',`0:${video.index}`,'-map','0:a:0?','-t',String(duration),
        // Fill the portrait frame proportionally, including small inputs. Never bake empty borders into it.
        '-vf',"scale=w='max(2,trunc(iw*sar/2)*2)':h='max(2,trunc(ih/2)*2)',setsar=1,scale=1080:1920:force_original_aspect_ratio=increase:force_divisible_by=2,crop=1080:1920,setsar=1,fps=30",
        '-c:v','libx264','-preset','ultrafast','-crf','23','-profile:v','baseline','-level:v','4.1','-pix_fmt','yuv420p',
        '-maxrate','5M','-bufsize','10M','-c:a','aac','-b:a','128k','-ar','48000','-ac','2',
        '-map_metadata','-1','-map_chapters','-1','-movflags','+faststart','-threads','1','-y','output.mp4'];
      if (await ffmpeg.exec(args, 30 * 60 * 1000) !== 0) throw new Error('تعذر تحويل الفيديو على هذا الجهاز. جرّب من كمبيوتر أو استخدم ملفًا أصغر؛ لم يُرفع أي ملف.');
      ffmpeg.off('progress', progress);
      guard();
      stage('جاري التحقق من النسخة المجهزة…');
      const output = await probe('output.mp4', 'output.json');
      const encoded = output.streams?.find(s => s.codec_type === 'video');
      if (encoded?.codec_name !== 'h264' || encoded.width !== 1080 || encoded.height !== 1920 || encoded.pix_fmt !== 'yuv420p' || Math.abs(Number(output.format?.duration) - duration) > Math.max(1, duration * .01)) {
        throw new Error('لم تكتمل مطابقة الفيديو لأبعاد الشاشة ومدته؛ لم يُنشر الإعلان.');
      }
      if (Number(output.format?.size) > LIMIT) throw new Error('الفيديو بعد التجهيز أكبر من 500 ميجابايت؛ استخدم فيديو أقصر.');
      const data = await ffmpeg.readFile('output.mp4');
      guard();
      if (!data.length || data.length > LIMIT) throw new Error('حجم الفيديو المجهز غير مناسب؛ لم يُرفع الملف.');
      const name = (file.name || 'video').replace(/\.[^.]+$/, '') + '-tv.mp4';
      return new File([data], name, {type:'video/mp4'});
    } catch (error) {
      if (signal?.aborted) throw cancelled();
      if (timedOut) throw new Error('استغرق تجهيز الفيديو وقتًا أطول من المسموح؛ جرّب ملفًا أقصر أو جهازًا أقوى.');
      if (/[\u0600-\u06ff]/.test(error?.message || '')) throw error;
      console.warn('Video preparation failed:', error);
      throw new Error('تعذر تجهيز الفيديو. تحقق من الاتصال وتوفر ذاكرة الجهاز، أو جرّب من كمبيوتر. لم يُرفع الملف.');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      ffmpeg?.terminate();
      downloadController.abort();
      if (wasmURL) URL.revokeObjectURL(wasmURL);
      busy = false;
    }
  }
  root.CITLVideoConverter = Object.freeze({isVideo, convert});
})(window);
