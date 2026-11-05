/** One simple working tab. Existing tickets, formulas, rates and hidden views are preserved. */
function simplifyWorkbookView() {
  const book = SpreadsheetApp.openById('1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4');
  const sheet = book.getSheetByName('Ticket Log');
  if (!sheet || sheet.getRange('A1').getValue() !== 'Ticket ID') throw new Error('Expected Ticket Log was not found. Nothing changed.');
  sheet.showSheet();
  book.setActiveSheet(sheet);
  sheet.showColumns(1,17);
  sheet.hideColumns(1,2);   // Ticket ID and submission timestamp.
  sheet.hideColumns(7);     // Driver remains stored, but not in the billing view.
  sheet.hideColumns(9,6);  // Equipment, notes, update time and billing quantity.
  sheet.hideColumns(17);    // Future QuickBooks reference.
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(0);
  sheet.setTabColor('#27374d');
  const headers = [[3,'Date'],[4,'Customer'],[5,'Job'],[6,'Truck'],[8,'Hours'],[15,'Rate'],[16,'Total']];
  headers.forEach(([column,title])=>sheet.getRange(1,column).setValue(title));
  sheet.getRange('O1').setNote('Enter the agreed hourly rate here. For normal hourly tickets, Total = Hours × Rate.');
  sheet.getRange('P1').setNote('Calculated automatically from billing quantity × rate. Leave this formula alone.');
  const rows = sheet.getMaxRows();
  sheet.getRange(1,1,rows,17).setFontFamily('Arial').setFontSize(12).setVerticalAlignment('middle');
  sheet.getRange(1,1,1,17).setBackground('#27374d').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setRowHeight(1,44);
  sheet.setRowHeights(2,rows-1,36);
  sheet.getRange(2,15,rows-1,1).setBackground('#fff3cd').setNumberFormat('$#,##0.00');
  sheet.getRange(2,16,rows-1,1).setNumberFormat('$#,##0.00').setFontWeight('bold');
  sheet.getRange(2,8,rows-1,1).setNumberFormat('0.00');
  [[3,120],[4,260],[5,140],[6,100],[8,100],[15,120],[16,140]].forEach(([c,w])=>sheet.setColumnWidth(c,w));
  const extras=['Overview','Truck Log','Billing Data','Invoicing','Truck Log (previous)','Invoicing (previous)'];
  extras.forEach(name=>{const extra=book.getSheetByName(name);if(extra)extra.hideSheet();});
  const blank=book.getSheetByName('Sheet1');
  if(blank && blank.getLastRow()===0)blank.hideSheet();
  SpreadsheetApp.flush();
  console.log('Simple view ready: Date | Customer | Job | Truck | Hours | Rate | Total');
}
