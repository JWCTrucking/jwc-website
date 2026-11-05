const CACHE = 'jwc-field-app-v13';
const ASSETS = ['./','./index.html','./forms.html','./forms.js','./alerts.html','./form-ui.css','./manifest.webmanifest','./jwc-icon-192.png','./jwc-icon-512.png','../assets/jwc-logo.png','../assets/jwc-logo-form.png','../assets/jwc-hero.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('jwc-field-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin) return;
  if(!url.pathname.startsWith('/app/')&&!['/assets/jwc-logo.png','/assets/jwc-logo-form.png'].includes(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match(new URL('./index.html',self.location.href).href);
    return Response.error();
  }));
});

/* Owner invoice alerts: the nightly QuickBooks update sends an empty push; the app shows the message. */
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'JWC invoices updated',{
    body:data.body||"Tonight's tickets were added to QuickBooks invoices. Tap to review and send.",
    icon:'./jwc-icon-192.png',badge:'./jwc-icon-192.png',tag:'jwc-invoices',renotify:true,
    data:{url:data.url||'https://qbo.intuit.com/app/invoices'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=(event.notification.data&&event.notification.data.url)||'https://qbo.intuit.com/app/invoices';
  event.waitUntil(self.clients.openWindow(url));
});
