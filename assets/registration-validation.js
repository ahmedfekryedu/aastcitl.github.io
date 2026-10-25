(function(root){
 'use strict';let serial=0;
 const labels={'reg-name':'الاسم الكامل','reg-mobile':'رقم الموبايل','reg-dept':'القسم / الجهة','reg-position':'المسمى الوظيفي','reg-account-type':'نوع التسجيل','reg-linked-instructor':'الاسم الأكاديمي','reg-email':'البريد الإلكتروني','reg-access-code':'كود التسجيل','reg-password':'كلمة المرور',full_name:'الاسم الكامل',mobile:'رقم الموبايل',department:'القسم / الجهة',position:'المسمى الوظيفي',account_type:'نوع التسجيل',linked_instructor:'الاسم الأكاديمي',email:'البريد الإلكتروني',password:'كلمة المرور',confirmation:'تأكيد كلمة المرور'};
 const style=document.createElement('style');style.textContent='.citl-field-error{display:block!important;color:#b42318!important;font-size:12px!important;line-height:1.7!important;margin:5px 0 0!important;font-weight:600;white-space:normal;overflow-wrap:anywhere}.citl-field-invalid{border-color:#c53c32!important;outline:2px solid #c53c3220!important;outline-offset:1px}';document.head.append(style);
 function bind(form){
  if(!form||form.dataset.citlValidation)return;form.dataset.citlValidation='true';form.noValidate=true;
  const controls=[...form.querySelectorAll('input,select,textarea')],states=new Map();
  function requirements(){const type=form.querySelector('#reg-account-type,[name=account_type]'),academic=form.querySelector('#reg-linked-instructor,[name=linked_instructor]');if(type&&academic){academic.required=type.value==='faculty';academic.disabled=type.value!=='faculty';}}
  function reason(field){
   if(field.disabled||field.type==='hidden'||['submit','button'].includes(field.type))return '';
   const title=labels[field.id]||labels[field.name]||'هذه الخانة',value=field.value.trim();
   if(field.required&&!value)return (field.tagName==='SELECT'?'اختر ':'أدخل ')+title;
   if(!value)return '';
   if(field.type==='email'&&field.validity.typeMismatch)return 'أدخل بريدًا إلكترونيًا صحيحًا';
   if(field.validity.patternMismatch)return title==='رقم الموبايل'?'أدخل رقم موبايل مكوّنًا من 11 رقمًا':'راجع صيغة '+title;
   if(field.minLength>0&&field.value.length<field.minLength)return title+' يجب ألا يقل عن '+field.minLength+' أحرف';
   if(field.name==='confirmation'&&field.value!==form.elements.password?.value)return 'كلمة المرور وتأكيدها غير متطابقين';
   if(field.type==='password'&&new TextEncoder().encode(field.value).length>72)return 'كلمة المرور لا تتجاوز 72 بايت';
   if(title==='المسمى الوظيفي'&&value==='غير محدد')return 'اكتب المسمى الوظيفي الصحيح';
   return field.validity.valid?'':field.validationMessage||'راجع '+title;
  }
  function mark(field,message){
   let state=states.get(field);
   if(!state){const proxy=field.closest('.custom-dropdown')?.querySelector('.custom-dropdown-display')||field;const error=document.createElement('span');error.id='citl-field-error-'+(++serial);error.className='citl-field-error';error.setAttribute('aria-live','polite');const anchor=field.closest('.custom-dropdown')||field;anchor.after(error);state={proxy,error};states.set(field,state);}
   const {proxy,error}=state;error.textContent=message;error.style.setProperty('display',message?'block':'none','important');
   for(const node of new Set([field,proxy])){node.classList.toggle('citl-field-invalid',!!message);if(message){node.setAttribute('aria-invalid','true');const ids=new Set((node.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(error.id);node.setAttribute('aria-describedby',[...ids].join(' '));}else{node.removeAttribute('aria-invalid');const ids=(node.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&x!==error.id);if(ids.length)node.setAttribute('aria-describedby',ids.join(' '));else node.removeAttribute('aria-describedby');}}
   return proxy;
  }
  function show(field,message){const proxy=mark(field,message);if(!proxy.matches('input,select,textarea,button,a'))proxy.tabIndex=0;proxy.scrollIntoView({block:'center',behavior:'auto'});proxy.focus({preventScroll:true});}
  function validate(){requirements();let first;for(const field of controls){const message=reason(field);if(message||states.has(field))mark(field,message);if(message&&!first)first=[field,message];}if(first){show(...first);return false;}return true;}
  form.addEventListener('submit',e=>{if(!validate()){e.preventDefault();e.stopImmediatePropagation();}},true);
  for(const event of ['input','change'])form.addEventListener(event,e=>{requirements();for(const field of controls)if(states.has(field))mark(field,reason(field));});
  requirements();form.citlValidation={validate,show};
 }
 root.CITLRegistrationValidation=Object.freeze({bind});bind(document.getElementById('signupForm'));
})(window);
