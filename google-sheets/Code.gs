/** JWC ticket workbook and authenticated ticket app. Deploy as the user accessing the app. */
const TARGET_SPREADSHEET_ID = '1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4';
const HEADERS = ['Ticket ID','Submitted','Date','Customer','Job number','Truck','Driver','Truck hours','Jeep','Booster','Tridem','Description','Updated','Billing quantity','Unit rate','Amount','Invoice number','Permits','Permit rate'];
function setupWorkbook() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('SPREADSHEET_ID');
  if (existing && existing !== TARGET_SPREADSHEET_ID) throw new Error('This script is already connected to a different workbook. No changes made.');
  if (existing) return SpreadsheetApp.openById(existing).getUrl();
  const book = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  for (const name of ['Ticket Log','Truck Log','Billing Data','Overview']) {
    if (book.getSheetByName(name)) throw new Error('A tab named '+name+' already exists. Setup stopped to preserve existing data.');
  }
  const log = book.insertSheet('Ticket Log');
  log.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); log.setFrozenRows(1);
  log.getRange('A1:Q1').setFontWeight('bold').setBackground('#20252d').setFontColor('#ffffff');
  log.getRange('N1').setNote('Defaults to truck hours. Edit for flat or other charges; use 1 for a flat charge.');
  log.getRange('O1').setNote('Enter the agreed rate for this ticket. No rate is assumed.');
  log.getRange('Q1').setNote('Optional reference for later QuickBooks reconciliation.');
  log.getRange('N2:O1000').setBackground('#fff2cc'); log.getRange('Q2:Q1000').setBackground('#fff2cc');
  log.getRange('O2:P1000').setNumberFormat('$#,##0.00');
  log.getRange('N2:O1000').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
  log.getRange('B2:B1000').setNumberFormat('yyyy-mm-dd hh:mm'); log.getRange('M2:M1000').setNumberFormat('yyyy-mm-dd hh:mm');
  log.getRange('A1:S1000').createFilter(); log.autoResizeColumns(1,19); log.setColumnWidth(12,320);
  props.setProperty('SPREADSHEET_ID',book.getId());
  refreshWorkbookDesign();
  console.log('Workbook: '+book.getUrl()); return book.getUrl();
}
function doGet(e) {
  const view=e && e.parameter && e.parameter.view==='maintenance'?'maintenance':'tickets';
  const html=HtmlService.createHtmlOutputFromFile('Tickets').getContent().replace('data-initial-view="tickets"','data-initial-view="'+view+'"');
  return HtmlService.createHtmlOutput(html).setTitle('JWC Field App').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover');
}
function safeCell(value) { const s=String(value ?? '').slice(0,5000); return /^[=+@\-]/.test(s) ? "'"+s : s; }
function validateTicket(t) {
  if (!t || !/^[A-Za-z0-9_-]{1,100}$/.test(String(t.id)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date)) || !t.customer || !t.truck || t.hours === '' || !Number.isFinite(Number(t.hours)) || Number(t.hours)<0) throw new Error('Ticket is missing a valid ID, date, customer, truck, or hours.');
  for (const field of ['hourlyRate','permitRate']) {
    const value=t[field];
    if(value!==undefined && value!==null && value!=='' && (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(String(value)) || !Number.isFinite(Number(value)))) throw new Error('Rates must be zero or positive amounts with no more than two decimal places.');
  }
  if(Object.prototype.hasOwnProperty.call(t,'permits') && typeof t.permits!=='boolean')throw new Error('Permits must be checked or unchecked.');
  if(t.permitRate!==undefined && t.permitRate!==null && t.permitRate!=='' && t.permits!==true)throw new Error('Check Permits before entering a permit charge.');
}
function ensurePermitColumns_(sheet) {
  if(sheet.getMaxColumns()<19)sheet.insertColumnsAfter(sheet.getMaxColumns(),19-sheet.getMaxColumns());
  const headers=sheet.getRange(1,18,1,2).getValues()[0];
  const expected=['Permits','Permit rate'];
  if(expected.some((name,i)=>headers[i]!=null && headers[i]!=='' && headers[i]!==name))throw new Error('Ticket Log columns R/S contain other data. No ticket was changed.');
  if(expected.some((name,i)=>headers[i]!==name)) {
    sheet.getRange(1,18,1,2).setValues([expected]).setBackground('#343a43').setFontColor('#f2f4f7').setFontWeight('bold');
    sheet.setColumnWidth(18,100);sheet.setColumnWidth(19,140);
    sheet.getRange('R2:R').setBackground('#161c24').setFontColor('#e5e7eb');
    sheet.getRange('S2:S').setNumberFormat('$#,##0.00').setBackground('#dce1e8').setFontColor('#101216');
  }
  const existingFilter=sheet.getFilter();
  if(existingFilter) {
    const range=existingFilter.getRange();
    if(range.getRow()!==1 || range.getColumn()!==1)throw new Error('Ticket Log filter must begin at A1. No ticket was changed.');
    if(range.getNumColumns()<19) {
      const criteria=[];
      for(let c=1;c<=range.getNumColumns();c++)criteria.push(existingFilter.getColumnFilterCriteria(c));
      const height=Math.max(range.getNumRows(),sheet.getLastRow());
      existingFilter.remove();
      const replacement=sheet.getRange(1,1,height,19).createFilter();
      criteria.forEach((criterion,index)=>{if(criterion)replacement.setColumnFilterCriteria(index+1,criterion);});
    }
  }
}
function repairTruckTotals_(sheet) {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('TRUCK_TOTALS_VERSION')==='2')return;
  const last=sheet.getLastRow();
  if(last>1) {
    sheet.getRange(2,16,last-1,1).getFormulas().forEach((cells,index)=>{
      const row=index+2;
      const combined='=IF(OR(N'+row+'="",O'+row+'="",AND(R'+row+'=TRUE,S'+row+'="")),"",ROUND(N'+row+'*O'+row+'+IF(R'+row+'=TRUE,S'+row+',0),2))';
      if(cells[0]===combined)sheet.getRange(row,16).setFormula('=IF(OR(N'+row+'="",O'+row+'=""),"",ROUND(N'+row+'*O'+row+',2))');
    });
  }
  props.setProperty('TRUCK_TOTALS_VERSION','2');
}
function saveTickets(tickets) {
  if (!Array.isArray(tickets) || !tickets.length || tickets.length>200) throw new Error('Send between 1 and 200 tickets.');
  tickets.forEach(validateTicket);
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Run setupWorkbook first.');
  // Running as the visitor enforces the workbook sharing permissions for every request.
  const sheet=SpreadsheetApp.openById(id).getSheetByName('Ticket Log');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    ensurePermitColumns_(sheet);
    repairTruckTotals_(sheet);
    const count=sheet.getLastRow();
    const ids=count>1?sheet.getRange(2,1,count-1,1).getValues().flat().map(String):[];
    for (const t of tickets) {
      const idx=ids.indexOf(String(t.id)); const row=idx<0?sheet.getLastRow()+1:idx+2; const now=new Date();
      const submitted=idx<0?now:sheet.getRange(row,2).getValue();
      sheet.getRange(row,1,1,13).setValues([[String(t.id),submitted,safeCell(t.date),safeCell(t.customer),safeCell(t.job),safeCell(t.truck),safeCell(t.driver),Number(t.hours),!!t.jeep,!!t.booster,!!t.tridem,safeCell(t.work),now]]);
      // Manual billing quantity, rate and invoice assignment survive ticket updates.
      if (idx<0) { sheet.getRange(row,14).setFormula('=H'+row); ids.push(String(t.id)); }
      if(t.hourlyRate!==undefined && t.hourlyRate!==null && t.hourlyRate!=='')sheet.getRange(row,15).setValue(Number(t.hourlyRate));
      if(Object.prototype.hasOwnProperty.call(t,'permits')) {
        sheet.getRange(row,18).setValue(t.permits);
        if(!t.permits)sheet.getRange(row,19).setValue('');
        else if(t.permitRate!==undefined && t.permitRate!==null && t.permitRate!=='')sheet.getRange(row,19).setValue(Number(t.permitRate));
      } else if(idx<0)sheet.getRange(row,18).setValue(false);
      sheet.getRange(row,16).setFormula('=IF(OR(N'+row+'="",O'+row+'=""),"",ROUND(N'+row+'*O'+row+',2))');
    }
    SpreadsheetApp.flush(); return {saved:tickets.length,ticketRatesPermits:true};
  } finally {lock.releaseLock();}
}
