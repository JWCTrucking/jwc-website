const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
const root=path.resolve(__dirname,'..');
const server=http.createServer((q,r)=>{let file=path.join(root,q.url.split('?')[0]);if(file.endsWith('/'))file+='index.html';fs.readFile(file,(err,data)=>{r.statusCode=err?404:200;const type=file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':'text/html';r.setHeader('Content-Type',type);r.end(err?'Missing':data)});});
await new Promise(resolve=>server.listen(8001,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const tables={'Ticket Log':[['Ticket ID','Submitted','Date','Customer','Job','Truck','Driver','Hours','Jeep','Booster','Tridem','Description','Updated','Quantity','Rate','Amount','QB reference']]};
 let dropAfterAppend=true;
 await context.route('**/app/config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.JWC_APP_CONFIG={spreadsheetId:"test-book",googleClientId:"test-client"};'}));
 await context.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:"test-token",expires_in:3600})})}}};'}));
 function col(n){return [...n].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;}
 await context.route('https://sheets.googleapis.com/**',async route=>{
  const request=route.request(),url=new URL(request.url());let data={};const body=request.postData()?JSON.parse(request.postData()):null;
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT'}});return;}
  if(url.pathname.endsWith(':batchUpdate')){for(const op of body.requests||[])if(op.addSheet){const name=op.addSheet.properties.title;if(!tables[name])tables[name]=[];}data={replies:[]};}
  else if(url.pathname.includes('/values/')){
   let range=decodeURIComponent(url.pathname.split('/values/')[1]);const append=range.endsWith(':append');if(append)range=range.slice(0,-7);const match=range.match(/^'([^']+)'!(.*)$/);assert(match,range);const name=match[1],a1=match[2];assert(tables[name],name);
   if(request.method()==='GET'){if(a1==='A1:I1')data={values:tables[name].length?[tables[name][0]]:[]};else data={values:tables[name]};}
   else if(append){tables[name].push(body.values[0]);const row=tables[name].length;data={updates:{updatedRange:`'${name}'!A${row}:Q${row}`}};if(name==='Ticket Log'&&dropAfterAppend){dropAfterAppend=false;await route.abort('failed');return;}}
   else{const cell=a1.match(/^([A-Z]+)(\d+)/);const row=Number(cell[2])-1,start=col(cell[1]);while(tables[name].length<=row)tables[name].push([]);body.values.forEach((values,i)=>{if(!tables[name][row+i])tables[name][row+i]=[];values.forEach((v,j)=>tables[name][row+i][start+j]=v)});data={updatedRange:range};}
  }else data={sheets:Object.keys(tables).map((title,index)=>({properties:{title,sheetId:index+1}}))};
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
 });
 const p=await context.newPage();await p.goto('http://127.0.0.1:8001/app/');await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();
 await context.setOffline(true);await p.reload();await p.locator('#customer').selectOption('Weaver Group Ltd');await p.locator('#truck').selectOption('823');await p.locator('#hours').fill('8');await p.locator('#work').fill('Haul excavator');await p.locator('#form button').click();await p.waitForFunction(()=>document.getElementById('queue-count').textContent.startsWith('1 waiting'));
 await p.getByRole('link',{name:'Maintenance',exact:true}).click();await p.locator('#service-truck').fill('823');await p.locator('#service-type').selectOption('Oil change');await p.locator('#service-person').fill('Test shop');await p.locator('#service-odometer').fill('125000');await p.locator('#service-work').fill('Oil and filters replaced');await p.locator('#maintenance-form button').click();await p.waitForFunction(()=>document.getElementById('queue-count').textContent.startsWith('2 waiting'));
 await p.reload();await p.waitForFunction(()=>document.getElementById('queue-count').textContent.startsWith('2 waiting'));console.log('PASS: cached app opens offline; ticket and maintenance queue survive reload.');
 await context.setOffline(false);await p.locator('#connect-google').click();await p.waitForFunction(()=>document.getElementById('sync-status').textContent.includes('Connection interrupted'));assert.equal(tables['Ticket Log'].length,2);assert.equal(await p.evaluate(async()=> (await records()).length),2);
 await p.evaluate(()=>synchronize());await p.waitForFunction(()=>document.getElementById('queue-count').textContent==='No submissions waiting');assert.equal(tables['Ticket Log'].length,2);assert.equal(tables['Maintenance Log'].length,2);assert.equal(tables['Maintenance Log'][1][3],'Oil and filters replaced');assert.equal(tables['Maintenance Log'][1][4],'Test shop');assert.equal(tables['Ticket Log'][1][13],'=H2');console.log('PASS: interrupted append retries without duplicate; both queues drain only after confirmation.');
 for(const width of [320,390,1440]){await p.setViewportSize({width,height:844});for(const tab of ['tickets','maintenance']){await p.evaluate(view=>showView(view),tab);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('button[type=submit]:visible').count(),1);}await p.screenshot({path:`/workspace/previews/app-${width}.png`,fullPage:true});}console.log('PASS: phone and desktop fit; only active form Submit button is visible.');
 await p.evaluate(()=>{token='';expires=0});await p.getByRole('link',{name:'Maintenance',exact:true}).click();await p.locator('#service-truck').fill('824');await p.locator('#service-type').selectOption('Repair');await p.locator('#service-person').fill('Shop');await p.locator('#service-work').fill('Brake work');await p.locator('#maintenance-form button').click();await p.waitForFunction(()=>document.getElementById('sync-status').textContent.includes('Tap Connect Google'));assert.equal(await p.evaluate(async()=> (await records()).length),1);console.log('PASS: expired Google sign-in retains records and prompts to connect.');
 await context.close();
 const unconfigured=await browser.newContext();const q=await unconfigured.newPage();await q.goto('http://127.0.0.1:8001/app/');await q.locator('#connect-google').click();assert((await q.locator('#sync-status').innerText()).includes('setup'));await q.close();console.log('PASS: unconfigured deployment does not claim to be connected.');
}finally{if(browser)await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1)});
