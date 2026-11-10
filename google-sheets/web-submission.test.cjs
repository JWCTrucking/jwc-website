const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const writes=[];let output;
const ctx=vm.createContext({saveSafety_:record=>{writes.push({kind:'safety',id:record.id});return{safetyPdfEmailed:true,pdfBase64:'JVBERg==',pdfFilename:'safety.pdf'}},savePretrip_:record=>{writes.push({kind:'pretrip',id:record.id});return{pretripPdfEmailed:true,pdfBase64:'JVBERg==',pdfFilename:'report.pdf'}},saveTickets_:rows=>writes.push({kind:'ticket',id:rows[0].id}),saveMaintenance_:record=>writes.push({kind:'maintenance',id:record.id}),HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput(html){output=html;return{setXFrameOptionsMode(mode){assert.equal(mode,'all');return html}}}}});
vm.runInContext(fs.readFileSync(__dirname+'/WebSubmission.gs','utf8'),ctx);
const packet={origin:'https://www.jwchauling.com',requestId:'request-1',kind:'ticket',payload:{id:'ticket-1'}};ctx.doPost({parameter:{packet:JSON.stringify(packet)}});assert.equal(writes.length,1);assert(output.includes('"ok":true'));assert(output.includes('"ticketRatesPermits":true'));assert(output.includes('"requestId":"request-1"'));assert(output.includes('"id":"ticket-1"'));assert(output.includes('https://www.jwchauling.com'));
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'maintenance',payload:{id:'service-1'}})}});assert.equal(writes[1].kind,'maintenance');
ctx.doPost({parameter:{packet:JSON.stringify({...packet,origin:'https://other.example'})}});assert.equal(writes.length,2);assert(output.includes('"ok":false'));
ctx.doPost({parameter:{packet:'not JSON'}});assert(output.includes('"ok":false'));assert.equal(writes.length,2);
console.log('PASS: ticket/maintenance dispatch, correlated confirmation, allowed origins, malformed requests.');

ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'pretrip',payload:{id:'inspection-1'}})}});assert.equal(writes.at(-1).kind,'pretrip');assert(output.includes('\"pretripPdfEmailed\":true'));assert(output.includes('\"pdfBase64\":\"JVBERg==\"'));console.log('PASS: pre-trip PDF and email acknowledgment returned only after backend success.');

ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:"safety",payload:{id:"safety-1"}})}});assert.equal(writes.at(-1).kind,"safety");assert(output.includes('"safetyPdfEmailed":true'));console.log("PASS: safety dispatch and signed PDF acknowledgment.");
const beforeLarge=writes.length;
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'ticket',payload:{id:'too-large-ticket',notes:'x'.repeat(60000)}})}});assert.equal(writes.length,beforeLarge);assert(output.includes('"ok":false'));
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'safety',payload:{id:'large-safety',signature:'x'.repeat(60000)}})}});assert.equal(writes.length,beforeLarge+1);assert(output.includes('"ok":true'));
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'safety',payload:{id:'too-large-safety',signature:'x'.repeat(250000)}})}});assert.equal(writes.length,beforeLarge+1);assert(output.includes('"ok":false'));console.log('PASS: larger safety packets permitted; other kinds retain their cap and oversized safety packets are rejected.');

const beforeHealth=writes.length;
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'health'})}});
assert.equal(writes.length,beforeHealth);assert(output.includes('"appWithoutPin":true'));assert(output.includes('"ok":true'));
console.log('PASS: read-only health confirms no-PIN deployment without writing a ticket.');
