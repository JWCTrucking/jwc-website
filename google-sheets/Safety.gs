/** Basic FLHA/toolbox forms with drawn signatures. Same private archive/email pattern as pre-trip. */
function safetyError_(message){const error=new Error(message);error.code='SAFETY_FAILED';throw error;}
function safetySignatureBytes_(signature){
 if(typeof signature!=='string'||signature.length>24000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signature))safetyError_('Each crew member needs a drawn signature.');
 let bytes;try{bytes=Utilities.base64Decode(signature.slice(22));}catch(error){safetyError_('Invalid signature image.');}
 const b=bytes.map(x=>x&255),png=[137,80,78,71,13,10,26,10];
 if(b.length<40||png.some((v,i)=>b[i]!==v)||b.slice(12,16).join(',')!=='73,72,68,82')safetyError_('Invalid PNG signature.');
 const width=b[16]*16777216+b[17]*65536+b[18]*256+b[19],height=b[20]*16777216+b[21]*65536+b[22]*256+b[23];
 if(width!==480||height!==144)safetyError_('Invalid signature dimensions. Please sign again in the app.');
 return bytes;
}
function validateSafety_(entry){
 if(!entry||!/^[A-Za-z0-9_-]{1,100}$/.test(String(entry.id||''))||!['flha','toolbox'].includes(entry.kind))safetyError_('Invalid safety record.');
 for(const field of ['date','time','site','job','leader'])if(typeof entry[field]!=='string'||!entry[field].trim()||entry[field].length>200)safetyError_('Complete the date, time, site, job and meeting leader.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date+'T00:00:00Z'))||new Date(entry.date+'T00:00:00Z').toISOString().slice(0,10)!==entry.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))safetyError_('Enter a valid meeting date and time.');
 for(const field of ['hazards','controls'])if(typeof entry[field]!=='string'||!entry[field].trim()||entry[field].length>2000)safetyError_('Record the hazards/topics and controls/actions.');
 if(typeof entry.notes!=='string'||entry.notes.length>1000||entry.acknowledged!==true)safetyError_('Confirm the crew review. Notes must be under 1000 characters.');
 if(!Array.isArray(entry.crew)||entry.crew.length<1||entry.crew.length>8)safetyError_('Add between 1 and 8 crew members.');
 entry.crew.forEach(person=>{
 if(!person||typeof person.name!=='string'||!person.name.trim()||person.name.length>120||typeof person.signedAt!=='string'||person.signedAt.length>40||!Number.isFinite(Date.parse(person.signedAt)))safetyError_('Each crew member needs a name and dated signature.');
 safetySignatureBytes_(person.signature);
 });
}
function safetyPdf_(entry){
 const title=entry.kind==='toolbox'?'TOOLBOX MEETING':'FIELD LEVEL HAZARD ASSESSMENT (FLHA)';
 const doc=DocumentApp.create('JWC '+title+' '+entry.id),body=doc.getBody();
 try{
 body.appendParagraph('JWC CONTRACTING LTD.').setHeading(DocumentApp.ParagraphHeading.HEADING1);body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
 body.appendTable([['Report ID',entry.id],['Date / time (Alberta local)',entry.date+' '+entry.time],['Site / location / LSD',entry.site],['Job / work',entry.job],['Meeting leader',entry.leader]]);
 body.appendParagraph(entry.kind==='toolbox'?'Topics / hazards discussed':'Hazards identified').setHeading(DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph(entry.hazards);
 body.appendParagraph(entry.kind==='toolbox'?'Agreed actions / controls / person responsible':'Controls / safe work steps').setHeading(DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph(entry.controls);
 body.appendParagraph(entry.kind==='toolbox'?'Other notes / emergency reminders':'Emergency / muster point / contact notes').setHeading(DocumentApp.ParagraphHeading.HEADING2);body.appendParagraph(entry.notes||'None recorded.');
 body.appendParagraph('CREW SIGN-OFF').setHeading(DocumentApp.ParagraphHeading.HEADING2);
 body.appendParagraph('Each person signing confirms they participated, reviewed the hazards and controls, and understand to stop work if conditions become unsafe. We reviewed this form together and understand the controls and any follow-up actions.');
 entry.crew.forEach((person,i)=>{body.appendParagraph((i+1)+'. '+person.name+' · Signed '+person.signedAt+' (UTC)');body.appendImage(Utilities.newBlob(safetySignatureBytes_(person.signature),'image/png','signature.png')).setWidth(360).setHeight(108);});
 body.appendParagraph('Basic crew safety record. Follow the site’s required procedures and permits. Stop and reassess if work or conditions change.');body.appendParagraph('Received: '+new Date().toISOString());
 doc.saveAndClose();return DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName('JWC-'+entry.kind+'-'+entry.date+'-'+entry.id+'.pdf');
 }finally{DriveApp.getFileById(doc.getId()).setTrashed(true);}
}
function saveSafety(entry,session) {
  requireStaffSession_(session);
  return saveSafety_(entry);
}
/** Public app submission core. Private underscore prevents direct google.script.run calls. */
function saveSafety_(entry) {
 validateSafety_(entry);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
 const bookId=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!bookId)safetyError_('The JWC workbook is not configured.');
 const book=SpreadsheetApp.openById(bookId),headers=['Record ID','Type','Payload file ID','PDF file ID','Email status','Received','Emailed'];
 let sheet=book.getSheetByName('Safety Log');if(!sheet){sheet=book.insertSheet('Safety Log');sheet.appendRow(headers);sheet.setFrozenRows(1);}else if(sheet.getRange(1,1,1,7).getValues()[0].some((x,i)=>x!==headers[i]))safetyError_('Safety Log columns do not match. No data changed.');
 const canonical=JSON.stringify({id:entry.id,kind:entry.kind,...Object.fromEntries(['date','time','site','job','leader','hazards','controls','notes','acknowledged'].map(k=>[k,entry[k]])),crew:entry.crew.map(p=>({name:p.name,signature:p.signature,signedAt:p.signedAt}))});
 const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,7).getValues():[],index=rows.findIndex(x=>String(x[0])===entry.id);const row=index<0?sheet.getLastRow()+1:index+2;let file,status;
 if(index>=0){if(DriveApp.getFileById(rows[index][2]).getBlob().getDataAsString()!==canonical)safetyError_('This record is already archived with different details. Contact dispatch before changing it.');status=rows[index][4];if(rows[index][3])file=DriveApp.getFileById(rows[index][3]);}
 else{
 // Keep signatures out of a single spreadsheet cell (Sheets has a 50,000-character cell limit).
 const payload=DriveApp.createFile('JWC-'+entry.kind+'-'+entry.id+'.json',canonical,MimeType.PLAIN_TEXT);
 sheet.getRange(row,1,1,7).setValues([[entry.id,entry.kind,payload.getId(),'','pending',new Date(),'']]);SpreadsheetApp.flush();
 }
 if(!file){file=DriveApp.createFile(safetyPdf_(entry));sheet.getRange(row,4).setValue(file.getId());SpreadsheetApp.flush();}
 if(status==='sending')safetyError_('Email delivery needs checking. Contact dispatch with record ID '+entry.id+' before retrying. The signed PDF is archived.');
 if(status!=='sent'){
 if(MailApp.getRemainingDailyQuota()<1)safetyError_('Email quota reached. Signed PDF archived; draft kept. Retry later.');
 sheet.getRange(row,5).setValue('sending');SpreadsheetApp.flush();
 try{MailApp.sendEmail({to:PRETRIP_RECIPIENT_,subject:'JWC '+(entry.kind==='flha'?'FLHA':'Toolbox meeting')+' · '+entry.site.replace(/[\r\n]/g,' ').slice(0,50)+' · '+entry.date+' · '+entry.id,body:'Signed '+(entry.kind==='flha'?'Field Level Hazard Assessment':'toolbox meeting record')+' attached.\nSite: '+entry.site+'\nJob: '+entry.job+'\nMeeting leader: '+entry.leader+'\nRecord ID: '+entry.id,attachments:[file.getBlob()]});}catch(error){safetyError_('Email was not confirmed. Contact dispatch with record ID '+entry.id+' to check delivery. Signed PDF archived; draft kept.');}
 sheet.getRange(row,5).setValue('sent');sheet.getRange(row,7).setValue(new Date());SpreadsheetApp.flush();
 }
 return {safetyPdfEmailed:true,pdfBase64:Utilities.base64Encode(file.getBlob().getBytes()),pdfFilename:file.getName()};
 }finally{lock.releaseLock();}
}
/** Run as owner after pasting the complete runtime bundle; requests the same scopes as pre-trip. */
function authorizeSafetyForms(){authorizePretrip();}
