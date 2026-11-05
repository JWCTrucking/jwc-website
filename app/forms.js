/* JWC-owned forms. Google runs only the submission endpoint in a hidden response frame. */
const SUBMISSION_URL='https://script.google.com/macros/s/AKfycbxow0m-w5V3EntTTTdUQ6K2gQnUlPUaMWI_8qb3CrqeOZL5PcTqMjMsvWgmULSg-qDQqg/exec';
const $=id=>document.getElementById(id);
const pending={ticket:null,maintenance:null};
const cleanupRequests=new Set();
window.addEventListener('pagehide',()=>{for(const cleanup of cleanupRequests)cleanup();});
const ticketFields=['date','customer','job','truck','driver','hours','work','hourlyRate','permitRate'];
function syncPermitField(){ $('permit-rate-field').hidden=!$('permits').checked;$('permitRate').disabled=!$('permits').checked;if(!$('permits').checked)$('permitRate').value=''; }
$('permits').addEventListener('change',syncPermitField);
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function showView(view){const maintenance=view==='maintenance';$('app-screen-title').textContent=maintenance?'Maintenance':'Field ticket';$('ticket-view').hidden=maintenance;$('maintenance-view').hidden=!maintenance;document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===(maintenance?'maintenance':'tickets'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});window.scrollTo(0,0);}
document.querySelectorAll('[data-view]').forEach(a=>a.onclick=e=>{e.preventDefault();showView(a.dataset.view);});
function payload(kind){if(kind==='maintenance')return {date:$('service-date').value,truck:$('service-truck').value.trim(),service:$('service-type').value,performedBy:$('service-person').value.trim(),odometer:$('service-odometer').value,work:$('service-work').value.trim()};const data={};ticketFields.forEach(k=>data[k]=$(k).value);['jeep','booster','tridem','permits'].forEach(k=>data[k]=$(k).checked);return data;}
function sendPacket(kind,data){return new Promise((resolve,reject)=>{
  const messageWindow=window.top;
  const requestId=crypto.randomUUID();const frame=document.createElement('iframe');frame.name='jwc-response-'+requestId;frame.hidden=true;frame.title='Submission confirmation';
  const form=document.createElement('form');form.hidden=true;form.method='POST';form.action=SUBMISSION_URL;form.target=frame.name;
  const input=document.createElement('input');input.type='hidden';input.name='packet';input.value=JSON.stringify({kind,payload:data,requestId,origin:location.origin});form.append(input);
  const timer=setTimeout(()=>finish(new Error('No confirmation received. Your entry is saved here. Check your connection, then tap Submit to retry.')),45000);
  function cleanup(){clearTimeout(timer);messageWindow.removeEventListener('message',message);form.remove();frame.remove();cleanupRequests.delete(cleanup);}
  cleanupRequests.add(cleanup);
  function finish(error){cleanup();if(error)reject(error);else resolve();}
  function message(event){let host;try{host=new URL(event.origin).hostname;}catch{return;}if(event.origin!=='https://script.google.com' && !/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;const result=event.data;if(!result||result.type!=='JWC_SUBMISSION_RESULT'||result.requestId!==requestId||result.id!==data.id)return;if(result.ok===true){if(kind==='ticket'&&(data.permits===true||data.hourlyRate!==''&&data.hourlyRate!=null||data.permitRate!==''&&data.permitRate!=null)&&result.ticketRatesPermits!==true){finish(new Error('Ticket details reached Sheets, but rates and permits were not confirmed. The Google app needs its new version deployed. Your entry is kept here; tap Submit again after the update.'));return;}finish();}else finish(new Error(result.message||'Not submitted. Your form has been kept. Tap Submit to retry.'));}
  messageWindow.addEventListener('message',message);document.body.append(frame,form);form.submit();
});}
function controls(kind){return kind==='ticket'?{form:$('form'),status:$('status'),date:$('date')}:{form:$('maintenance-form'),status:$('maintenance-status'),date:$('service-date')};}
async function submit(kind){
  const view=controls(kind),button=view.form.querySelector('[type=submit]');if(button.disabled)return;
  const data={...payload(kind),id:pending[kind]||crypto.randomUUID()};
  if(kind==='maintenance'&&(!data.truck||!data.work||!data.performedBy)){view.status.textContent='Enter the truck, work done, and who did it.';return;}
  if(kind==='ticket'&&!data.driver.trim()){view.status.textContent='Enter the driver name.';return;}
  try{localStorage.setItem('jwc-form-'+kind+'-draft',JSON.stringify(data));pending[kind]=data.id;}catch{view.status.textContent='Could not keep a backup on this device. Your form has not been cleared.';return;}
  if(!navigator.onLine){view.status.textContent='No service. Your form is saved here. Tap Submit when service returns.';return;}
  button.disabled=true;button.textContent='Submitting…';view.form.querySelectorAll('fieldset').forEach(e=>e.disabled=true);view.status.textContent='Sending… Please keep this screen open.';
  try{await sendPacket(kind,data);try{localStorage.removeItem('jwc-form-'+kind+'-draft');}catch{}pending[kind]=null;view.form.reset();if(kind==='ticket')syncPermitField();view.date.value=today();window.scrollTo(0,0);view.status.textContent=kind==='maintenance'?'Maintenance submitted to Google Sheets.':'Ticket submitted to Google Sheets.';}
  catch(error){view.status.textContent=error.message;}
  finally{button.disabled=false;button.textContent='Submit';view.form.querySelectorAll('fieldset').forEach(e=>e.disabled=false);}
}
$('form').onsubmit=e=>{e.preventDefault();void submit('ticket');};$('maintenance-form').onsubmit=e=>{e.preventDefault();void submit('maintenance');};
for(const kind of ['ticket','maintenance']){
  const view=controls(kind);view.date.value=today();
  try{const saved=JSON.parse(localStorage.getItem('jwc-form-'+kind+'-draft')||'null');if(saved){pending[kind]=saved.id;if(kind==='ticket'){ticketFields.forEach(k=>$(k).value=saved[k]??'');['jeep','booster','tridem','permits'].forEach(k=>$(k).checked=!!saved[k]);}else for(const [field,id]of Object.entries({date:'service-date',truck:'service-truck',service:'service-type',performedBy:'service-person',odometer:'service-odometer',work:'service-work'}))$(id).value=saved[field]??'';view.status.textContent='Your unsent entry was restored. Tap Submit to retry.';}}catch{}
}
syncPermitField();
showView(new URLSearchParams(location.search).get('view'));

if(window.parent!==window){document.body.classList.add('is-embedded');document.querySelector('.form-back').addEventListener('click',event=>{event.preventDefault();window.parent.postMessage({type:'JWC_CLOSE_FORM'},location.origin);});}
