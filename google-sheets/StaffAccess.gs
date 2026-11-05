/** Shared staff PIN: configure JWC_STAFF_PIN privately in Script Properties. Never put it in the repo. */
function staffError_(code,message) { const error=new Error(message);error.code=code;return error; }
function staffPin_() {
  const pin=PropertiesService.getScriptProperties().getProperty('JWC_STAFF_PIN')||'';
  if(!/^\d{4}$/.test(pin))throw staffError_('PIN_NOT_CONFIGURED','Staff access is not configured. Contact dispatch.');
  return pin;
}
function staffFingerprint_(pin) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,pin,Utilities.Charset.UTF_8).map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('');
}
function requireStaffSession_(token) {
  const pin=staffPin_();
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/i.test(token))throw staffError_('PIN_REQUIRED','Enter the staff PIN to continue.');
  let session;
  try{session=JSON.parse(CacheService.getScriptCache().get('jwc-session:'+token)||'null');}catch{}
  if(!session||session.expiresAt<=Date.now()||session.fingerprint!==staffFingerprint_(pin))throw staffError_('PIN_REQUIRED','Your staff access expired. Enter the PIN again.');
  return true;
}
function authenticateStaff_(payload) {
  const pin=staffPin_();
  if(!payload||!/^[a-z0-9-]{16,100}$/i.test(String(payload.deviceId||'')))throw staffError_('PIN_REQUIRED','Please reload the app and enter the staff PIN.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const cache=CacheService.getScriptCache();
    const deviceKey='jwc-pin-device:'+payload.deviceId;
    const deviceFailures=Number(cache.get(deviceKey)||0),totalFailures=Number(cache.get('jwc-pin-failures')||0);
    if(deviceFailures>=5||totalFailures>=30)throw staffError_('PIN_LOCKED','Too many incorrect attempts. Wait five minutes, then try again.');
    const entered=String(payload.pin||'');let mismatch=entered.length^pin.length;
    for(let i=0;i<4;i++)mismatch|=(entered.charCodeAt(i)||0)^pin.charCodeAt(i);
    if(mismatch!==0||!/^\d{4}$/.test(entered)){
      cache.put(deviceKey,String(deviceFailures+1),300);cache.put('jwc-pin-failures',String(totalFailures+1),300);
      throw staffError_('PIN_INCORRECT','Incorrect PIN. Please try again.');
    }
    cache.remove(deviceKey);
    const token=(Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
    const session={expiresAt:Date.now()+21600000,fingerprint:staffFingerprint_(pin)};
    cache.put('jwc-session:'+token,JSON.stringify(session),21600);
    return {token,expiresAt:session.expiresAt};
  }finally{lock.releaseLock();}
}
