/* Offline-first phone app. Auth tokens stay in memory; queued work stays in IndexedDB. */
const config=window.JWC_APP_CONFIG||{};
const $=id=>document.getElementById(id);
const ticketFields=['date','customer','job','truck','driver','hours','work'];
let dbPromise,token='',expires=0,busy=false,retryTimer;
const authButton=$('connect-google');
function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('jwc-field-app',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('outbox',{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  return dbPromise;
}
async function records(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('outbox');const r=tx.objectStore('outbox').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>a.created-b.created));r.onerror=()=>reject(r.error);});}
async function changeRecord(method,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('outbox','readwrite');tx.objectStore('outbox')[method](value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage transaction was cancelled'));});}
const status=text=>$('sync-status').textContent=text;
async function refreshCount(){try{const count=(await records()).length;$('queue-count').textContent=count?`${count} waiting to send — saved on this device`:'No submissions waiting';return count;}catch{status('Device storage is unavailable. Keep your form open; nothing has been submitted.');return 0;}}
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function showView(view){const maintenance=view==='maintenance';$('ticket-view').hidden=maintenance;$('maintenance-view').hidden=!maintenance;document.querySelectorAll('[data-view]').forEach(link=>{if(link.dataset.view===(maintenance?'maintenance':'tickets'))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});window.scrollTo(0,0);}
document.querySelectorAll('[data-view]').forEach(link=>link.onclick=event=>{event.preventDefault();showView(link.dataset.view);});
function resetForm(form,dateId){form.reset();$(dateId).value=today();}
async function enqueue(kind,payload,form,statusElement,dateId){
  const button=form.querySelector('[type=submit]');if(button.disabled)return;
  button.disabled=true;button.textContent='Saving…';
  try{
    const id=crypto.randomUUID();
    await changeRecord('put',{id,kind,payload:{...payload,id},created:Date.now()});
    resetForm(form,dateId);
    statusElement.textContent=navigator.onLine?'Saved on this device. Waiting to send.':'Saved on this device. Will retry when service returns.';
    await refreshCount();void synchronize();
  }catch{statusElement.textContent='Could not save on this device. Your form has been kept. Please try again.';}
  finally{button.disabled=false;button.textContent='Submit';}
}
$('form').onsubmit=event=>{event.preventDefault();const payload={};ticketFields.forEach(field=>payload[field]=$(field).value);['jeep','booster','tridem'].forEach(field=>payload[field]=$(field).checked);void enqueue('ticket',payload,$('form'),$('status'),'date');};
$('maintenance-form').onsubmit=event=>{event.preventDefault();const payload={date:$('service-date').value,truck:$('service-truck').value.trim(),service:$('service-type').value,performedBy:$('service-person').value.trim(),odometer:$('service-odometer').value,work:$('service-work').value.trim()};if(!payload.truck||!payload.performedBy||!payload.work){$('maintenance-status').textContent='Enter the truck, who did the work, and the work done.';return;}void enqueue('maintenance',payload,$('maintenance-form'),$('maintenance-status'),'service-date');};
async function api(path,method='GET',body){
  if(!token||Date.now()>=expires){const error=new Error('Google sign-in is required. Saved submissions are still queued.');error.auth=true;throw error;}
  const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.spreadsheetId)+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(response.status===401){token='';expires=0;authButton.textContent='Connect Google';const error=new Error('Google sign-in expired. Tap Connect Google; your submissions are still saved.');error.auth=true;throw error;}
  if(!response.ok){let message;try{message=(await response.json()).error?.message;}catch{}const error=new Error(response.status===403?'This Google account needs permission to edit the JWC spreadsheet. Submissions remain queued.':message||'Google Sheets did not confirm the submission. It remains queued.');error.permission=response.status===403;throw error;}
  return response.json();
}
const rangePath=range=>'/values/'+encodeURIComponent(range);
async function readValues(range){return (await api(rangePath(range)+'?valueRenderOption=FORMULA')).values||[];}
async function write(range,values,option='RAW'){return api(rangePath(range)+'?valueInputOption='+option,'PUT',{range,majorDimension:'ROWS',values});}
async function append(range,values){const response=await api(rangePath(range)+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{values:[values]});const match=response.updates?.updatedRange?.match(/![A-Z]+(\d+):/);if(!match)throw new Error('Google did not confirm the inserted row. It remains queued for verification.');return Number(match[1]);}
async function sendTicket(t){
  const values=await readValues("'Ticket Log'!A:Q");
  if(values[0]?.[0]!=='Ticket ID')throw new Error('Ticket Log was not found or its columns changed. Submissions remain queued.');
  const index=values.findIndex((row,i)=>i>0&&String(row[0])===t.id);
  const existing=index>=0?values[index]:null;
  const now=new Date().toISOString();
  const cells=[t.id,existing?.[1]||now,t.date,t.customer,t.job,t.truck,t.driver,Number(t.hours),!!t.jeep,!!t.booster,!!t.tridem,t.work,now];
  let row;
  if(existing){row=index+1;await write(`'Ticket Log'!A${row}:M${row}`,[cells]);}
  else row=await append("'Ticket Log'!A:Q",cells);
  // Recover an append interrupted before billing formulas were initialized; never replace manual billing inputs.
  if(!existing || ((existing[13]===undefined||existing[13]==='')&&(existing[15]===undefined||existing[15]==='')))await write(`'Ticket Log'!N${row}`,[[`=H${row}`]],'USER_ENTERED');
  await write(`'Ticket Log'!P${row}`,[[`=IF(OR(N${row}="",O${row}=""),"",N${row}*O${row})`]],'USER_ENTERED');
}
const maintenanceHeaders=['Date','Truck','Service','Work done','Performed by','Odometer (km)','Record ID','Submitted','Updated'];
async function ensureMaintenance(){
  let sheets=(await api('?fields=sheets.properties')).sheets||[];
  let existing=sheets.find(s=>s.properties.title==='Maintenance Log');
  if(!existing){
    try{await api(':batchUpdate','POST',{requests:[{addSheet:{properties:{title:'Maintenance Log',gridProperties:{rowCount:1000,columnCount:9,frozenRowCount:1,hideGridlines:true}}}}]});}
    catch(error){sheets=(await api('?fields=sheets.properties')).sheets||[];if(!sheets.some(s=>s.properties.title==='Maintenance Log'))throw error;}
  }
  const header=(await readValues("'Maintenance Log'!A1:I1"))[0];
  if(!header||!header.length){
    await write("'Maintenance Log'!A1:I1",[maintenanceHeaders]);
    const metadata=await api('?fields=sheets.properties');const id=metadata.sheets.find(s=>s.properties.title==='Maintenance Log').properties.sheetId;
    await api(':batchUpdate','POST',{requests:[
      {addBanding:{bandedRange:{range:{sheetId:id,startRowIndex:0,endRowIndex:1000,startColumnIndex:0,endColumnIndex:9},rowProperties:{headerColor:{red:.20,green:.23,blue:.26},firstBandColor:{red:.07,green:.08,blue:.10},secondBandColor:{red:.11,green:.13,blue:.15}}}}},
      {repeatCell:{range:{sheetId:id,startColumnIndex:0,endColumnIndex:9},cell:{userEnteredFormat:{textFormat:{foregroundColor:{red:.91,green:.93,blue:.95},fontSize:12},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat'}},
      {repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{textFormat:{bold:true}}},fields:'userEnteredFormat.textFormat.bold'}},
      {updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:3,endIndex:4},properties:{pixelSize:380},fields:'pixelSize'}},
      {updateDimensionProperties:{range:{sheetId:id,dimension:'COLUMNS',startIndex:6,endIndex:9},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
      {repeatCell:{range:{sheetId:id,startColumnIndex:3,endColumnIndex:4,startRowIndex:1},cell:{userEnteredFormat:{wrapStrategy:'WRAP'}},fields:'userEnteredFormat.wrapStrategy'}}
    ]});
  }else if(maintenanceHeaders.some((name,i)=>header[i]!==name))throw new Error('Maintenance Log columns changed. Submissions remain queued.');
}
async function sendMaintenance(t){
  await ensureMaintenance();
  const rows=await readValues("'Maintenance Log'!A:I");const index=rows.findIndex((row,i)=>i>0&&row[6]===t.id);const now=new Date().toISOString();
  const cells=[t.date,t.truck,t.service,t.work,t.performedBy,t.odometer===''?'':Number(t.odometer),t.id,index<0?now:rows[index][7],now];
  if(index<0)await append("'Maintenance Log'!A:I",cells);else await write(`'Maintenance Log'!A${index+1}:I${index+1}`,[cells]);
}
async function drain(){
  if(busy)return;busy=true;clearTimeout(retryTimer);
  try{
    const queue=await records();
    if(!queue.length){status(navigator.onLine?'Ready. No submissions waiting.':'Offline. New submissions will be saved on this device.');return;}
    if(!navigator.onLine){status('Offline. Your submissions are saved and waiting to send.');return;}
    if(!config.googleClientId){status('Google connection setup is needed. Your submissions are saved on this device.');return;}
    if(!token||Date.now()>=expires){status('Tap Connect Google to send saved submissions.');return;}
    for(const record of queue){
      status('Sending saved submissions…');
      if(record.kind==='ticket')await sendTicket(record.payload);else if(record.kind==='maintenance')await sendMaintenance(record.payload);else throw new Error('Unknown queued record type; nothing was deleted.');
      await changeRecord('delete',record.id);await refreshCount();
      $(record.kind==='ticket'?'status':'maintenance-status').textContent='Sent to Google Sheets.';
    }
    status('All submissions sent to Google Sheets.');
  }catch(error){status(error instanceof TypeError?'Connection interrupted. Saved submissions will retry when service returns.':error.message||'Not sent. Saved submissions will retry when a connection is available.');if(!error.auth&&!error.permission&&navigator.onLine)retryTimer=setTimeout(()=>void synchronize(),30000);}
  finally{busy=false;await refreshCount();}
}
async function synchronize(){try{if(navigator.locks)await navigator.locks.request('jwc-outbox-sync',drain);else await drain();}catch{status('Could not access saved submissions. They have not been discarded.');}}
let googleLibrary;
function loadGoogle(){if(!googleLibrary)googleLibrary=new Promise((resolve,reject)=>{if(window.google?.accounts?.oauth2)return resolve();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>{googleLibrary=null;reject(new Error('Google sign-in could not load. Retry when service returns.'));};document.head.append(s);});return googleLibrary;}
authButton.onclick=async()=>{
  if(!config.googleClientId){status('Google connection setup is not finished. Offline submissions are safe on this device.');return;}
  if(!navigator.onLine){status('Google sign-in needs service. You can still submit tickets and maintenance offline.');return;}
  authButton.disabled=true;
  try{await loadGoogle();const client=google.accounts.oauth2.initTokenClient({client_id:config.googleClientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:response=>{authButton.disabled=false;if(response.error||!response.access_token){status('Google sign-in did not finish. Your saved submissions remain queued.');return;}token=response.access_token;expires=Date.now()+(Number(response.expires_in)||3600)*1000-60000;authButton.textContent='Google connected';void synchronize();},error_callback:()=>{authButton.disabled=false;status('Google sign-in was closed. Your submissions remain queued.');}});client.requestAccessToken({prompt:''});}catch(error){authButton.disabled=false;status(error.message);}
};
window.addEventListener('online',()=>void synchronize());window.addEventListener('offline',()=>status('Offline. Submissions will be saved on this device.'));window.addEventListener('focus',()=>void synchronize());
if(config.googleClientId&&navigator.onLine)void loadGoogle().catch(()=>{});
resetForm($('form'),'date');resetForm($('maintenance-form'),'service-date');showView('tickets');void refreshCount().then(()=>synchronize());
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>status('Offline app files could not be saved. Open the app again with service before relying on offline use.'));
