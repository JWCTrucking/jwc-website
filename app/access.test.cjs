const {browserType,launchOptions}=require('./test-browser.cjs'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>{let f=path.join(root,q.url.split('?')[0]);if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{r.statusCode=e?404:200;r.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html');r.end(e?'Missing':d)});});await new Promise(r=>server.listen(8006,r));let browser;
 try{
 browser=await browserType.launch(launchOptions);const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'});await c.addInitScript(()=>Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true}));
 const calls=[];let rejectApp=false,holdAuth=false;
 await c.route('https://script.google.com/macros/s/**',async route=>{
  const packet=JSON.parse(new URLSearchParams(route.request().postData()).get('packet'));calls.push(packet);if(holdAuth&&packet.kind==='auth'){await new Promise(r=>setTimeout(r,600));}
  const ok=packet.kind==='auth'?packet.payload.pin==='2468':!rejectApp;
  const result={type:'JWC_SUBMISSION_RESULT',requestId:packet.requestId,id:packet.payload.id,ok,staffPinAccess:true,ticketRatesPermits:true,...(packet.kind==='auth'&&ok?{session:{token:'a'.repeat(64),expiresAt:Date.now()+21600000}}:{}),...(!ok?{code:packet.kind==='auth'?'PIN_INCORRECT':'PIN_REQUIRED',message:packet.kind==='auth'?'Incorrect PIN. Please try again.':'Old backend requires PIN.'}:{})};
  await route.fulfill({contentType:'text/html',body:'<script>window.top.postMessage('+JSON.stringify(result)+',"http://127.0.0.1:8006")</script>'});
 });
 const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Direct app opens all forms immediately with no authentication network calls.
 await page.goto('http://127.0.0.1:8006/app/');
 for(const [name,selector]of [['Field Tickets','#customer'],['Maintenance','#service-truck'],['Truck & Trailer Pre-trip','#truck'],['FLHA · Hazard Assessment','#site'],['Toolbox Meeting','#site']]){
  await page.getByRole('link',{name,exact:true}).click();const f=page.frameLocator('#form-frame');await f.locator(selector).waitFor();await f.locator('main:not([inert])').waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await f.getByRole('dialog').count(),0);await f.getByRole('link',{name:'Back to app',exact:true}).click();await page.waitForFunction(()=>document.getElementById('form-screen').hidden);
 }
 assert.equal(calls.length,0);
 // The actual website staff link keeps the PIN gate.
 await page.goto('http://127.0.0.1:8006/');await page.getByRole('link',{name:'FIELD TICKETS',exact:true}).click();await page.locator('#staff-pin-input').fill('0000');await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByText('Incorrect PIN. Please try again.',{exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/');
 await page.locator('#staff-pin-input').fill('2468');await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.waitForURL('**/app/?open=tickets*');const f=page.frameLocator('#form-frame');await f.locator('#customer').selectOption('Weaver Group Ltd');await f.locator('#truck').selectOption('823');await f.locator('#driver').fill('Test');await f.locator('#hours').fill('8');await f.locator('#form button').click();await f.getByText('Ticket submitted to Google Sheets.',{exact:true}).waitFor();assert.equal(calls.filter(p=>p.kind==='session').length,0);assert.equal(calls.filter(p=>p.kind==='auth').length,2);
 // Reopening the website uses the saved unexpired session, without another Google round trip.
 await page.goto('http://127.0.0.1:8006/');await page.getByRole('link',{name:'FIELD TICKETS',exact:true}).click();await page.waitForURL('**/app/?open=tickets*');assert.equal(calls.filter(p=>p.kind==='auth').length,2);
 assert(!Object.values(await page.evaluate(()=>({...localStorage}))).includes('2468'));
 // A stale Google deployment retains the app draft and gives an update message, never a PIN prompt.
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});await page.goto('http://127.0.0.1:8006/app/forms.html');await page.locator('#customer').selectOption('Weaver Group Ltd');await page.locator('#truck').selectOption('823');await page.locator('#driver').fill('No PIN app');await page.locator('#hours').fill('8');rejectApp=true;await page.locator('#form button').click();await page.getByText('The submission service needs updating. Your entry is saved on this device. After the Google script is updated, tap Submit again.',{exact:true}).waitFor();assert.equal(await page.locator('#driver').inputValue(),'No PIN app');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(calls.at(-1).sessionToken,null);
 // Cancelling an in-flight website sign-in must not navigate on a late response.
 rejectApp=false;holdAuth=true;await page.goto('http://127.0.0.1:8006/');await page.getByRole('link',{name:'FIELD TICKETS',exact:true}).click();await page.locator('#staff-pin-input').fill('2468');await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForTimeout(800);assert.equal(new URL(page.url()).pathname,'/');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('jwc-staff-session')),null);assert.deepEqual(errors,[]);
 await c.close();console.log('PASS: website-only PIN, no app auth/check requests across all five forms, saved website session, cancellation, old-backend draft retention and no stored PIN.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
