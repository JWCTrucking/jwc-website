function showWorkDescription() {
  const sheet = SpreadsheetApp.openById('1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4').getSheetByName('Ticket Log');
  sheet.showColumns(12);
  sheet.setColumnWidth(12,360);
  sheet.getRange('L1').setValue('Description of work');
  sheet.getRange('L2:L').setWrap(true);
  if (sheet.getLastRow() > 1) sheet.autoResizeRows(2,sheet.getLastRow()-1);
}
