// Same Python extractor as the desktop program. Files stay in this worker's memory.
'use strict';
importScripts('/assets/vendor/pdf/pyodide.js');
self.onmessage=async({data})=>{
 try{
  const base='/assets/vendor/pdf/';
  postMessage({stage:'جاري تحميل محرك قراءة PDF…'});
  const py=await loadPyodide({indexURL:base});
  await py.loadPackage(['cryptography','charset-normalizer','micropip']);
  const manifest=await (await fetch(base+'manifest.json')).json();
  py.globals.set('wheel_urls',manifest.wheels.map(n=>location.origin+base+n));
  await py.runPythonAsync('import micropip\nawait micropip.install(wheel_urls.to_py(), deps=False)');
  py.unpackArchive(await (await fetch(base+'extractor.zip')).arrayBuffer(),'zip',{extractDir:'/extractor'});
  py.FS.mkdirTree('/input');py.FS.mkdirTree('/output');
  const names=new Set();
  for(const file of data.files){
   const name=file.name.replace(/[^\p{L}\p{N} ._()-]/gu,'_');
   if(names.has(name))throw Error('ملفان بنفس الاسم؛ غيّر اسم أحدهما قبل التحويل');names.add(name);
   py.FS.writeFile('/input/'+name,new Uint8Array(file.bytes));
  }
  py.globals.set('pdf_names',Array.from(names));py.globals.set('extract_kind',data.kind);py.globals.set('exam_year',data.year);
  py.globals.set('emit_progress',message=>postMessage({stage:message}));
  const result=await py.runPythonAsync(`
import sys, json
from pathlib import Path
sys.path.insert(0, '/extractor')
from citl_schedule_extractor.term_extractor import convert_term_pdf
from citl_schedule_extractor.exam_extractor import convert_exam_pdfs
paths=[Path('/input')/name for name in pdf_names.to_py()]
if extract_kind == 'study':
    result=convert_term_pdf(paths[0],Path('/output'),progress=emit_progress)
else:
    result=convert_exam_pdfs(paths,Path('/output'),year=int(exam_year),progress=emit_progress)
reports={p.name:p.read_text(encoding='utf-8') for p in Path('/output').iterdir() if p.suffix in ('.txt','.log')}
json.dumps({'sql':result.sql_path.read_text(encoding='utf-8'),'count':result.record_count,'skipped':result.details_count,'reports':reports},ensure_ascii=False)
`);
  postMessage({result:JSON.parse(result)});
 }catch(error){postMessage({error:'تعذر تحويل PDF: '+String(error.message||error)});}
};
