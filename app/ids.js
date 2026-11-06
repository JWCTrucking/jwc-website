/* Secure UUIDs for browsers that do not provide crypto.randomUUID (including HTTP tabs). */
(()=>{
  window.JWCUuid=()=>{
    if(typeof window.crypto?.randomUUID==='function')return window.crypto.randomUUID();
    if(typeof window.crypto?.getRandomValues!=='function')throw new Error('Please open the JWC app in an up-to-date browser using https://www.jwchauling.com/app/.');
    const bytes=window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  };
})();
