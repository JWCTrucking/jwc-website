const {allowTestStaff}=require('./test-access.cjs');
const {browserType,launchOptions}=require('./test-browser.cjs'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((q,r)=>{
  let file=path.join(root,q.url.split('?')[0]);if(file.endsWith('/'))file+='index.html';
  fs.readFile(file,(err,data)=>{
   r.statusCode=err?404:200;
   r.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':'text/html');r.end(err?'Missing':data);
  });
 });
 await new Promise(resolve=>server.listen(8001,resolve));let browser;
 try{
  browser=await browserType.launch(launchOptions);
  for(const width of [320,390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900}});
   await allowTestStaff(context);const p=await context.newPage();await p.goto('http://127.0.0.1:8001/app/');
   await p.waitForFunction(()=>!document.documentElement.classList.contains('intro-running'));
   await p.locator('.photo img').evaluate(i=>i.decode());
   assert(await p.getByRole('link',{name:'Field Tickets',exact:true}).isVisible());assert.equal(await p.getByText('WELCOME TO JWC',{exact:true}).count(),0);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const [name,view,title] of [['Field Tickets','tickets','Field ticket'],['Maintenance','maintenance','Maintenance']]){
    await p.getByRole('link',{name,exact:true}).click();
    const frame=p.frameLocator('#form-frame');await frame.locator('#app-screen-title').getByText(title,{exact:true}).waitFor();
    assert.equal(new URL(p.url()).origin,'http://127.0.0.1:8001');
    assert(await p.locator('#form-frame').evaluate(f=>new URL(f.src).origin===location.origin));
    assert(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await frame.locator('button[type=submit]:visible').count(),1);
    await frame.getByRole('link',{name:'Back to app',exact:true}).click();
    await p.waitForFunction(()=>document.getElementById('form-screen').hidden);
   }
   await p.screenshot({path:path.join(process.env.JWC_PREVIEW_DIR||path.join(root,'.test-results'),`app-welcome-${width}.png`),fullPage:true});
   await p.goto('http://127.0.0.1:8001/tickets/');await p.waitForURL('http://127.0.0.1:8001/app/');
   await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload();
   await context.setOffline(true);await p.reload();await p.waitForFunction(()=>!document.documentElement.classList.contains('intro-running'));
   await p.getByRole('link',{name:'Field Tickets',exact:true}).click();
   assert(await p.locator('#offline-message').isVisible());assert(await p.locator('#form-screen').isHidden());
   console.log(width,'app welcome, same-origin form screens, one Submit, app back navigation, phone fit, offline notice passed');
   await context.close();
  }
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
