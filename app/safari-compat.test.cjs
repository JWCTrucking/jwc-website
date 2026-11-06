// Simulates older Safari API gaps in Chromium; this is not a WebKit engine test.
const {browserType,launchOptions}=require('./test-browser.cjs');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  let file=path.join(root,new URL(req.url,'http://localhost').pathname);if(file.endsWith('/'))file+='index.html';
  fs.readFile(file,(error,data)=>{res.statusCode=error?404:200;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/html');res.end(error?'Missing':data);});
 });
 await new Promise(resolve=>server.listen(8008,resolve));let browser;
 try{
  browser=await browserType.launch(launchOptions);
  for(const width of [390,1440]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900},reducedMotion:'reduce'});
   await context.addInitScript(()=>{
    Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});
    Object.defineProperty(HTMLDialogElement.prototype,'showModal',{value:undefined,configurable:true});
    Object.defineProperty(HTMLDialogElement.prototype,'close',{value:undefined,configurable:true});
    Object.defineProperty(MediaQueryList.prototype,'addEventListener',{value:undefined,configurable:true});
   });
   const packets=[];
   await context.route('https://script.google.com/macros/s/**',async route=>{
    const packet=JSON.parse(new URLSearchParams(route.request().postData()).get('packet'));packets.push(packet);
    const ok=packet.kind!=='auth'||packet.payload.pin==='2468';
    const result={type:'JWC_SUBMISSION_RESULT',id:packet.payload.id,requestId:packet.requestId,ok,staffPinAccess:true,ticketRatesPermits:true,
     ...(packet.kind==='auth'&&ok?{session:{token:'a'.repeat(64),expiresAt:Date.now()+21600000}}:{}),
     ...(!ok?{code:'PIN_INCORRECT',message:'Incorrect PIN. Please try again.'}:{})};
    await route.fulfill({contentType:'text/html',body:'<script>window.top.postMessage('+JSON.stringify(result)+',"http://127.0.0.1:8008")</script>'});
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8008/app/');
   await page.getByRole('link',{name:'Field Tickets',exact:true}).click();
   await page.getByRole('dialog').waitFor();
   assert(await page.locator('.staff-pin-overlay').isVisible());
   await page.locator('#staff-pin-input').focus();await page.keyboard.press('Shift+Tab');
   assert(await page.locator('.staff-pin-cancel').evaluate(el=>el===document.activeElement));
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
   await page.getByRole('link',{name:'Field Tickets',exact:true}).click();
   await page.locator('#staff-pin-input').fill('0000');await page.getByRole('button',{name:'Unlock',exact:true}).click();
   await page.getByText('Incorrect PIN. Please try again.',{exact:true}).waitFor();
   await page.locator('#staff-pin-input').fill('2468');await page.getByRole('button',{name:'Unlock',exact:true}).click();
   const form=page.frameLocator('#form-frame');
   await form.locator('#customer').selectOption('Weaver Group Ltd');await form.locator('#truck').selectOption('823');
   await form.locator('#driver').fill('Compatibility test');await form.locator('#hours').fill('8');
   await form.locator('#form button').click();await form.getByText('Ticket submitted to Google Sheets.',{exact:true}).waitFor();
   await form.getByRole('link',{name:'Back to app',exact:true}).click();
   await page.getByRole('link',{name:'Maintenance',exact:true}).click();
   await form.locator('#service-truck').fill('823');await form.locator('#service-type').selectOption('Oil change');
   await form.locator('#service-person').fill('Shop');await form.locator('#service-work').fill('Oil and filters');
   await form.locator('#maintenance-form button').click();try{await form.getByText('Maintenance submitted to Google Sheets.',{exact:true}).waitFor({timeout:10000});}catch(e){console.log('Diagnostic',JSON.stringify({errors,packets:packets.map(p=>({kind:p.kind})),state:await form.locator('body').evaluate(()=>({status:document.getElementById('maintenance-status').textContent,invalid:Array.from(document.querySelectorAll(':invalid')).map(n=>({id:n.id,message:n.validationMessage})),inert:document.querySelector('main').inert}))}));throw e;}
   for(const packet of packets){assert.match(packet.requestId,/^[a-f0-9-]{36}$/);if(['ticket','maintenance'].includes(packet.kind))assert.equal(packet.sessionToken,'a'.repeat(64));}
   assert.deepEqual(errors,[]);assert.equal(await page.locator('.staff-pin-overlay').count(),0);
   console.log('PASS: '+width+'px legacy API simulation — PIN, wrong-PIN retry, cancel/reopen, focus trap, ticket and maintenance confirmation.');
   await context.close();
  }
 }finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1)});
