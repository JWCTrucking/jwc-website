/* Alberta daily inspection. Drafts survive failures; only explicit PDF/email acknowledgment completes submission. */
const $=id=>document.getElementById(id);
const form=$('pretrip-form'), key='jwc-pretrip-draft';
let recordId=window.JWCUuid(),pdfUrl;
JWC_PRETRIP_ITEMS.forEach((name,i)=>{
 const item=document.createElement('section');item.className='inspection';
 const heading=document.createElement('h3');heading.textContent=(i+1)+'. '+name;item.append(heading);
 const grid=document.createElement('div');grid.className='grid';
 for(const unit of ['tractor','trailer']){
  const box=document.createElement('div'),title=document.createElement('div'),choices=document.createElement('div');
  title.id=unit+'-'+i+'-label';title.className='field-label';title.textContent=unit==='tractor'?'Tractor':'Trailer';
  choices.className='result-choices';choices.setAttribute('role','radiogroup');choices.setAttribute('aria-labelledby',title.id);
  for(const [value,text]of [['ok','No defect'],['minor','Minor defect'],['major','Major defect'],['na','N/A']]){
   const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=unit+'-'+i;input.id=unit+'-'+i+'-'+value;input.value=value;input.required=true;
   label.append(input,document.createTextNode(text));choices.append(label);
  }
  box.append(title,choices);grid.append(box);
 }
 const label=document.createElement('label');label.htmlFor='details-'+i;label.textContent='Defect details / reason for N/A';const details=document.createElement('textarea');details.id=label.htmlFor;details.maxLength=500;item.append(grid,label,details);$('items').append(item);
});
function result(unit,i){return form.querySelector('input[name="'+unit+'-'+i+'"]:checked')?.value||'';}
function collect(){const data={id:recordId};for(const input of form.querySelectorAll('input:not([type=radio]),textarea'))if(!/details-/.test(input.id))data[input.id]=input.type==='checkbox'?input.checked:input.value.trim();data.items=JWC_PRETRIP_ITEMS.map((name,i)=>({tractor:result('tractor',i),trailer:result('trailer',i),details:$('details-'+i).value.trim()}));return data;}
function update(){let major=false;JWC_PRETRIP_ITEMS.forEach((_,i)=>{const states=[result('tractor',i),result('trailer',i)];$('details-'+i).required=states.some(s=>['minor','major','na'].includes(s));if(states.includes('major'))major=true;});$('defect-warning').textContent=major?'MAJOR DEFECT — DO NOT OPERATE. Notify the carrier immediately. You can submit this defect report.':'';}
function save(){update();try{localStorage.setItem(key,JSON.stringify(collect()));}catch{$('status').textContent='Device backup unavailable. Keep this form open until submission is confirmed.';}}
const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
$('date').value=['year','month','day'].map(type=>dateParts.find(p=>p.type===type).value).join('-');
try{const data=JSON.parse(localStorage.getItem(key)||'null');if(data){recordId=data.id||recordId;for(const [id,value]of Object.entries(data)){const field=$(id);if(field&&field.matches('input,textarea')){if(field.type==='checkbox')field.checked=value===true;else field.value=value;}}data.items?.forEach((item,i)=>{if(i<JWC_PRETRIP_ITEMS.length){$('details-'+i).value=item.details||'';for(const unit of ['tractor','trailer']){const choice=$(unit+'-'+i+'-'+item[unit]);if(choice)choice.checked=true;}}});$('status').textContent='Saved draft restored.';}}catch{}
update();form.addEventListener('input',save);form.addEventListener('change',save);
function deliver(data){return new Promise((resolve,reject)=>{
 const requestId=window.JWCUuid(),frame=document.createElement('iframe'),post=document.createElement('form'),input=document.createElement('input');frame.hidden=true;frame.name='pretrip-'+requestId;post.hidden=true;post.method='POST';post.action='https://script.google.com/macros/s/AKfycbyDBmkP_GMn8KjuI9stjkN04sVdd_vrVAqoH8Gv0gDElMG8KQkGvUVsDoJ4-oj7vcRfCg/exec';post.target=frame.name;input.name='packet';input.value=JSON.stringify({kind:'pretrip',payload:data,requestId,origin:location.origin,sessionToken:window.JWCStaffAccess?.getToken()});post.append(input);
 const timer=setTimeout(()=>finish(new Error('Confirmation timed out. Draft kept. Retry with the same report to check delivery.')),60000);
 function cleanup(){clearTimeout(timer);window.top.removeEventListener('message',message);window.removeEventListener('pagehide',cleanup);post.remove();frame.remove();}
 function finish(error,result){cleanup();error?reject(error):resolve(result);}
 function message(event){if(event.origin!=='https://script.google.com'&&!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;const result=event.data;if(result?.type!=='JWC_SUBMISSION_RESULT'||result.requestId!==requestId||result.id!==data.id)return;if(result.ok===true&&result.pretripPdfEmailed===true&&typeof result.pdfBase64==='string')finish(null,result);else finish(Object.assign(new Error(result.message||'PDF delivery was not confirmed. The Google backend may need its update deployed. Draft kept.'),{code:result.code}));}
 window.top.addEventListener('message',message);window.addEventListener('pagehide',cleanup);document.body.append(frame,post);post.submit();
});}
form.onsubmit=async event=>{event.preventDefault();update();if(!form.reportValidity())return;const data=collect(),button=form.querySelector('button');try{localStorage.setItem(key,JSON.stringify(data));}catch{$('status').textContent='Cannot back up this report on the device. Submission paused.';return;}if(!navigator.onLine){$('status').textContent='Offline. Draft saved. Submit when connected.';return;}button.disabled=true;form.querySelectorAll('fieldset').forEach(f=>f.disabled=true);$('status').textContent='Creating PDF and emailing dispach@jwchauling.com… Keep this screen open.';
 try{const result=await deliver(data);const bytes=Uint8Array.from(atob(result.pdfBase64),c=>c.charCodeAt(0));if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('download').href=pdfUrl;$('download').download=result.pdfFilename||'JWC-pretrip.pdf';$('download').hidden=false;try{localStorage.removeItem(key);}catch{}form.reset();$('date').value=['year','month','day'].map(type=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Edmonton',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).find(p=>p.type===type).value).join('-');recordId=window.JWCUuid();$('status').textContent='PDF emailed to dispach@jwchauling.com. Download your copy below; keep it available in the vehicle.';$('download').scrollIntoView({block:'center'});}
 catch(error){$('status').textContent=error.message;if(error.code==='PIN_REQUIRED'&&!JWCStaffAccess.enabled()){$('status').textContent='The Google script needs the app-without-PIN update deployed. Your form is kept here.';}else if(error.code==='PIN_REQUIRED'){JWCStaffAccess.forget();await JWCStaffAccess.require().catch(()=>{});}}
 finally{button.disabled=false;form.querySelectorAll('fieldset').forEach(f=>f.disabled=false);update();}
};
if(window.parent!==window){document.body.classList.add('is-embedded');document.querySelector('.form-back').onclick=e=>{e.preventDefault();window.parent.postMessage({type:'JWC_CLOSE_FORM'},location.origin);};}
function unlock(){document.querySelector('main').inert=false;form.querySelectorAll('fieldset').forEach(f=>f.disabled=false);}
if(window.JWCStaffAccess?.enabled())JWCStaffAccess.require().then(unlock).catch(()=>{$('status').textContent='Unlock with your staff PIN to continue.';});else unlock();
