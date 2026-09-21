(function(root){
  'use strict';
  // Keep the original select and its events as the application's source of truth.
  const enhanced=new WeakMap();let active=null,serial=0;
  function close(focus=false){if(!active)return;const old=active;active=null;old.list.remove();old.button.setAttribute('aria-expanded','false');old.button.removeAttribute('aria-activedescendant');if(focus)old.button.focus();}
  function position(){if(!active)return;const {button,list}=active,r=button.getBoundingClientRect();if(!button.isConnected||!r.width||!r.height){close();return;}
    const h=Math.min(260,Math.max(innerHeight-r.bottom-16,r.top-16)),w=Math.min(Math.max(r.width,200),innerWidth-24);
    list.style.width=w+'px';list.style.maxHeight=h+'px';list.style.left=Math.max(12,Math.min(r.right-w,innerWidth-w-12))+'px';
    list.style.top='auto';list.style.bottom='auto';if(innerHeight-r.bottom>=Math.min(260,r.top))list.style.top=r.bottom+5+'px';else list.style.bottom=innerHeight-r.top+5+'px';
  }
  function enhance(select){
    if(enhanced.has(select)||select.multiple||select.size>1||select.closest('.custom-dropdown')||select.type==='hidden'||select.hidden||select.classList.contains('hidden'))return;
    const shell=document.createElement('span');shell.className='citl-select';
    const button=document.createElement('button');button.type='button';button.className='citl-select-button';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    const caption=document.createElement('span');caption.className='citl-select-caption';button.append(caption);
    const chevron=document.createElement('span');chevron.className='citl-select-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';button.append(chevron);
    select.before(shell);shell.append(select,button);select.classList.add('citl-select-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const id='citl-options-'+(++serial);button.setAttribute('aria-controls',id);button.dataset.selectId=select.id;
    function sync(){
      caption.textContent=select.selectedOptions[0]?.textContent||'اختر';button.disabled=select.disabled;
      button.setAttribute('aria-label',select.getAttribute('aria-label')||[...select.labels].map(l=>l.textContent.trim()).join(' ')||select.title||select.id||'اختيار');
      shell.hidden=select.hidden||select.classList.contains('hidden');
      if(active?.select===select){if(select.disabled||shell.hidden)close();else draw();}
    }
    function choose(option){if(option.disabled||option.parentElement.disabled)return;select.value=option.value;close(true);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));sync();}
    function draw(){
      if(active?.select!==select)return;const list=active.list;list.replaceChildren();
      for(const [i,option] of [...select.options].entries()){
        if(option.hidden)continue;const item=document.createElement('div');item.className='citl-select-option';item.id=id+'-'+i;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));
        item.setAttribute('aria-disabled',String(option.disabled||!!option.parentElement.disabled));item.textContent=option.textContent;item.addEventListener('click',()=>choose(option));list.append(item);
      }
      active.index=Math.max(0,[...list.children].findIndex(el=>el.getAttribute('aria-selected')==='true'));highlight();position();
    }
    function highlight(){if(active?.select!==select)return;[...active.list.children].forEach((el,i)=>el.classList.toggle('is-active',i===active.index));const el=active.list.children[active.index];if(el){button.setAttribute('aria-activedescendant',el.id);el.scrollIntoView({block:'nearest'});}}
    function open(){if(button.disabled)return;if(active?.select===select){close();return;}close();document.querySelectorAll('.custom-dropdown-options.show').forEach(el=>el.classList.remove('show'));
      const list=document.createElement('div');list.className='citl-select-list';list.id=id;list.dir=getComputedStyle(select).direction;list.setAttribute('role','listbox');list.setAttribute('aria-label',button.getAttribute('aria-label'));
      document.body.append(list);active={select,button,list,index:0};button.setAttribute('aria-expanded','true');draw();
    }
    button.addEventListener('click',open);
    let search='',searchAt=0;
    button.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close(true);event.preventDefault();return;}if(event.key==='Tab'){close();return;}
      if(['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(event.key)){
        event.preventDefault();if(active?.select!==select){open();return;}
        if(event.key==='Enter'||event.key===' '){active.list.children[active.index]?.click();return;}
        const items=[...active.list.children],direction=event.key==='ArrowUp'?-1:1;let i=event.key==='Home'?-1:event.key==='End'?items.length:active.index;
        const step=event.key==='End'?-1:direction;do{i+=step;}while(i>=0&&i<items.length&&items[i].getAttribute('aria-disabled')==='true');
        active.index=Math.max(0,Math.min(items.length-1,i));highlight();return;
      }
      if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){event.preventDefault();if(active?.select!==select)open();const now=Date.now();search=now-searchAt>800?event.key:search+event.key;searchAt=now;const i=[...active.list.children].findIndex(el=>el.getAttribute('aria-disabled')!=='true'&&el.textContent.trim().toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));if(i>=0){active.index=i;highlight();}}
    });
    select.addEventListener('change',sync);select.addEventListener('focus',()=>button.focus());select.addEventListener('invalid',()=>button.focus());
    // Existing code frequently assigns .value without dispatching an event.
    for(const property of ['value','selectedIndex']){const descriptor=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,property);Object.defineProperty(select,property,{configurable:true,get(){return descriptor.get.call(this);},set(value){descriptor.set.call(this,value);sync();}});}
    new MutationObserver(sync).observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','hidden','selected','label','class','aria-label']});
    enhanced.set(select,sync);sync();
  }
  function scan(node){if(node.nodeType!==1)return;if(node.matches('select'))enhance(node);node.querySelectorAll('select').forEach(enhance);}
  document.addEventListener('pointerdown',e=>{if(active&&!active.button.contains(e.target)&&!active.list.contains(e.target))close();});
  document.addEventListener('focusin',e=>{if(active&&!active.button.contains(e.target)&&!active.list.contains(e.target))close();});
  document.addEventListener('scroll',e=>{if(active&&!active.list.contains(e.target))position();},true);root.addEventListener('resize',position);root.addEventListener('pagehide',()=>close());
  document.addEventListener('reset',()=>setTimeout(()=>document.querySelectorAll('select').forEach(el=>enhanced.get(el)?.()),0));
  // Dismiss only the backdrop itself, never a click within the dialog content.
  let pointerOrigin=null;
  document.addEventListener('pointerdown',event=>{pointerOrigin=event.target;},true);
  document.addEventListener('click',event=>{
    const target=event.target;
    if(!(target instanceof Element)||target!==pointerOrigin)return;
    document.querySelectorAll('.custom-dropdown-options.show').forEach(list=>{
      if(!list.closest('.custom-dropdown')?.contains(target))list.classList.remove('show');
    });
    if(target.matches('.modal')&&target.classList.contains('show')){
      if(target.id==='add-meeting-modal'&&root.CITLLoading?.isBooking())return;
      close();if(typeof root.closeModal==='function')root.closeModal(target.id);else target.classList.remove('show');
    }else if(target.id==='custom-confirm-modal'){
      target.querySelector('#btn-confirm-no,#confirm-cancel')?.click();
    }
  });
  function start(){scan(document.body);new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)scan(n);if(active&&!active.button.isConnected)close();}).observe(document.body,{subtree:true,childList:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})(window);
