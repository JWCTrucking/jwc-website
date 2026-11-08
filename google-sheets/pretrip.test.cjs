const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let rows=[],sent=0,created=0,failMail=false,authorized=true,quota=10;
const sheet={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),setFrozenRows(){},getRange(row,col,n=1,m=1){return{getValues:()=>rows.slice(row-1,row-1+n).map(r=>r.slice(col-1,col-1+m)),setValue(v){rows[row-1][col-1]=v},setValues(values){values.forEach((r,i)=>{rows[row-1+i]??=[];r.forEach((v,j)=>rows[row-1+i][col-1+j]=v)})}}}};
const file={getId:()=> 'pdf-1',getName:()=> 'report.pdf',getBlob:()=>({getBytes:()=>[37,80,68,70]})};
const context=vm.createContext({console,requireStaffSession_(){if(!authorized)throw Error('PIN_REQUIRED')},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'book'})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet}),flush(){}},DriveApp:{createFile(){created++;return file},getFileById:()=>file},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail(message){assert.equal(message.to,'dispach@jwchauling.com');assert.equal(message.attachments.length,1);sent++;if(failMail)throw Error('ambiguous network failure')}},Utilities:{base64Encode:bytes=>Buffer.from(bytes).toString('base64')}});
vm.runInContext(fs.readFileSync('app/pretrip-data.js','utf8')+'\n'+fs.readFileSync(__dirname+'/Pretrip.gs','utf8'),context);
// Exercise the real PDF document template against Google document/Drive stubs.
const paragraphs=[],tables=[];let closed=false,trashed=false;
context.DocumentApp={ParagraphHeading:{HEADING1:'heading'},create:()=>({getId:()=> 'temp-doc',getBody:()=>({appendParagraph(text){paragraphs.push(text);return{setHeading(){}}},appendTable(rows){tables.push(rows)}}),saveAndClose(){closed=true}})};
context.MimeType={PDF:'application/pdf'};
const realGetFile=context.DriveApp.getFileById;
context.DriveApp.getFileById=()=>({getAs:()=>({setName:name=>({name})}),setTrashed:value=>{trashed=value}});
const templateEntry={id:'pdf-test',carrier:'JWC',date:'2026-11-07',time:'09:30',location:'Edmonton',truck:'823',odometer:'123',trailer:'T1',hubometer:'N/A',inspector:'Inspector',driver:'Driver',inspectorSignature:'Inspector',driverSignature:'Driver',notes:'Carrier notified',items:Array.from({length:23},(_,i)=>({tractor:i===0?'major':'ok',trailer:'ok',details:i===0?'Service brake inoperative':''}))};
const generated=context.pretripPdf_(templateEntry);assert.match(generated.name,/JWC-pretrip/);assert.equal(tables[1].length,24);assert(paragraphs.some(p=>p.includes('MAJOR DEFECT — DO NOT OPERATE')));assert(paragraphs.some(p=>p.includes('Inspector electronic signature: Inspector')));assert(closed&&trashed);
context.DriveApp.getFileById=realGetFile;
// Exercise record persistence and mail state with PDF conversion stubbed (Google APIs unavailable locally).
context.pretripPdf_=()=>({});
const valid={id:'report-1',carrier:'JWC',date:'2026-11-07',time:'09:30',location:'Edmonton',truck:'823',odometer:'12345',trailer:'T1',hubometer:'N/A',inspector:'Driver',driver:'Driver',inspectorSignature:'Driver',driverSignature:'Driver',declaration:true,notes:'',items:Array.from({length:23},()=>({tractor:'ok',trailer:'ok',details:''}))};
authorized=false;assert.throws(()=>context.savePretrip(valid,'token'),/PIN_REQUIRED/);assert.equal(rows.length,0);authorized=true;
for(const change of [{date:'2026-02-30'},{time:'25:00'},{odometer:'-1'},{declaration:false},{items:valid.items.slice(1)},{items:valid.items.map((x,i)=>i?x:{...x,tractor:'major'})}])assert.throws(()=>context.validatePretrip_({...valid,...change}));
let result=context.savePretrip(valid,'token');assert.equal(result.pretripPdfEmailed,true);assert.equal(result.pdfBase64,'JVBERg==');assert.equal(sent,1);assert.equal(created,1);context.savePretrip(valid,'token');assert.equal(sent,1);assert.equal(rows[1][3],'sent');assert.throws(()=>context.savePretrip({...valid,truck:'824'},'token'),/different details/);
const major=JSON.parse(JSON.stringify(valid));major.id='report-major';major.items[0]={tractor:'major',trailer:'ok',details:'Tractor service brake inoperative. Carrier notified 09:30.'};context.savePretrip(major,'token');assert.equal(sent,2);
failMail=true;assert.throws(()=>context.savePretrip({...valid,id:'ambiguous'},'token'),/not confirmed/);const attempts=sent;assert.throws(()=>context.savePretrip({...valid,id:'ambiguous'},'token'),/needs checking/);assert.equal(sent,attempts);
failMail=false;quota=0;assert.throws(()=>context.savePretrip({...valid,id:'quota'},'token'),/quota/);quota=10;context.savePretrip({...valid,id:'quota'},'token');assert.equal(rows.at(-1)[3],'sent');
console.log('PASS: Alberta required fields, signatures, defects, staff auth, archived PDF, fixed recipient, same-ID retries, immutable records, ambiguous email protection and quota recovery.');

authorized=false;failMail=false;assert.throws(()=>context.savePretrip(valid,"token"),/PIN_REQUIRED/);assert.equal(context.savePretrip_(valid).pretripPdfEmailed,true);console.log("PASS: public app submission core needs no PIN; legacy RPC remains protected.");
