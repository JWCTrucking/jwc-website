/** Run once to upgrade the workbook to operational logs and QuickBooks preparation. */
function refreshWorkbookDesign() {
  const book = SpreadsheetApp.openById('1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4');
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('JWC_DESIGN_VERSION') === '2') { console.log(book.getUrl()); return book.getUrl(); }
  const log = book.getSheetByName('Ticket Log');
  if (!log) throw new Error('Ticket Log is missing. Run setupWorkbook first.');
  const headers = log.getRange(1,1,1,17).getValues()[0];
  if (headers[0] !== 'Ticket ID' || headers[14] !== 'Unit rate') throw new Error('Ticket Log columns changed. No changes made.');
  // Archive derived views rather than overwriting any notes or values entered into them.
  for (const name of ['Truck Log','Invoicing']) {
    if (book.getSheetByName(name) && book.getSheetByName(name+' (previous)')) throw new Error('An archive already exists for '+name+'. No changes made.');
  }
  if (book.getSheetByName('Billing Data') || book.getSheetByName('Overview')) throw new Error('A redesigned view already exists. No changes made.');
  for (const name of ['Truck Log','Invoicing']) {
    const old = book.getSheetByName(name);
    if (old) { old.setName(name+' (previous)'); old.hideSheet(); }
  }
  const rows=log.getMaxRows();
  log.setHiddenGridlines(true);
  log.setFrozenRows(1);
  log.setFrozenColumns(1);
  log.setTabColor('#27374d');
  log.getRange(1,1,rows,17).setFontFamily('Arial').setFontSize(10).setFontColor('#243041').setVerticalAlignment('middle');
  log.getBandings().forEach(b=>b.remove());
  styleTable_(log,1,17,rows);
  log.getRange(2,14,rows-1,2).setBackground('#fff3d5');
  log.getRange('N1').setValue('Billable hours / quantity').setNote('Follows truck hours by default. Override only when billing differs.');
  log.getRange('O1').setValue('Unit rate').setNote('Manual entry: agreed rate for this ticket.');
  log.getRange('P1').setValue('Line amount');
  log.getRange('Q1').setValue('QB invoice reference').setNote('Optional reference for later QuickBooks reconciliation. This does not sync to QuickBooks.');
  log.getRange(2,15,rows-1,2).setNumberFormat('$#,##0.00');
  log.getRange(2,8,rows-1,1).setNumberFormat('0.00');
  log.getRange(2,14,rows-1,1).setNumberFormat('0.00');
  const widths=[190,155,120,240,145,100,180,110,75,85,85,360,155,155,120,135,190];
  widths.forEach((w,i)=>log.setColumnWidth(i+1,w));
  log.getRange(2,12,rows-1,1).setWrap(true);
  const existingRules=log.getConditionalFormatRules();
  existingRules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A2<>"",$O2="")').setBackground('#fff3d5').setRanges([log.getRange(2,15,rows-1,1)]).build());
  log.setConditionalFormatRules(existingRules);
  const trucks=book.insertSheet('Truck Log');
  viewHeader_(trucks,7,'TRUCK ACTIVITY','Live job history · sorted by truck, then newest job · source: Ticket Log');
  trucks.getRange('A3').setValue('TOTAL TICKETS'); trucks.getRange('B3').setFormula('=COUNTA(\'Ticket Log\'!A2:A)');
  trucks.getRange('D3').setValue('TRUCK HOURS'); trucks.getRange('E3').setFormula('=SUM(\'Ticket Log\'!H2:H)').setNumberFormat('0.00');
  trucks.getRange('A5').setFormula('=QUERY(\'Ticket Log\'!A:Q,"select F,C,G,D,E,H,A where A is not null order by F,C desc label F \'Truck\',C \'Date\',G \'Driver\',D \'Customer\',E \'Job number\',H \'Hours\',A \'Ticket ID\'",1)');
  styleTable_(trucks,5,7,trucks.getMaxRows()-4);
  [105,125,190,260,155,110,200].forEach((w,i)=>trucks.setColumnWidth(i+1,w));
  trucks.getRange('F6:F1000').setNumberFormat('0.00');
  trucks.getRange('A5:G1000').createFilter();
  const billing=book.insertSheet('Billing Data');
  viewHeader_(billing,11,'BILLING DATA','QuickBooks preparation · edit rates in Ticket Log · no invoices are issued here');
  billing.getRange('A3').setValue('UNPRICED TICKETS'); billing.getRange('C3').setFormula('=COUNTIFS(\'Ticket Log\'!A2:A,"<>",\'Ticket Log\'!O2:O,"")');
  billing.getRange('F3').setValue('PRICED VALUE'); billing.getRange('H3').setFormula('=SUM(\'Ticket Log\'!P2:P)').setNumberFormat('$#,##0.00');
  billing.getRange('A5').setFormula('=QUERY(\'Ticket Log\'!A:Q,"select D,A,C,F,H,N,O,P,E,L,Q where A is not null order by D,C desc label D \'Customer\',A \'Ticket ID\',C \'Date\',F \'Truck\',H \'Truck hours\',N \'Billable quantity\',O \'Unit rate\',P \'Line amount\',E \'Job number\',L \'Work description\',Q \'QB reference\'",1)');
  styleTable_(billing,5,11,billing.getMaxRows()-4);
  [260,200,125,100,115,140,125,145,155,400,190].forEach((w,i)=>billing.setColumnWidth(i+1,w));
  billing.getRange('G6:H1000').setNumberFormat('$#,##0.00'); billing.getRange('E6:F1000').setNumberFormat('0.00');
  billing.getRange('J6:J1000').setWrap(true); billing.getRange('A5:K1000').createFilter();
  buildOverview_(book,log,trucks,billing);
  props.setProperty('JWC_DESIGN_VERSION','2');
  book.setActiveSheet(book.getSheetByName('Overview')); book.moveActiveSheet(1); SpreadsheetApp.flush(); console.log(book.getUrl()); return book.getUrl();
}
function viewHeader_(sheet,columns,title,subtitle) {
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(5);
  sheet.setTabColor('#61758e');
  sheet.getRange(1,1,sheet.getMaxRows(),columns).setFontFamily('Arial').setFontSize(10).setFontColor('#243041').setVerticalAlignment('middle');
  sheet.getRange(1,1,1,columns).merge().setValue('JWC  /  '+title).setBackground('#172331').setFontColor('#ffffff').setFontSize(20).setFontWeight('bold');
  sheet.getRange(2,1,1,columns).merge().setValue(subtitle).setFontColor('#64748b').setBackground('#eef2f6');
  sheet.getRange(3,1,1,columns).setBackground('#e2e8f0').setFontWeight('bold');
  sheet.setRowHeight(1,52); sheet.setRowHeight(2,34); sheet.setRowHeight(3,40); sheet.setRowHeight(4,14);
}
function styleTable_(sheet,startRow,columns,rows) {
  sheet.getRange(startRow,1,rows,columns).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,true,false).setHeaderRowColor('#27374d').setFirstRowColor('#ffffff').setSecondRowColor('#f1f5f9');
  sheet.getRange(startRow,1,1,columns).setFontWeight('bold').setFontColor('#ffffff').setWrap(true);
  sheet.setRowHeight(startRow,40); sheet.setRowHeights(startRow+1,rows-1,34);
}

