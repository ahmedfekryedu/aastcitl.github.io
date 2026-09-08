/* Shared operational rules. No UI or business-policy changes. */
(function (root) {
  'use strict';
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function localParts(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);
    return Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type,x.value]));
  }
  function date(value = new Date()) { const p=localParts(value); return `${p.year}-${p.month}-${p.day}`; }
  function now(value = new Date()) { const p=localParts(value); return new Date(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second); }
  function minutes(value = new Date()) { const p=localParts(value); return +p.hour*60 + +p.minute; }
  function day(value = new Date()) { return DAYS[new Date(date(value)+'T12:00:00Z').getUTCDay()]; }
  function digits(value) { return String(value ?? '').replace(/[٠-٩۰-۹]/g,c => '٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)); }
  function time(value, legacy = true) {
    const m=digits(value).trim().match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM|ص|م)?$/i);
    if(!m) return null;
    let h=+m[1], n=+(m[2]||0); const suffix=(m[3]||'').toUpperCase();
    if(h>23||n>59||(suffix&&(h<1||h>12)))return null;
    if(suffix==='PM'||suffix==='م')h=h%12+12;
    else if(suffix==='AM'||suffix==='ص')h=h%12;
    else if(legacy&&h>0&&h<7)h+=12;
    return h*60+n;
  }
  function slot(value) {
    const parts=digits(value).trim().split(/\s*[-–—]\s*/);
    if(!parts[0]||parts.length>2)return null;
    const start=time(parts[0]),end=parts.length===2?time(parts[1]):start===null?null:start+110;
    return start!==null&&end!==null&&end>start&&end<1440?{start,end}:null;
  }
  function hhmm(n){return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
  function displaySlot(value){const p=slot(value);return p?`${hhmm(p.start)} - ${hhmm(p.end)}`:String(value||'');}
  function overlap(a,b){return !!a&&!!b&&a.start<b.end&&b.start<a.end;}
  function room(value){return digits(value).normalize('NFKC').toLowerCase().replace(/\blap\b/g,'lab').replace(/\s+/g,'').trim();}
  function escape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function encode(value){return encodeURIComponent(value).replace(/'/g,'%27');}
  function localURL(value){try{if(!value||!value.startsWith('/')||/^\/[/\\]/.test(value))return null;const u=new URL(value,location.origin);return u.origin===location.origin?u.pathname+u.search+u.hash:null;}catch{return null;}}
  function get(key, fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function put(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
  async function all(factory){let data=[];for(let start=0;;){const r=await factory().range(start,start+499);if(r.error)throw r.error;const rows=r.data||[];data.push(...rows);if(!rows.length)break;start+=rows.length;}return data;}
  async function effective(client, onDate=null){const {data,error}=await client.rpc('citl_effective_schedule',{p_date:onDate});if(error)throw error;return data||[];}
  async function scheduleResult(client,onDate=null){try{return {data:await effective(client,onDate),error:null};}catch(error){return {data:null,error};}}
  async function patchSetting(client,key,value){const {data,error}=await client.rpc('citl_patch_setting',{p_key:key,p_patch:value});if(error)throw error;return data;}
  function isCurrent(row,clock=minutes()){const s=slot(row.time_slot);return row.status!=='cancelled'&&s&&clock>=s.start&&clock<s.end;}
  function can(user,cap='full'){if(user?.role!=='manager')return false;const p=user.permissions||{};if(Object.keys(p).length===0)return true;const full=['can_approve','can_manage_users','can_delete'].every(x=>p[x]===true);return full||(['can_approve','can_manage_users','can_delete'].includes(cap)&&p[cap]===true);}
  function checked(response){if(response?.error)throw response.error;return response;}
  async function queryAll(factory){try{return {data:await all(factory),error:null};}catch(error){return {data:null,error};}}
  function arg(value){return escape(JSON.stringify(String(value??'')).slice(1,-1).replace(/'/g,'\\x27'));}
  function nextDate(dayName){const today=date(),d=new Date(today+'T12:00:00Z');const i=DAYS.indexOf(dayName);if(i<0)return '';d.setUTCDate(d.getUTCDate()+(i-d.getUTCDay()+7)%7);return d.toISOString().slice(0,10);}
  async function timedFetch(input,options={}){const controller=new AbortController();const original=options.signal;const abort=()=>controller.abort(original?.reason);if(original?.aborted)abort();else original?.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>controller.abort(),20000);try{return await fetch(input,{...options,signal:controller.signal});}finally{clearTimeout(timer);original?.removeEventListener('abort',abort);}}
  const api={timedFetch,can,checked,queryAll,arg,nextDate,DAYS,date,now,minutes,day,time,slot,hhmm,displaySlot,overlap,room,escape,encode,localURL,get,put,all,effective,scheduleResult,patchSetting,isCurrent};
  root.CITLRuntime=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
