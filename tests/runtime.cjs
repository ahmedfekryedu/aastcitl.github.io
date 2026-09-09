const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
(async()=>{
 let timer,cleared=0,readSignal,writes=0;
 const window={};const context={window,AbortController,setTimeout:fn=>(timer=fn,1),clearTimeout:()=>cleared++,fetch:async(input,options)=>{
  if(options.method==='POST'){writes++;return 'write-result';}
  readSignal=options.signal;
  return new Promise((resolve,reject)=>{if(readSignal.aborted)reject(new Error('aborted'));else readSignal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});
 }};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/read-timeout.js'),'utf8'),context);
 const pending=window.CITLReadFetch('/read');timer();await assert.rejects(pending,/aborted/);assert.ok(readSignal.aborted);assert.equal(cleared,1);
 const original=new AbortController();const propagated=window.CITLReadFetch('/read',{signal:original.signal});original.abort();await assert.rejects(propagated,/aborted/);
 assert.equal(await window.CITLReadFetch('/write',{method:'POST'}),'write-result');assert.equal(writes,1);
 const handlers={},deleted=[],fresh={ok:true,clone(){return this}},request={method:'GET',url:'https://example.invalid/today/'};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{URL,Response,self:{location:{origin:'https://example.invalid'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting(){},clients:{claim(){}}},console,fetch:async()=>fresh,caches:{open:async()=>({put:async()=>{throw Error('quota')},addAll:async()=>{}}),match:async()=>null,keys:async()=>['citl-app-old','citl-smart-old','unrelated-cache','citl-smart-native-fix-20260909-1'],delete:async key=>{deleted.push(key);return true;}}});
 let response;handlers.fetch({request,respondWith:p=>response=p});assert.equal(await response,fresh);
 let activated;handlers.activate({waitUntil:p=>activated=p});await activated;assert.deepEqual(deleted,['citl-app-old','citl-smart-old']);
 console.log('PASS: read deadline, upstream cancellation, unchanged write behavior, full-cache recovery, scoped cache cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
