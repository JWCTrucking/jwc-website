(()=>{
const enabled=()=>window.JWC_ACCESS_CONFIG?.enabled===true;
const endpoint='https://script.google.com/macros/s/AKfycbxow0m-w5V3EntTTTdUQ6K2gQnUlPUaMWI_8qb3CrqeOZL5PcTqMjMsvWgmULSg-qDQqg/exec';
const storageKey='jwc-staff-session';let current;
try{current=JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{}
function getToken(){return current&&current.expiresAt>Date.now()?current.token:null;}
function forget(){current=null;try{sessionStorage.removeItem(storageKey);}catch{}}
function deviceId(){try{let id=localStorage.getItem('jwc-staff-device');if(!id){id=crypto.randomUUID();localStorage.setItem('jwc-staff-device',id);}return id;}catch{return crypto.randomUUID();}}
function request(kind,payload){return new Promise((resolve,reject)=>{
 const requestId=crypto.randomUUID(),id=crypto.randomUUID();const frame=document.createElement('iframe');frame.hidden=true;frame.name='jwc-access-'+requestId;frame.title='Staff access confirmation';
 const form=document.createElement('form');form.hidden=true;form.method='POST';form.action=endpoint;form.target=frame.name;
 const input=document.createElement('input');input.name='packet';input.type='hidden';input.value=JSON.stringify({kind,requestId,origin:location.origin,sessionToken:getToken(),payload:{...payload,id}});form.append(input);
 const topWindow=window.top;
 const timeout=setTimeout(()=>finish(Object.assign(new Error('Could not check the PIN. Check cell service or Wi-Fi, then try again.'),{code:'CONNECTION_FAILED'})),45000);
 function cleanup(){clearTimeout(timeout);topWindow.removeEventListener('message',receive);form.remove();frame.remove();}
 function finish(error,result){cleanup();if(error)reject(error);else resolve(result);}
 function receive(event){if(event.origin!=='https://script.google.com'&&!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;const result=event.data;if(!result||result.type!=='JWC_SUBMISSION_RESULT'||result.requestId!==requestId||result.id!==id)return;if(result.ok&&result.staffPinAccess===true)finish(null,result);else finish(Object.assign(new Error(result.message||'Staff access needs its Google deployment update.'),{code:result.code||'ACCESS_UNAVAILABLE'}));}
 topWindow.addEventListener('message',receive);document.body.append(frame,form);form.submit();
});}
let activePrompt;
function prompt(){if(activePrompt)return activePrompt;activePrompt=new Promise((resolve,reject)=>{
 const dialog=document.createElement('dialog');dialog.className='staff-pin-dialog';dialog.setAttribute('aria-labelledby','staff-pin-title');
 dialog.innerHTML='<form class="staff-pin-form"><h2 id="staff-pin-title">Staff access</h2><p>Enter your four-digit PIN.</p><label for="staff-pin-input">Staff PIN</label><input id="staff-pin-input" name="staffPin" type="password" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" required><p class="staff-pin-status" role="status" aria-live="polite"></p><button type="submit">Unlock</button><button type="button" class="staff-pin-cancel">Back</button></form>';
 document.body.append(dialog);const form=dialog.querySelector('form'),input=dialog.querySelector('input'),status=dialog.querySelector('[role=status]'),button=dialog.querySelector('[type=submit]');
 const previous=document.activeElement;
 function close(error){input.value='';dialog.close();dialog.remove();activePrompt=null;if(previous&&previous.isConnected)previous.focus({preventScroll:true});if(error)reject(error);else resolve(true);}
 form.onsubmit=async event=>{event.preventDefault();if(button.disabled)return;button.disabled=true;button.textContent='Checking…';status.textContent='';const pin=input.value;input.value='';try{const result=await request('auth',{pin,deviceId:deviceId()});if(!result.session?.token||!result.session.expiresAt)throw new Error('The access update is not ready. Contact dispatch.');current=result.session;try{sessionStorage.setItem(storageKey,JSON.stringify(current));}catch{}close();}catch(error){status.textContent=error.message;input.focus();}finally{button.disabled=false;button.textContent='Unlock';}};
 dialog.querySelector('.staff-pin-cancel').onclick=()=>close(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));dialog.addEventListener('cancel',event=>{event.preventDefault();close(Object.assign(new Error('Access cancelled.'),{code:'CANCELLED'}));});
 dialog.showModal();input.focus();
});return activePrompt;}
async function requireAccess(){if(!enabled())return true;if(getToken()){try{await request('session',{});return true;}catch(error){forget();if(error.code==='CONNECTION_FAILED')throw error;}}return prompt();}
window.JWCStaffAccess={enabled,getToken,require:requireAccess,forget};
const style=document.createElement('style');style.textContent='.staff-pin-dialog{width:min(360px,calc(100vw - 32px));padding:26px;border:1px solid #778290;border-radius:16px;background:#11161d;color:#edf1f6;box-shadow:0 20px 80px #0009;font-family:system-ui}.staff-pin-dialog::backdrop{background:#05070be6;backdrop-filter:blur(8px)}.staff-pin-dialog h2{font-size:24px;margin:0 0 8px}.staff-pin-dialog p{font-size:14px;line-height:1.5;color:#bdc6d3}.staff-pin-dialog label{display:block;font-size:14px;margin:16px 0 8px}.staff-pin-dialog input{width:100%;min-height:60px;border:1px solid #8490a0;border-radius:8px;background:#202834;color:#fff;font:24px system-ui;text-align:center;letter-spacing:.5em}.staff-pin-dialog button{display:block;width:100%;min-height:48px;margin-top:14px;border:0;border-radius:8px;font:700 16px system-ui;background:linear-gradient(120deg,#9da7b5,#f4f6f9,#9da7b5);color:#11161d}.staff-pin-dialog .staff-pin-cancel{background:transparent;color:#c8d0dc}.staff-pin-dialog .staff-pin-status{margin:12px 0 0;min-height:0;color:#f0c8c8}.staff-pin-dialog input:focus-visible,.staff-pin-dialog button:focus-visible{outline:2px solid white;outline-offset:3px}';document.head.append(style);
})();
