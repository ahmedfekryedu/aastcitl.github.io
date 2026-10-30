(function(root){'use strict';
 const prefixes={LSA:['NEW','ar','supply-chain'],LSE:['NEW','en','supply-chain'],LTA:['NEW','ar','transport-logistics'],LTE:['NEW','en','transport-logistics'],LIA:['NEW','ar','trade-logistics'],LIE:['NEW','en','trade-logistics'],LPA:['NEW','ar','energy-logistics'],LPE:['NEW','en','energy-logistics'],ALAS:['OLD','ar','supply-chain'],ELES:['OLD','en','supply-chain'],ALAO:['OLD','ar','transport-logistics'],ELEO:['OLD','en','transport-logistics'],ALAT:['OLD','ar','trade-logistics'],ELET:['OLD','en','trade-logistics'],ELEP:['OLD','en','energy-logistics'],ALA:['OLD','ar',null],ELE:['OLD','en',null],ALI:['OLD',null,null],LEA:['NEW','ar',null],LEE:['NEW','en',null],EBA:['NEW','ar',null],EBE:['NEW','en',null],UNR:['UNKNOWN',null,null]};
 function normalize(raw){return String(raw??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,'');}
 function codes(raw){const s=normalize(raw),pair=s.match(/^([A-Z]{3,4})\/([A-Z]{3,4})(\d{3,4})$/);if(pair)return pair[1]===pair[2]?[]:[pair[1]+pair[3],pair[2]+pair[3]];return /^[A-Z]{3,4}\d{3,4}$/.test(s)?[s]:[];}
 function classify(raw){const code=normalize(raw),m=code.match(/^([A-Z]{3,4})(\d{3,4})$/),p=m&&prefixes[m[1]];return {code,regulation:p?.[0]||'UNKNOWN',language:p?.[1]||null,owner_candidate:p?.[2]||null,status:!p?'UNKNOWN_CODE':!p[2]?'OWNER_REVIEW':'REFERENCE_REQUIRED'};}
 // Advisory only. A prefix never creates an offering, grants a role or approves ownership.
 function reconcile(schedule,references){
  const byCode=new Map();for(const r of references){const k=normalize(r.code);if(!byCode.has(k))byCode.set(k,[]);byCode.get(k).push(r);}
  const groups=new Map(),exceptions=[];
  for(const s of schedule){
   const code=normalize(s.course_code),issues=[];
   if(!s.id||!s.term_id)issues.push('MISSING_SOURCE_ID');
   if(codes(code).length!==1)issues.push('INVALID_CODE');
   const ref=(byCode.get(code)||[]).filter(r=>r.review_status==='verified');
   if(ref.length!==1)issues.push(ref.length?'CONFLICTING_REFERENCE':'UNVERIFIED_REFERENCE');
   const track=s.program_track||'',campus=s.campus||'',group=s.section_id||s.group_number||s.group_name||'';
   if(/HULL/i.test([s.course_name,track,group].join(' '))&&!track&&!group)issues.push('HULL_SCOPE_MISSING');
   if(!s.profile_id||s.identity_verified!==true)issues.push('IDENTITY_REVIEW');
   const key=JSON.stringify([s.term_id,code,s.offering_source_id||null,track,campus,group,ref[0]?.language||null]);
   if(!groups.has(key))groups.set(key,{key,term_id:s.term_id,code,course_name:s.course_name,group,track,campus,reference:ref[0]||null,schedule_ids:[],staff:[],issues:[]});
   const g=groups.get(key);g.schedule_ids.push(s.id);if(s.profile_id&&!g.staff.includes(s.profile_id))g.staff.push(s.profile_id);g.issues.push(...issues);
   if(g.course_name!==s.course_name)g.issues.push('TITLE_CONFLICT');
  }
  for(const g of groups.values()){
   if(g.staff.length>1&&!g.group&&!JSON.parse(g.key)[2])g.issues.push('MULTIPLE_STAFF_SCOPE_REVIEW');
   g.issues=[...new Set(g.issues)];g.status=g.issues.length?'needs_review':'matched';if(g.issues.length)exceptions.push(g.key);
  }
  return {offerings:[...groups.values()],exceptions,source_rows:schedule.length,creates_reports:false,grants_roles:false};
 }
 const api=Object.freeze({normalize,codes,classify,reconcile});if(typeof module==='object'&&module.exports)module.exports=api;else root.CITLCourseReferenceModel=api;
})(typeof window==='undefined'?globalThis:window);
