/* One persistent client per page. A refresh rate limit is temporary, never a logout. */
(function(root){
 'use strict';
 const factory=root.supabase;if(!factory?.createClient||root.CITLAuthClient)return;
 const create=factory.createClient.bind(factory),clients=new Map();
 let mainState=null;
 const transient=error=>error?.transient===true||error?.code==='AUTH_RETRY_LATER'||error?.status===429||error?.name==='AuthRetryableFetchError'||error?.status>=500;
 function fault(state){return Object.assign(new Error('تأخر تجديد جلسة الدخول مؤقتًا. سنعيد الاتصال تلقائيًا؛ لا تحتاج تسجيل الخروج.'),{name:'CITLAuthTransientError',code:'AUTH_RETRY_LATER',status:429,transient:true,retryAt:state.until});}
 function cooldown(state){try{const value=JSON.parse(localStorage.getItem(state.key)||'null');if(Number.isFinite(value?.until)&&value.until>Date.now()&&value.until<=Date.now()+86400000)state.until=Math.max(state.until,value.until);}catch(_){}return Math.max(0,state.until-Date.now());}
 function pause(state,response){
  const header=response?.headers?.get('Retry-After');let delay=Number(header)*1000;
  if(!(delay>0)&&header)delay=Date.parse(header)-Date.now();
  state.epoch++;state.attempts++;if(!(delay>0))delay=Math.min(300000,60000*2**Math.min(3,state.attempts-1));
  state.until=Math.max(state.until,Date.now()+Math.max(10000,delay));
  try{localStorage.setItem(state.key,JSON.stringify({until:state.until}));}catch(_){}
  setTimeout(()=>root.dispatchEvent(new CustomEvent('citl-auth-backoff',{detail:{retryAt:state.until}})),0);
 }
 function recovered(state){const wasPaused=state.until>0;state.until=0;state.attempts=0;try{localStorage.removeItem(state.key);}catch(_){}if(wasPaused)root.dispatchEvent(new Event('citl-auth-transport-ready'));}
 function guardedCreate(url,key,options={}){
  if(options.auth?.storageKey!=='sb-main-auth'||options.auth?.persistSession===false)return create(url,key,options);
  const identity=String(url)+'|'+key+'|sb-main-auth';if(clients.has(identity))return clients.get(identity);
  const origin=new URL(url).origin,state={until:0,attempts:0,epoch:0,key:'citl-auth-backoff:'+new URL(url).hostname};mainState=state;
  const fetcher=options.global?.fetch||root.CITLReadFetch||root.fetch.bind(root);
  const guardedFetch=async(input,init)=>{
   const target=new URL(String(input?.url||input),url),same=target.origin===origin;
   const refresh=same&&target.pathname==='/auth/v1/token'&&target.searchParams.get('grant_type')==='refresh_token';
   const api=same&&/^\/(rest|functions|storage)\/v1\//.test(target.pathname);
   if((refresh||api)&&cooldown(state)>0)throw fault(state);
   const response=await fetcher(input,init);
   if(refresh&&response.status===429){
    pause(state,response);
    // This bundled SDK removes sessions for AuthApiError(429). A rejected fetch is
    // classified by the SDK as AuthRetryableFetchError, preserving its stored session.
    // Keep the real HTTP 429 in the browser network log; do not forge an HTTP status.
    throw fault(state);
   }
   if(same&&target.pathname==='/auth/v1/token'&&!refresh&&response.ok)state.loginSucceeded=true;
   return response;
  };
  const client=create(url,key,{...options,global:{...options.global,fetch:guardedFetch}});clients.set(identity,client);
  for(const method of ['getSession','refreshSession']){
   const original=client.auth[method].bind(client.auth);let inflight=null;
   client.auth[method]=(...args)=>{
    if(cooldown(state)>0)return Promise.resolve({data:{session:null,user:null},error:fault(state)});
    if(inflight)return inflight;
    inflight=Promise.resolve().then(async()=>{
     // Initialization may itself try refresh. Recheck its cooldown before starting
     // a second SDK session read queued behind initialization.
     if(client.auth.initialize)await client.auth.initialize();
     if(cooldown(state)>0)return {data:{session:null,user:null},error:fault(state)};
     return original(...args);
    }).then(result=>{
     if(result.error&&cooldown(state)>0)return {...result,error:fault(state)};
     return result;
    }).finally(()=>{inflight=null;});return inflight;
   };
  }
  // Never perform auth work synchronously under the SDK's auth callback lock.
  client.auth.onAuthStateChange?.((event,session)=>{if(event==='TOKEN_REFRESHED'||event==='SIGNED_IN'&&state.loginSucceeded){state.loginSucceeded=false;const epoch=state.epoch;setTimeout(()=>{if(epoch!==state.epoch)return;let saved;try{saved=JSON.parse(localStorage.getItem('sb-main-auth')||'null');}catch(_){}if(saved?.expires_at>Date.now()/1000&&saved.access_token===session?.access_token)recovered(state);},0);}});
  return client;
 }
 root.CITLAuthClient=Object.freeze({
  cooldown:()=>mainState?cooldown(mainState):0,
  retryError:()=>fault(mainState||{until:Date.now()+10000}),
  transient,
  normalize:error=>mainState&&cooldown(mainState)>0?fault(mainState):error
 });
 root.supabase={...factory,createClient:guardedCreate};
})(window);
