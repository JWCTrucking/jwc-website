const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync(__dirname+'/ids.js','utf8');
for(const native of [true,false]){
 const crypto={getRandomValues:bytes=>webcrypto.getRandomValues(bytes)};
 if(native)crypto.randomUUID=()=>webcrypto.randomUUID();
 const context={window:{crypto},Uint8Array};vm.runInNewContext(source,context);
 const ids=Array.from({length:1000},()=>context.window.JWCUuid());
 assert(ids.every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
 assert.equal(new Set(ids).size,1000);
}
console.log('PASS: secure UUID generation with and without crypto.randomUUID.');
