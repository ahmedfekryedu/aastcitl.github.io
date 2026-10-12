(function(root){
  'use strict';
  const days=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday'];
  const ar=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
  const norm=s=>String(s??'').trim().replace(/[أإآ]/g,'ا').toLowerCase();
  const aliases={course_name:['المادة','اسم المادة','المقرر'],course_code:['كود المادة'],room_name:['القاعة','اسم القاعة'],instructor:['المحاضر','اسم المحاضر'],day_of_week:['اليوم'],time_slot:['الوقت','التوقيت'],exam_date:['تاريخ الامتحان','التاريخ'],start_time:['وقت البداية'],end_time:['وقت النهاية']};
  function csv(text){
    const records=[];let row=[],field='',quoted=false;
    for(let i=0;i<=text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else throw Error('علامة اقتباس غير صحيحة في CSV');}
      else if(c===undefined||(!quoted&&(c===','||c==='\n'||c==='\r'))){row.push(field);field='';if(c!==','){if(row.some(x=>x.trim()))records.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
      else field+=c;
    }
    if(quoted)throw Error('علامة اقتباس غير مغلقة في CSV');
    const headers=records.shift()?.map(x=>x.trim());if(!headers?.length||new Set(headers).size!==headers.length)throw Error('عناوين الأعمدة ناقصة أو مكررة');
    return records.map((r,i)=>{if(r.length!==headers.length)throw Error(`عدد أعمدة CSV غير مطابق في الصف ${i+2}`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
  }
  // Parse INSERT data only. No SQL from a selected file is ever sent for execution.
  function sql(text,kind){
    const tokens=[];let i=0;
    while(i<text.length){
      if(/\s/.test(text[i])){i++;continue;}
      if(text.slice(i,i+2)==='--'){i=text.indexOf('\n',i);if(i<0)break;continue;}
      if(text.slice(i,i+2)==='/*'){const e=text.indexOf('*/',i+2);if(e<0)throw Error('تعليق SQL غير مغلق');i=e+2;continue;}
      const quote=text[i];
      if(quote==="'"||quote==='"'){
        let value='',closed=false;i++;
        while(i<text.length){if(text[i]===quote){if(text[i+1]===quote){value+=quote;i+=2;}else{i++;closed=true;break;}}else value+=text[i++];}
        if(!closed)throw Error('نص SQL غير مغلق');tokens.push({type:quote==="'"?'value':'word',value});continue;
      }
      const m=/^[A-Za-z_][A-Za-z_0-9$]*|^-?\d+(?:\.\d+)?/.exec(text.slice(i));
      if(m){tokens.push({type:/^-?\d/.test(m[0])?'number':'word',value:m[0]});i+=m[0].length;continue;}
      if('(),;.[]:'.includes(text[i])){tokens.push({type:'symbol',value:text[i++]});continue;}
      throw Error('صيغة SQL غير مدعومة؛ استخدم INSERT VALUES أو قالب CSV');
    }
    let pos=0;const rows=[],target=kind==='study'?'academic_schedule':'exam_schedule';
    const peek=()=>tokens[pos]?.value.toLowerCase(),take=()=>{if(!tokens[pos])throw Error('ملف SQL غير مكتمل');return tokens[pos++];};
    const expect=v=>{if(peek()!==v)throw Error(`صيغة SQL: متوقع ${v}`);return take();};
    function table(){let t=take().value;if(peek()==='.'){if(t.toLowerCase()!=='public')throw Error('اسم schema غير مدعوم');take();t=take().value;}if(t!==target)throw Error('الملف يحتوي جدولًا مختلفًا عن نوع الاستيراد المختار');}
    while(pos<tokens.length){
      if(peek()===';'){take();continue;}
      if(['begin','commit'].includes(peek())){take();expect(';');continue;}
      if(peek()==='truncate'){take();if(peek()==='table')take();table();while(['restart','identity','cascade'].includes(peek()))take();expect(';');continue;}
      if(peek()==='delete'){take();expect('from');table();expect(';');continue;}
      expect('insert');expect('into');table();expect('(');const columns=[];
      do{if(peek()===',')take();const t=take();if(t.type!=='word'||columns.includes(t.value))throw Error('أعمدة SQL غير صالحة');columns.push(t.value);}while(peek()===',');expect(')');expect('values');
      do{
        if(peek()===',')take();expect('(');const values=[];
        do{if(peek()===',')take();const t=take();let v;if(t.type==='value')v=t.value;else if(t.type==='number')v=Number(t.value);else if(t.value.toLowerCase()==='null')v=null;else if(['true','false'].includes(t.value.toLowerCase()))v=t.value.toLowerCase()==='true';else throw Error('الاستيراد يقبل قيمًا فقط، ولا يشغّل دوال SQL');
          if(peek()===':'){expect(':');expect(':');const cast=take().value.toLowerCase();if(!['text','varchar','date','time','timestamp','timestamptz','int','integer','bigint','uuid','json','jsonb','boolean'].includes(cast))throw Error('تحويل نوع غير مدعوم');if(peek()==='['){take();expect(']');}}
          values.push(v);
        }while(peek()===',');expect(')');if(values.length!==columns.length)throw Error('عدد القيم غير مطابق للأعمدة');rows.push(Object.fromEntries(columns.map((c,j)=>[c,values[j]])));
      }while(peek()===',');if(pos<tokens.length)expect(';');
    }
    return rows;
  }
  function normalize(rows,kind){
    if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('عدد الصفوف المقبول من 1 إلى 10000');
    return rows.map((original,i)=>{
      if(!original||typeof original!=='object'||Array.isArray(original))throw Error(`الصف ${i+1} غير صالح`);
      const r={...original};
      for(const [key,names]of Object.entries(aliases))if(r[key]===undefined){const found=Object.keys(r).find(k=>names.some(a=>norm(a)===norm(k)));if(found){r[key]=r[found];delete r[found];}}
      for(const k of (kind==='study'?['course_name','room_name','instructor','course_code']:['course_name','room_name','instructor']))r[k]=String(r[k]??'').trim();
      if(!r.course_name||!r.room_name)throw Error(`المادة والقاعة مطلوبتان في الصف ${i+1}`);
      if(kind==='study'){
        const d=days.findIndex((d,j)=>norm(d)===norm(r.day_of_week)||norm(ar[j])===norm(r.day_of_week));
        if(d<0)throw Error(`راجع يوم الصف ${i+1}؛ الأيام من السبت إلى الخميس`);r.day_of_week=days[d];
        const parsed=root.CITLStudy.slot(r.time_slot);if(parsed.start===null)throw Error(`راجع التوقيت في الصف ${i+1}`);
        r.time_slot=parsed.label.replace(' – ',' - ');r.status=r.status||'active';r.period_order=r.period_order??1;
        // Historical cancellations/actions must not leak into the next term's import.
        r.cancelled_dates=[];
      }else{
        if(!/^\d{4}-\d{2}-\d{2}$/.test(r.exam_date||''))throw Error(`تاريخ الامتحان في الصف ${i+1} يجب أن يكون YYYY-MM-DD`);
        if(!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(r.start_time||'')||!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(r.end_time||''))throw Error(`راجع وقت الامتحان في الصف ${i+1}`);
        for(const k of ['start_time','end_time']){const parts=r[k].split(':');if(Number(parts[0])>23||Number(parts[1])>59||Number(parts[2]||0)>59)throw Error(`وقت غير صالح في الصف ${i+1}`);r[k]=parts.map(x=>x.padStart(2,'0')).concat(parts.length===2?['00']:[]).join(':');}
        if(r.end_time<=r.start_time)throw Error(`نهاية الامتحان تسبق البداية في الصف ${i+1}`);
      }
      return r;
    });
  }
  function identity(row,kind){
    const keys=kind==='study'?['course_name','course_code','instructor','room_name','day_of_week','time_slot','period_order']:['course_name','course_code','course_language','academic_level','group_number','student_count','instructor','room_name','exam_date','start_time','end_time'];
    return JSON.stringify(keys.map(k=>String(row[k]??'')));
  }
  function changes(existing,incoming,kind,termId){
    const pool=new Map();for(const r of existing)if(termId&&r.term_id===termId){const k=identity(r,kind);pool.set(k,(pool.get(k)||0)+1);}
    let retained=0;for(const r of incoming){const k=identity(r,kind);if(pool.get(k)>0){retained++;pool.set(k,pool.get(k)-1);}}
    return {retained,added:incoming.length-retained,removed:existing.length-retained};
  }
  function parse(text,extension,kind){text=text.replace(/^\uFEFF/,'');let rows;
    if(extension==='json'){const value=JSON.parse(text);rows=Array.isArray(value)?value:value.rows;}
    else if(extension==='sql')rows=sql(text,kind);else if(extension==='csv')rows=csv(text);else throw Error('الصيغ المتاحة: SQL INSERT أو CSV أو JSON');
    return normalize(rows,kind);
  }
  root.CITLScheduleImport=Object.freeze({parse,normalize,days,ar,changes});
})(typeof window==='undefined'?globalThis:window);
