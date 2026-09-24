(function(root){
 'use strict';
 function today(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
 function allows(value,date=today()) {return (!value?.display_from||date>=value.display_from)&&(!value?.display_until||date<=value.display_until);}
 function validate(value){if(value.display_from&&value.display_until&&value.display_from>value.display_until)throw new Error('نهاية العرض يجب أن تكون بعد بدايته أو في نفس اليوم');return value;}
 function fields(prefix,label){return `<fieldset class="border border-gray-200 rounded-lg p-3 mt-3"><legend class="text-xs font-bold text-[#2A3475] px-1">${label} — اختياري</legend><div class="grid grid-cols-2 gap-3"><label class="text-xs">من تاريخ<input type="date" id="${prefix}-from" class="w-full border border-gray-300 rounded-lg p-2 mt-1 bg-white"></label><label class="text-xs">إلى تاريخ<input type="date" id="${prefix}-until" class="w-full border border-gray-300 rounded-lg p-2 mt-1 bg-white"></label></div><p class="text-[10px] text-gray-500 mt-2">اتركهما فارغين للعرض بدون فترة محددة. يوم النهاية مشمول بتوقيت القاهرة.</p></fieldset>`;}
 function read(prefix){return validate({display_from:document.getElementById(prefix+'-from')?.value||null,display_until:document.getElementById(prefix+'-until')?.value||null});}
 function fill(prefix,value={}){for(const [suffix,key]of [['from','display_from'],['until','display_until']]){const el=document.getElementById(prefix+'-'+suffix);if(el)el.value=value[key]||'';}}
 root.CITLDisplayDates=Object.freeze({today,allows,validate,fields,read,fill});
})(window);