function buildOverview_(book,log,trucks,billing) {
  const sheet=book.insertSheet('Overview');
  sheet.setHiddenGridlines(true); sheet.setTabColor('#172331');
  sheet.setColumnWidths(1,12,100); sheet.setRowHeights(1,22,28);
  sheet.getRange('A1:L22').setBackground('#f1f5f9').setFontFamily('Arial').setFontColor('#243041');
  sheet.getRange('A1:L4').setBackground('#08090b');
  sheet.getRange('A1:D4').merge().setFormula('=IMAGE("https://raw.githubusercontent.com/JWCTrucking/jwc-website/main/assets/jwc-logo.png",1)').setHorizontalAlignment('center');
  sheet.getRange('E1:L2').merge().setValue('OPERATIONS OVERVIEW').setFontColor('#ffffff').setFontSize(23).setFontWeight('bold').setVerticalAlignment('bottom');
  sheet.getRange('E3:L4').merge().setValue('Tickets. Truck activity. Billing data.').setFontColor('#b8c3d1').setFontSize(13).setVerticalAlignment('top');
  const cards=[['A6:D6','A7:D8','TICKETS LOGGED',"=COUNTA('Ticket Log'!A2:A)"],['E6:H6','E7:H8','TOTAL TRUCK HOURS',"=SUM('Ticket Log'!H2:H)"],['I6:L6','I7:L8','TICKETS NEEDING RATES',`=COUNTIFS('Ticket Log'!A2:A,"<>",'Ticket Log'!O2:O,"")`]];
  for (const [label,value,title,formula] of cards) {
    sheet.getRange(label).merge().setValue(title).setFontSize(11).setFontColor('#64748b').setFontWeight('bold').setBackground('#ffffff').setHorizontalAlignment('center');
    sheet.getRange(value).merge().setFormula(formula).setFontSize(30).setFontWeight('bold').setBackground('#ffffff').setHorizontalAlignment('center').setVerticalAlignment('middle').setNumberFormat(title==='TOTAL TRUCK HOURS'?'0.00':'0');
  }
  const links=[['A11:D12',log,'TICKET LOG'],['E11:H12',trucks,'TRUCK ACTIVITY'],['I11:L12',billing,'BILLING DATA']];
  links.forEach(([range,target,title])=>sheet.getRange(range).merge().setFormula('=HYPERLINK("#gid='+target.getSheetId()+'","'+title+' →")').setBackground('#27374d').setFontColor('#ffffff').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center').setVerticalAlignment('middle'));
  const notes=[['A13:D15','Enter and review tickets. Yellow cells are the editable billing quantity and rate.'],['E13:H15','Read job history by truck, driver and date. Hours update automatically from tickets.'],['I13:L15','Customer and job details, rates and amounts for billing preparation. QuickBooks is not connected yet.']];
  notes.forEach(([range,text])=>sheet.getRange(range).merge().setValue(text).setFontSize(11).setFontColor('#64748b').setWrap(true).setVerticalAlignment('top'));
  sheet.getRange('A18:L19').merge().setValue('HOW TO USE  •  Record the ticket → Review hours → Enter the agreed rate → Prepare data for QuickBooks').setBackground('#e2e8f0').setFontSize(12).setWrap(true).setVerticalAlignment('middle');
  sheet.getRange('A21:L22').merge().setValue('Live views update from Ticket Log. No customer invoices are created or sent from this workbook.').setFontSize(11).setFontColor('#64748b').setWrap(true);
}
