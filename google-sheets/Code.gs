/** JWC ticket workbook and authenticated ticket app. Deploy as the user accessing the app. */
const HEADERS = ['Ticket ID','Submitted','Date','Customer','Job number','Truck','Driver','Truck hours','Jeep','Booster','Tridem','Description','Updated','Billing quantity','Unit rate','Amount','Invoice number'];
function setupWorkbook() {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty('SPREADSHEET_ID');
  if (existing) return SpreadsheetApp.openById(existing).getUrl();
  const book = SpreadsheetApp.create('JWC — Tickets, Trucks & Invoicing');
  const log = book.getSheets()[0]; log.setName('Ticket Log');
  log.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); log.setFrozenRows(1);
  log.getRange('A1:Q1').setFontWeight('bold').setBackground('#20252d').setFontColor('#ffffff');
  log.getRange('N1').setNote('Defaults to truck hours. Edit for flat or other charges; use 1 for a flat charge.');
  log.getRange('O1').setNote('Enter the agreed rate for this ticket. No rate is assumed.');
  log.getRange('Q1').setNote('Assign the same invoice number to all tickets to include on that invoice.');
  log.getRange('N2:O1000').setBackground('#fff2cc'); log.getRange('Q2:Q1000').setBackground('#fff2cc');
  log.getRange('O2:P1000').setNumberFormat('$#,##0.00');
  log.getRange('N2:O1000').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build());
  log.getRange('B2:B1000').setNumberFormat('yyyy-mm-dd hh:mm'); log.getRange('M2:M1000').setNumberFormat('yyyy-mm-dd hh:mm');
  log.getRange('A1:Q1000').createFilter(); log.autoResizeColumns(1,17); log.setColumnWidth(12,320);
  const trucks=book.insertSheet('Truck Log');
  trucks.getRange('A1').setFormula('=QUERY(\'Ticket Log\'!A:Q,"select C,F,G,H,D,E,A where A is not null order by C desc label C \'Date\',F \'Truck\',G \'Driver\',H \'Hours\',D \'Customer\',E \'Job\',A \'Ticket ID\'",1)');
  trucks.setFrozenRows(1); trucks.autoResizeColumns(1,7);
  const invoice=book.insertSheet('Invoicing');
  invoice.getRange('A1:H1').merge().setValue('JWC CONTRACTING LTD. — INVOICE').setFontWeight('bold').setFontSize(18);
  invoice.getRange('A2:A6').setValues([['Invoice number'],['Customer'],['Invoice date'],['Due date'],['Tax rate']]);
  invoice.getRange('B2').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(log.getRange('Q2:Q1000'),true).setAllowInvalid(true).build());
  invoice.getRange('B3').setFormula('=IF(B2="","",IFERROR(TEXTJOIN(", ",TRUE,UNIQUE(FILTER(\'Ticket Log\'!D2:D,\'Ticket Log\'!Q2:Q=B2))),""))');
  invoice.getRange('B6').setValue(0).setNumberFormat('0.00%').setNote('Enter the applicable tax rate. Tax is not assumed.');
  invoice.getRange('B6').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(0,1).setAllowInvalid(false).build());
  invoice.getRange('B2').setBackground('#fff2cc'); invoice.getRange('B4:B6').setBackground('#fff2cc');
  invoice.getRange('G4:G6').setValues([['Subtotal'],['Tax'],['Total']]);
  invoice.getRange('A7:H7').merge().setFormula('=IF(B2="","Select an invoice number above.",IF(COUNTIFS(\'Ticket Log\'!Q2:Q,B2,\'Ticket Log\'!O2:O,"")>0,"NOT READY: Enter a rate for every included ticket.",IF(IFERROR(COUNTA(UNIQUE(FILTER(\'Ticket Log\'!D2:D,\'Ticket Log\'!Q2:Q=B2))),0)>1,"NOT READY: Invoice number belongs to more than one customer.","Review all lines and tax before issuing.")))').setWrap(true);
  invoice.getRange('H4').setFormula('=IF(OR(B2="",LEFT(A7,9)="NOT READY"),"",SUM(H9:H))'); invoice.getRange('H5').setFormula('=IF(ISNUMBER(H4),H4*B6,"")'); invoice.getRange('H6').setFormula('=IF(ISNUMBER(H4),H4+H5,"")');
  invoice.getRange('A8:H8').setValues([['Date','Ticket ID','Job','Truck','Work','Quantity','Rate','Amount']]).setFontWeight('bold');
  invoice.getRange('A9').setFormula('=IF(B2="","",IFERROR(FILTER({\'Ticket Log\'!C2:C,\'Ticket Log\'!A2:A,\'Ticket Log\'!E2:E,\'Ticket Log\'!F2:F,\'Ticket Log\'!L2:L,\'Ticket Log\'!N2:P},\'Ticket Log\'!Q2:Q=B2,\'Ticket Log\'!A2:A<>""),""))');
  invoice.getRange('G9:H1000').setNumberFormat('$#,##0.00'); invoice.getRange('H4:H6').setNumberFormat('$#,##0.00');
  invoice.setColumnWidth(5,320); invoice.getRange('E9:E1000').setWrap(true); invoice.setFrozenRows(8);
  props.setProperty('SPREADSHEET_ID',book.getId());
  console.log('Workbook: '+book.getUrl()); return book.getUrl();
}
function doGet() { return HtmlService.createHtmlOutputFromFile('Tickets').setTitle('JWC Field Tickets').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover'); }
function safeCell(value) { const s=String(value ?? '').slice(0,5000); return /^[=+@\-]/.test(s) ? "'"+s : s; }
function validateTicket(t) {
  if (!t || !/^[A-Za-z0-9_-]{1,100}$/.test(String(t.id)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date)) || !t.customer || !t.truck || t.hours === '' || !Number.isFinite(Number(t.hours)) || Number(t.hours)<0) throw new Error('Ticket is missing a valid ID, date, customer, truck, or hours.');
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
    const count=sheet.getLastRow();
    const ids=count>1?sheet.getRange(2,1,count-1,1).getValues().flat().map(String):[];
    for (const t of tickets) {
      const idx=ids.indexOf(String(t.id)); const row=idx<0?sheet.getLastRow()+1:idx+2; const now=new Date();
      const submitted=idx<0?now:sheet.getRange(row,2).getValue();
      sheet.getRange(row,1,1,13).setValues([[String(t.id),submitted,safeCell(t.date),safeCell(t.customer),safeCell(t.job),safeCell(t.truck),safeCell(t.driver),Number(t.hours),!!t.jeep,!!t.booster,!!t.tridem,safeCell(t.work),now]]);
      // Manual billing quantity, rate and invoice assignment survive ticket updates.
      if (idx<0) { sheet.getRange(row,14).setFormula('=H'+row); ids.push(String(t.id)); }
      sheet.getRange(row,16).setFormula('=IF(OR(N'+row+'="",O'+row+'=""),"",N'+row+'*O'+row+')');
    }
    SpreadsheetApp.flush(); return {saved:tickets.length};
  } finally {lock.releaseLock();}
}
