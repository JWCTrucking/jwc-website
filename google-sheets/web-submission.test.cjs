const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const writes=[];let output;
const ctx=vm.createContext({savePretrip:record=>{writes.push({kind:'pretrip',id:record.id});return{pretripPdfEmailed:true,pdfBase64:'JVBERg==',pdfFilename:'report.pdf'}},saveTickets:rows=>writes.push({kind:'ticket',id:rows[0].id}),saveMaintenance:record=>writes.push({kind:'maintenance',id:record.id}),HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput(html){output=html;return{setXFrameOptionsMode(mode){assert.equal(mode,'all');return html}}}}});
vm.runInContext(fs.readFileSync(__dirname+'/WebSubmission.gs','utf8'),ctx);
const packet={origin:'https://www.jwchauling.com',requestId:'request-1',kind:'ticket',payload:{id:'ticket-1'}};ctx.doPost({parameter:{packet:JSON.stringify(packet)}});assert.equal(writes.length,1);assert(output.includes('"ok":true'));assert(output.includes('"ticketRatesPermits":true'));assert(output.includes('"requestId":"request-1"'));assert(output.includes('"id":"ticket-1"'));assert(output.includes('https://www.jwchauling.com'));
ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'maintenance',payload:{id:'service-1'}})}});assert.equal(writes[1].kind,'maintenance');
ctx.doPost({parameter:{packet:JSON.stringify({...packet,origin:'https://other.example'})}});assert.equal(writes.length,2);assert(output.includes('"ok":false'));
ctx.doPost({parameter:{packet:'not JSON'}});assert(output.includes('"ok":false'));assert.equal(writes.length,2);
console.log('PASS: ticket/maintenance dispatch, correlated confirmation, allowed origins, malformed requests.');

ctx.doPost({parameter:{packet:JSON.stringify({...packet,kind:'pretrip',payload:{id:'inspection-1'}})}});assert.equal(writes.at(-1).kind,'pretrip');assert(output.includes('\"pretripPdfEmailed\":true'));assert(output.includes('\"pdfBase64\":\"JVBERg==\"'));console.log('PASS: pre-trip PDF and email acknowledgment returned only after backend success.');
