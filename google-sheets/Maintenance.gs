/** Maintenance submissions use the same signed-in user's workbook permissions as tickets. */
function maintenanceSheet_() {
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('The ticket workbook is not configured.');
  const book=SpreadsheetApp.openById(id);
  let sheet=book.getSheetByName('Maintenance Log');
  const headers=['Date','Truck','Service','Work done','Performed by','Odometer (km)','Record ID','Submitted','Updated'];
  if (sheet) {
    const actual=sheet.getRange(1,1,1,9).getValues()[0];
    if (actual.some((v,i)=>v!==headers[i])) throw new Error('Maintenance Log columns do not match. No data changed.');
    return sheet;
  }
  sheet=book.insertSheet('Maintenance Log');
  sheet.getRange(1,1,1,9).setValues([headers]);
  sheet.setFrozenRows(1); sheet.setHiddenGridlines(true); sheet.setTabColor('#aeb6c1');
  sheet.getRange(1,1,sheet.getMaxRows(),9).setFontFamily('Arial').setFontSize(12).setFontColor('#e5e7eb').applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY,true,false).setHeaderRowColor('#343a43').setFirstRowColor('#111418').setSecondRowColor('#1b2027');
  sheet.getRange('A1:I1').setFontColor('#f2f4f7').setFontWeight('bold').setWrap(true);
  sheet.setRowHeight(1,44); sheet.setRowHeights(2,sheet.getMaxRows()-1,40);
  [125,100,160,380,190,160,180,160,160].forEach((width,i)=>sheet.setColumnWidth(i+1,width));
  sheet.getRange('D2:D').setWrap(true); sheet.getRange('F2:F').setNumberFormat('#,##0');
  sheet.getRange('H2:I').setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.hideColumns(7,3); sheet.getRange(1,1,sheet.getMaxRows(),9).createFilter();
  return sheet;
}
function validateMaintenance_(entry) {
  if (!entry || !/^[A-Za-z0-9_-]{1,100}$/.test(String(entry.id))) throw new Error('A valid maintenance ID is required.');
  const date=String(entry.date||'');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) throw new Error('Choose a valid service date.');
  for (const field of ['truck','service','work','performedBy']) if (typeof entry[field]!=='string' || !entry[field].trim() || entry[field].length>5000) throw new Error('Truck, service, work done and performed by are required.');
  if (entry.odometer!=='' && entry.odometer!=null && (!Number.isFinite(Number(entry.odometer)) || Number(entry.odometer)<0 || !Number.isInteger(Number(entry.odometer)))) throw new Error('Odometer must be a whole positive number or blank.');
}
function saveMaintenance(entry,staffSession) {
  requireStaffSession_(staffSession);
  return saveMaintenance_(entry);
}
/** Public app submission core. Private underscore prevents direct google.script.run calls. */
function saveMaintenance_(entry) {
  validateMaintenance_(entry);
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sheet=maintenanceSheet_();
    const last=sheet.getLastRow();
    const ids=last>1?sheet.getRange(2,7,last-1,1).getValues().flat().map(String):[];
    const index=ids.indexOf(String(entry.id));
    const row=index<0?last+1:index+2; const now=new Date();
    const submitted=index<0?now:sheet.getRange(row,8).getValue();
    const odometer=entry.odometer==='' || entry.odometer==null?'':Number(entry.odometer);
    sheet.getRange(row,1,1,9).setValues([[safeCell(entry.date),safeCell(entry.truck),safeCell(entry.service),safeCell(entry.work),safeCell(entry.performedBy),odometer,String(entry.id),submitted,now]]);
    SpreadsheetApp.flush(); return {saved:1};
  } finally {lock.releaseLock();}
}
