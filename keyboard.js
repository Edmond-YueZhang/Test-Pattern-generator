(function(){
  'use strict';
  // CEF can select the next field through native Tab traversal without giving
  // its editor keyboard focus. Move DOM focus explicitly, in the same key event.
  // No timers or synthetic clicks: they can steal focus after the user types.
  let handledTab=false;
  const isEditor=el=>el instanceof HTMLInputElement&&el.type==='text';
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    handledTab=false;
    if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
    const current=document.activeElement;
    if(!isEditor(current)||!current.closest('#settings')||document.querySelector('dialog[open]'))return;
    const controls=Array.from(document.querySelectorAll('input,select,textarea,button,a[href],[tabindex]')).filter(el=>{
      if(el.tabIndex<0||el.matches(':disabled')||el.closest('[hidden],[inert]')||!el.getClientRects().length)return false;
      const visibility=getComputedStyle(el).visibility;
      return visibility!=='hidden'&&visibility!=='collapse';
    });
    const index=controls.indexOf(current),next=controls[index+(event.shiftKey?-1:1)];
    if(index<0||!next)return;
    event.preventDefault();event.stopImmediatePropagation();handledTab=true;
    window.focus();next.focus();
    if(isEditor(next))next.select();
  },true);
  document.addEventListener('keyup',event=>{
    if(event.key==='Tab'&&handledTab){event.preventDefault();event.stopImmediatePropagation();handledTab=false;}
  },true);
  window.addEventListener('blur',()=>{handledTab=false;});
})();
