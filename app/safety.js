/* Basic FLHA and toolbox records with drawn crew signatures. */
const $=id=>document.getElementById(id),form=$('safety-form');
const kind=new URLSearchParams(location.search).get('view')==='toolbox'?'toolbox':'flha';
const title=kind==='toolbox'?'Toolbox meeting':'FLHA',key='jwc-safety-'+kind+'-draft';
const fields=['date','time','site','job','leader','hazards','controls','notes'];
let recordId=window.JWCUuid(),crew=[],pdfUrl,submitting=false;
$('app-screen-title').textContent=title;document.title='JWC · '+title;
document.querySelector('[data-kind='+kind+']').setAttribute('aria-current','page');
$('intro').textContent=kind==='toolbox'?'A short pre-job crew discussion. Record what you covered, any actions, and who attended.':'Field Level Hazard Assessment · Review the job, identify the hazards, and agree on controls before starting.';
if(kind==='toolbox'){$('discussion-heading').textContent='Meeting discussion';$('hazards-label').textContent='Topics / hazards discussed';$('controls-label').textContent='Agreed actions / controls / person responsible';$('notes-label').textContent='Other notes / emergency reminders';}
else{$('hazards').placeholder='Traffic / backing, pinch points, ground conditions, overhead lines, H₂S, weather…';$('controls').placeholder='How will you control the hazards? Include PPE, spotters, isolation or permits where needed.';}
function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');}
function collect(){return {id:recordId,kind,...Object.fromEntries(fields.map(id=>[id,$(id).value.trim()])),acknowledged:$('acknowledged').checked,crew:crew.map(person=>({name:person.name.value.trim(),signature:person.signature,signedAt:person.signedAt}))};}
function save(){try{localStorage.setItem(key,JSON.stringify(collect()));return true;}catch{$('status').textContent='Device backup unavailable. Keep this form open; submission needs a saved backup.';return false;}}
function addPerson(saved={}){
 if(crew.length>=8)return;
 const card=document.createElement('section');card.className='crew-card';
 const nameLabel=document.createElement('label'),name=document.createElement('input');name.id='crew-'+window.JWCUuid();name.required=true;name.maxLength=120;name.autocomplete='name';name.value=saved.name||'';nameLabel.htmlFor=name.id;nameLabel.textContent='Crew member name';
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=144;canvas.className='signature-pad';canvas.setAttribute('aria-label','Draw signature for crew member');
 const state=document.createElement('p');state.className='signature-state';state.setAttribute('aria-live','polite');
 const actions=document.createElement('div');actions.className='signature-actions';
 const clear=document.createElement('button'),remove=document.createElement('button');clear.type=remove.type='button';clear.textContent='Clear signature';remove.textContent='Remove person';actions.append(clear,remove);
 card.append(nameLabel,name,canvas,state,actions);$('crew').append(card);
 const ctx=canvas.getContext('2d'),person={card,name,canvas,signature:'',signedAt:'',clear:clearSignature};let drawing=false,moved=false,lastPoint=null;
 function paintBlank(){ctx.fillStyle='#fff';ctx.fillRect(0,0,480,144);ctx.strokeStyle='#111';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';}
 function clearSignature(){drawing=false;person.signature='';person.signedAt='';paintBlank();state.textContent='Sign in the white box.';}
 clearSignature();crew.push(person);
 if(typeof saved.signature==='string'&&/^data:image\/png;base64,/.test(saved.signature)&&saved.signature.length<=24000){person.signature=saved.signature;person.signedAt=saved.signedAt||'';const image=new Image();image.onload=()=>{if(person.signature===saved.signature){ctx.drawImage(image,0,0,480,144);state.textContent='Saved signature restored.';}};image.src=saved.signature;}
 function point(event){const bounds=canvas.getBoundingClientRect();return{x:(event.clientX-bounds.left)*480/bounds.width,y:(event.clientY-bounds.top)*144/bounds.height};}
 canvas.addEventListener('pointerdown',event=>{if(submitting||event.button!==0||drawing)return;event.preventDefault();person.signature='';person.signedAt='';drawing=true;moved=false;lastPoint=point(event);canvas.setPointerCapture(event.pointerId);});
 canvas.addEventListener('pointermove',event=>{if(!drawing||submitting)return;const next=point(event);if(Math.hypot(next.x-lastPoint.x,next.y-lastPoint.y)<1)return;ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(next.x,next.y);ctx.stroke();lastPoint=next;moved=true;});
 function finish(){if(!drawing)return;drawing=false;if(moved){person.signature=canvas.toDataURL('image/png');person.signedAt=new Date().toISOString();state.textContent='Signature captured.';save();}}
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',()=>{if(drawing){clearSignature();save();}});
 clear.onclick=()=>{clearSignature();save();};remove.onclick=()=>{if(crew.length===1){$('status').textContent='At least one crew member is required.';return;}crew=crew.filter(p=>p!==person);card.remove();$('add-person').disabled=false;save();};
 name.addEventListener('input',()=>{clearSignature();save();});$('add-person').disabled=crew.length>=8;
}
$('add-person').onclick=()=>{addPerson();save();};
for(const id of fields)$(id).addEventListener('input',()=>{const signed=crew.some(p=>p.signature);if(signed){crew.forEach(p=>p.clear());$('acknowledged').checked=false;$('status').textContent='Details changed. Please review and sign again.';}save();});
$('acknowledged').addEventListener('change',save);
$('date').value=today();
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&saved.kind===kind){recordId=saved.id||recordId;for(const id of fields)$(id).value=saved[id]||'';$('acknowledged').checked=saved.acknowledged===true;if(Array.isArray(saved.crew))saved.crew.slice(0,8).forEach(addPerson);$('status').textContent='Saved draft restored.';}}catch{}
if(!crew.length)addPerson();
function deliver(data){return new Promise((resolve,reject)=>{
 const requestId=window.JWCUuid(),frame=document.createElement('iframe'),post=document.createElement('form'),input=document.createElement('input');frame.hidden=true;frame.name='safety-'+requestId;post.hidden=true;post.method='POST';post.action='https://script.google.com/macros/s/AKfycbyDBmkP_GMn8KjuI9stjkN04sVdd_vrVAqoH8Gv0gDElMG8KQkGvUVsDoJ4-oj7vcRfCg/exec';post.target=frame.name;input.name='packet';input.value=JSON.stringify({kind:'safety',payload:data,requestId,origin:location.origin,sessionToken:window.JWCStaffAccess?.getToken()});post.append(input);
 const timer=setTimeout(()=>finish(new Error('Confirmation timed out. Draft kept. Retry with the same report to check delivery.')),60000);
 function cleanup(){clearTimeout(timer);window.top.removeEventListener('message',message);window.removeEventListener('pagehide',cleanup);post.remove();frame.remove();}
 function finish(error,result){cleanup();error?reject(error):resolve(result);}
 function message(event){if(event.origin!=='https://script.google.com'&&!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;const result=event.data;if(result?.type!=='JWC_SUBMISSION_RESULT'||result.requestId!==requestId||result.id!==data.id)return;if(result.ok===true&&result.safetyPdfEmailed===true&&typeof result.pdfBase64==='string')finish(null,result);else finish(Object.assign(new Error(result.message||'PDF delivery was not confirmed. The Google backend may need its update deployed. Draft kept.'),{code:result.code}));}
 window.top.addEventListener('message',message);window.addEventListener('pagehide',cleanup);document.body.append(frame,post);post.submit();
});}
form.onsubmit=async event=>{
 event.preventDefault();if(submitting||!form.reportValidity())return;
 if(crew.some(p=>!p.signature||!p.signedAt)){$('status').textContent='Each listed crew member must sign the white box.';return;}
 const data=collect();if(!save())return;
 if(data.crew.some(p=>p.signature.length>24000)){$('status').textContent='A signature is too large. Clear it and sign again.';return;}
 if(!navigator.onLine){$('status').textContent='Offline. Your form and signatures are saved. Submit when connected.';return;}
 submitting=true;const button=form.querySelector('[type=submit]');button.disabled=true;form.querySelectorAll('fieldset').forEach(f=>f.disabled=true);$('status').textContent='Creating signed PDF and emailing dispach@jwchauling.com…';
 try{const result=await deliver(data);const bytes=Uint8Array.from(atob(result.pdfBase64),c=>c.charCodeAt(0));if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('download').href=pdfUrl;$('download').download=result.pdfFilename||'JWC-safety.pdf';$('download').hidden=false;
 try{localStorage.removeItem(key);}catch{}form.reset();$('date').value=today();crew=[];$('crew').replaceChildren();recordId=window.JWCUuid();addPerson();$('status').textContent='Signed PDF emailed to dispach@jwchauling.com. Download your copy below.';$('download').scrollIntoView({block:'center'});
 }catch(error){$('status').textContent=error.message;if(error.code==='PIN_REQUIRED'&&!JWCStaffAccess.enabled()){$('status').textContent='The Google script needs the app-without-PIN update deployed. Your form is kept here.';}else if(error.code==='PIN_REQUIRED'){JWCStaffAccess.forget();await JWCStaffAccess.require().catch(()=>{});}}
 finally{submitting=false;button.disabled=false;form.querySelectorAll('fieldset').forEach(f=>f.disabled=false);}
};
if(window.parent!==window){document.body.classList.add('is-embedded');document.querySelector('.form-back').onclick=event=>{event.preventDefault();window.parent.postMessage({type:'JWC_CLOSE_FORM'},location.origin);};}
function unlock(){document.querySelector('main').inert=false;form.querySelectorAll('fieldset').forEach(f=>f.disabled=false);}
if(window.JWCStaffAccess?.enabled())JWCStaffAccess.require().then(unlock).catch(()=>{$('status').textContent='Unlock with your staff PIN to continue.';});else unlock();
