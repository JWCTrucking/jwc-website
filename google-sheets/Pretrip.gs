/** Alberta daily truck/tractor/trailer inspection. Private PDF archive + fixed dispatch recipient. */
const PRETRIP_RECIPIENT_='dispach@jwchauling.com';
function pretripError_(message){const error=new Error(message);error.code='PRETRIP_FAILED';throw error;}
function validatePretrip_(entry){
 if(!entry||!/^[A-Za-z0-9_-]{1,100}$/.test(String(entry.id||'')))pretripError_('Invalid inspection ID.');
 for(const key of ['carrier','date','time','location','truck','odometer','trailer','hubometer','inspector','driver','inspectorSignature','driverSignature'])if(typeof entry[key]!=='string'||!entry[key].trim()||entry[key].length>200)pretripError_('Complete all inspection details and signatures.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date+'T00:00:00Z'))||new Date(entry.date+'T00:00:00Z').toISOString().slice(0,10)!==entry.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))pretripError_('Enter a valid inspection date and time.');
 if(!/^\d+$/.test(entry.odometer)||!Number.isSafeInteger(Number(entry.odometer)))pretripError_('Enter tractor odometer in whole kilometres.');
 if(!/^(\d+|N\/A)$/i.test(entry.hubometer))pretripError_('Enter trailer hubometer in kilometres or N/A.');
 if(entry.declaration!==true)pretripError_('Sign the inspection declaration.');
 if(typeof entry.notes!=='string'||entry.notes.length>2000)pretripError_('Inspection notes are too long.');
 if(!Array.isArray(entry.items)||entry.items.length!==JWC_PRETRIP_ITEMS.length)pretripError_('Complete every inspection system.');
 entry.items.forEach(item=>{if(!item||!['ok','minor','major','na'].includes(item.tractor)||!['ok','minor','major','na'].includes(item.trailer)||typeof item.details!=='string'||item.details.length>500)pretripError_('Complete each tractor and trailer result.');if([item.tractor,item.trailer].some(x=>['minor','major','na'].includes(x))&&!item.details.trim())pretripError_('Describe each defect and reason for N/A.');});
}
function pretripPdf_(entry){
 const doc=DocumentApp.create('JWC pre-trip '+entry.id),body=doc.getBody();
 try{
 body.appendParagraph('JWC · ALBERTA DAILY TRIP INSPECTION').setHeading(DocumentApp.ParagraphHeading.HEADING1);
 body.appendParagraph('Truck, tractor & trailer · NSC Standard 13 Part 2 Schedule 1');
 const major=entry.items.some(x=>x.tractor==='major'||x.trailer==='major'),defects=entry.items.some(x=>['minor','major'].includes(x.tractor)||['minor','major'].includes(x.trailer));
 body.appendParagraph(major?'MAJOR DEFECT — DO NOT OPERATE. Notify carrier immediately.':defects?'DEFECTS DETECTED — see inspection results.':'NO DEFECTS DETECTED.');
 body.appendTable([['Report ID',entry.id],['Carrier',entry.carrier],['Inspection date/time (Alberta local)',entry.date+' '+entry.time],['Inspection location',entry.location],['Tractor unit / plate / VIN',entry.truck],['Tractor odometer (km)',entry.odometer],['Trailer unit / plate / VIN',entry.trailer],['Trailer hubometer (km)',entry.hubometer],['Inspector',entry.inspector],['Driver / report maker',entry.driver]]);
 const labels={ok:'No defect',minor:'Minor defect',major:'MAJOR DEFECT',na:'N/A'};
 body.appendTable([['Schedule 1 system','Tractor','Trailer','Defects / N/A explanation'],...entry.items.map((item,i)=>[(i+1)+'. '+JWC_PRETRIP_ITEMS[i],labels[item.tractor],labels[item.trailer],item.details||'—'])]);
 body.appendParagraph('Additional defects, carrier notifications and repair / correction notes');body.appendParagraph(entry.notes||'None recorded.');
 body.appendParagraph('I inspected the identified tractor and trailer in accordance with Alberta Commercial Vehicle Safety Regulation section 10 and the applicable NSC Standard 13 Schedule 1 requirements. This report records all defects found, or states no defects detected.');
 body.appendParagraph('Inspector electronic signature: '+entry.inspectorSignature);body.appendParagraph('Driver / report maker electronic signature: '+entry.driverSignature);body.appendParagraph('Signed inspection report: '+entry.date+' '+entry.time+' (Alberta local). Received: '+new Date().toISOString());
 body.appendParagraph('Inspection valid for 24 hours from recorded inspection time. Keep report and applicable schedule available in vehicle. Record/report subsequent defects. Major defects: do not operate; notify carrier without delay. Other defects: report no later than next daily inspection. Carrier must retain reports for at least 6 months. Forward original to carrier within 20 days. Submission is not authorization to operate.');
 body.appendParagraph('Sources: Alberta AR 121/2009 ss.10–16: https://kings-printer.alberta.ca/documents/Regs/2009_121.pdf ; NSC Schedule 1: https://www.ccmta.ca/web/default/files/PDF/Standard_13_March_2009.pdf');
 doc.saveAndClose();return DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName('JWC-pretrip-'+entry.date+'-'+entry.id+'.pdf');
 }finally{DriveApp.getFileById(doc.getId()).setTrashed(true);}
}
function savePretrip(entry,session) {
  requireStaffSession_(session);
  return savePretrip_(entry);
}
/** Public app submission core. Private underscore prevents direct google.script.run calls. */
function savePretrip_(entry) {
 validatePretrip_(entry);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
 const bookId=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!bookId)pretripError_('Inspection workbook is not configured.');
 const book=SpreadsheetApp.openById(bookId),headers=['Record ID','Payload','PDF file ID','Email status','Received','Emailed'];
 let sheet=book.getSheetByName('Pre-trip Log');if(!sheet){sheet=book.insertSheet('Pre-trip Log');sheet.appendRow(headers);sheet.setFrozenRows(1);}else if(sheet.getRange(1,1,1,6).getValues()[0].some((x,i)=>x!==headers[i]))pretripError_('Pre-trip Log columns do not match. No data changed.');
 const canonical=JSON.stringify({id:entry.id,...Object.fromEntries(['carrier','date','time','location','truck','odometer','trailer','hubometer','inspector','driver','inspectorSignature','driverSignature','declaration','notes'].map(k=>[k,entry[k]])),items:entry.items.map(x=>({tractor:x.tractor,trailer:x.trailer,details:x.details}))});
 const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues():[],index=rows.findIndex(x=>String(x[0])===entry.id);let row=index<0?sheet.getLastRow()+1:index+2,file,status;
 if(index>=0){if(rows[index][1]!==canonical)pretripError_('This report ID already exists with different details. Contact dispatch before changing a submitted report.');status=rows[index][3];if(rows[index][2])file=DriveApp.getFileById(rows[index][2]);}
 else{sheet.getRange(row,1,1,6).setValues([[entry.id,canonical,'','pending',new Date(),'']]);SpreadsheetApp.flush();}
 if(!file){file=DriveApp.createFile(pretripPdf_(entry));sheet.getRange(row,3).setValue(file.getId());SpreadsheetApp.flush();}
 if(status==='sending')pretripError_('Email delivery needs checking. Contact dispatch with report ID '+entry.id+' before retrying; PDF is archived.');
 if(status!=='sent'){
 if(MailApp.getRemainingDailyQuota()<1)pretripError_('Email quota reached. PDF archived; draft kept. Retry later.');
 sheet.getRange(row,4).setValue('sending');SpreadsheetApp.flush();
 try{MailApp.sendEmail({to:PRETRIP_RECIPIENT_,subject:'JWC Alberta pre-trip · '+entry.truck.replace(/[\r\n]/g,' ').slice(0,60)+' · '+entry.date+' · '+entry.id,body:'Daily truck and trailer inspection attached. Tractor: '+entry.truck+'; trailer: '+entry.trailer+'.\n'+(entry.items.some(x=>x.tractor==='major'||x.trailer==='major')?'MAJOR DEFECT — DO NOT OPERATE. Review immediately.':'Review attached inspection and any defects.')+'\nReport ID: '+entry.id,attachments:[file.getBlob()]});}catch(error){pretripError_('Email was not confirmed. Contact dispatch with report ID '+entry.id+' to check delivery. PDF is archived; draft kept.');}
 sheet.getRange(row,4).setValue('sent');sheet.getRange(row,6).setValue(new Date());SpreadsheetApp.flush();
 }
 return {pretripPdfEmailed:true,pdfBase64:Utilities.base64Encode(file.getBlob().getBytes()),pdfFilename:file.getName()};
 }finally{lock.releaseLock();}
}
/** Run once as deployment owner to authorize PDF and email scopes; no records or messages created. */
function authorizePretrip(){
 const bookId=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
 if(!bookId)throw new Error('SPREADSHEET_ID is not configured.');
 SpreadsheetApp.openById(bookId).getId();
 DriveApp.getRootFolder().getId();
 // Apps Script discovers DocumentApp's creation scope from pretripPdf_.
 MailApp.getRemainingDailyQuota();
}
