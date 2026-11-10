(()=>{
const enabled=()=>window.JWC_ACCESS_CONFIG?.enabled===true;
const endpoint='https://script.google.com/macros/s/AKfycbyDBmkP_GMn8KjuI9stjkN04sVdd_vrVAqoH8Gv0gDElMG8KQkGvUVsDoJ4-oj7vcRfCg/exec';
const storageKey='jwc-staff-session';let current;
let saved;try{saved=localStorage.getItem(storageKey);}catch{}
if(!saved)try{saved=sessionStorage.getItem(storageKey);}catch{}
try{current=JSON.parse(saved||'null');}catch{}
function validSession(session){return session&&typeof session.token==='string'&&/^[a-f0-9]{64}$/i.test(session.token)&&Number.isFinite(session.expiresAt)&&session.expiresAt>Date.now();}
function getToken(){return validSession(current)?current.token:null;}
function remember(session){current=session;try{localStorage.setItem(storageKey,JSON.stringify(session));}catch{}try{sessionStorage.setItem(storageKey,JSON.stringify(session));}catch{}}
function forget(){current=null;try{localStorage.removeItem(storageKey);}catch{}try{sessionStorage.removeItem(storageKey);}catch{}}
if(validSession(current))remember(current);else forget();
window.addEventListener('storage',event=>{if(event.key===storageKey){try{current=JSON.parse(event.newValue||'null');}catch{current=null;}try{if(validSession(current))sessionStorage.setItem(storageKey,JSON.stringify(current));else sessionStorage.removeItem(storageKey);}catch{}}});
function deviceId(){try{let id=localStorage.getItem('jwc-staff-device');if(!id){id=window.JWCUuid();localStorage.setItem('jwc-staff-device',id);}return id;}catch{return window.JWCUuid();}}
function request(kind,payload,signal){return new Promise((resolve,reject)=>{
 let settled=false;
 if(signal?.aborted){reject(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));return;}
 const requestId=window.JWCUuid(),id=window.JWCUuid();const frame=document.createElement('iframe');frame.hidden=true;frame.name='jwc-access-'+requestId;frame.title='Staff access confirmation';
 const form=document.createElement('form');form.hidden=true;form.method='POST';form.action=endpoint;form.target=frame.name;
 const input=document.createElement('input');input.name='packet';input.type='hidden';input.value=JSON.stringify({kind,requestId,origin:location.origin,sessionToken:getToken(),payload:{...payload,id}});form.append(input);
 const topWindow=window.top;
 const timeout=setTimeout(()=>finish(Object.assign(new Error('Could not check the PIN. Check cell service or Wi-Fi, then try again.'),{code:'CONNECTION_FAILED'})),45000);
 function cleanup(){clearTimeout(timeout);topWindow.removeEventListener('message',receive);signal?.removeEventListener('abort',cancel);form.remove();frame.remove();}
 function cancel(){finish(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));}
 function finish(error,result){if(settled)return;settled=true;cleanup();if(error)reject(error);else resolve(result);}
 function receive(event){if(event.origin!=='https://script.google.com'&&!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;const result=event.data;if(!result||result.type!=='JWC_SUBMISSION_RESULT'||result.requestId!==requestId||result.id!==id)return;if(result.ok&&result.staffPinAccess===true)finish(null,result);else finish(Object.assign(new Error(result.message||'Staff access needs its Google deployment update.'),{code:result.code||'ACCESS_UNAVAILABLE'}));}
 topWindow.addEventListener('message',receive);signal?.addEventListener('abort',cancel,{once:true});document.body.append(frame,form);form.submit();
});}
let activePrompt;
function prompt(){if(activePrompt)return activePrompt;activePrompt=new Promise((resolve,reject)=>{
 const dialog=document.createElement('dialog');dialog.className='staff-pin-dialog';dialog.setAttribute('aria-labelledby','staff-pin-title');
 dialog.innerHTML='<form class="staff-pin-form"><div class="staff-pin-brand">JWC</div><h2 id="staff-pin-title">Staff sign-in</h2><p>Enter your code once to get started.</p><label for="staff-pin-input">4-digit staff code</label><input id="staff-pin-input" name="staffPin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required><p class="staff-pin-status" role="status" aria-live="polite"></p><button type="submit">Unlock</button><button type="button" class="staff-pin-cancel">Back</button></form>';
 document.body.append(dialog);const form=dialog.querySelector('form'),input=dialog.querySelector('input'),status=dialog.querySelector('[role=status]'),button=dialog.querySelector('[type=submit]');
 const previous=document.activeElement;
 const nativeDialog=typeof dialog.showModal==='function';
 let overlay,closed=false;const controller=new AbortController();
 function cancel(){close(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));}
 function fallbackKeys(event){
   if(event.key==='Escape'){event.preventDefault();cancel();return;}
   if(event.key==='Tab'){
     const controls=Array.from(dialog.querySelectorAll('input,button')).filter(el=>!el.disabled);
     const first=controls[0],last=controls[controls.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
 }
 function close(error){if(closed)return;closed=true;controller.abort();input.value='';if(nativeDialog)dialog.close();dialog.remove();if(overlay)overlay.remove();document.removeEventListener('keydown',fallbackKeys,true);activePrompt=null;if(previous&&previous.isConnected)previous.focus({preventScroll:true});if(error)reject(error);else resolve(true);}
 form.onsubmit=async event=>{
  event.preventDefault();if(button.disabled||closed||!form.reportValidity())return;
  const pin=input.value;input.value='';input.disabled=true;button.disabled=true;button.textContent='Signing in…';status.textContent='';
  try{const result=await request('auth',{pin,deviceId:deviceId()},controller.signal);if(closed)return;if(!validSession(result.session))throw new Error('Sign-in could not be confirmed. Please try again.');remember(result.session);close();}
  catch(error){if(!closed){status.textContent=error.message;input.disabled=false;input.focus();}}
  finally{if(!closed){input.disabled=false;button.disabled=false;button.textContent='Unlock';}}
 };
 dialog.querySelector('.staff-pin-cancel').onclick=()=>close(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));dialog.addEventListener('cancel',event=>{event.preventDefault();close(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));});
 if(nativeDialog)dialog.showModal();
 else{
   overlay=document.createElement('div');overlay.className='staff-pin-overlay';
   dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('open','');
   overlay.append(dialog);document.body.append(overlay);document.addEventListener('keydown',fallbackKeys,true);
 }
 input.focus();
});return activePrompt;}
// The server validates every write. A current local session opens forms immediately.
async function requireAccess(){if(!enabled()||getToken())return true;return prompt();}
window.JWCStaffAccess={enabled,getToken,require:requireAccess,forget};
const style=document.createElement('style');style.textContent=`
.staff-pin-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:#05070bd9;padding:16px}
.staff-pin-overlay .staff-pin-dialog{display:block;position:relative;margin:0;overflow-y:auto}
.staff-pin-dialog{box-sizing:border-box;width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);padding:28px 24px 18px;border:1px solid #343e4b;border-radius:20px;background:#11171f;color:#edf1f6;box-shadow:0 24px 80px #0008;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}
.staff-pin-dialog:not([open]){display:none}.staff-pin-dialog::backdrop{background:#05070bd9}
.staff-pin-dialog .staff-pin-brand{color:#bbc7d7;font-size:13px;font-weight:800;letter-spacing:.2em;margin-bottom:18px}
.staff-pin-dialog h2{font-size:25px;letter-spacing:-.03em;line-height:1.2;margin:0 0 8px;color:#f1f4f8}
.staff-pin-dialog p{font-size:14px;line-height:1.5;color:#aab8c9;margin:0 0 24px}
.staff-pin-dialog label{display:block;font-size:13px;font-weight:600;color:#c2cddd;margin:0 0 8px}
.staff-pin-dialog input{box-sizing:border-box;display:block;width:100%;min-height:60px;padding:12px;border:1px solid #566579;border-radius:10px;background:#1b2430;color:#fff;font:26px system-ui;text-align:center;letter-spacing:.4em}
.staff-pin-dialog button{display:block;width:100%;min-height:50px;margin-top:16px;border:0;border-radius:10px;font:700 16px system-ui;background:#e0e7f0;color:#11171f;cursor:pointer}
.staff-pin-dialog button:disabled{opacity:.65;cursor:wait}.staff-pin-dialog .staff-pin-cancel{margin-top:4px;min-height:44px;background:transparent;color:#b1bfd0}
.staff-pin-dialog .staff-pin-status{margin:12px 0 0;color:#ffb8b8}.staff-pin-dialog .staff-pin-status:empty{display:none}
.staff-pin-dialog input:focus-visible,.staff-pin-dialog button:focus-visible{outline:2px solid #d7e2f1;outline-offset:3px}
`;document.head.append(style);
})();
