const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cells = new Map();
const address = (r,c) => `${r}:${c}`;
let released = 0, lastRow = 1;
const sheet = {
  getLastRow: () => lastRow,
  getRange(r,c,n=1) {
    return {
      getValues: () => Array.from({length:n},(_,i)=>[cells.get(address(r+i,c))]),
      getValue: () => cells.get(address(r,c)),
      setValue(v) { cells.set(address(r,c),v); lastRow=Math.max(lastRow,r); return this; },
      setValues(rows) { rows.forEach((row,i)=>row.forEach((v,j)=>cells.set(address(r+i,c+j),v))); lastRow=Math.max(lastRow,r+rows.length-1);return this; },
      setFormula(f) { cells.set(address(r,c),f);return this; }
    };
  }
};
const context = vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-sheet'})},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'test-sheet');return {getSheetByName:n=>{assert.equal(n,'Ticket Log');return sheet;}}},flush(){}},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})},
  console
});
vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8'),context);
const t={id:'ticket-1',date:'2026-11-05',customer:'Weaver Group Ltd',truck:'823',driver:'Driver',hours:'8.5',job:'job-1',work:'=IMPORTXML("bad")',jeep:true};
assert.equal(context.saveTickets([t]).saved,1);
assert.equal(lastRow,2);
assert.equal(cells.get('2:14'),'=H2');
assert.equal(cells.get('2:12'),'\'=IMPORTXML("bad")');
const submitted = cells.get('2:2');
cells.set('2:14',1);cells.set('2:15',250);cells.set('2:17','INV-001');
context.saveTickets([{...t,hours:'9',work:'Updated job'}]);
assert.equal(lastRow,2);assert.equal(cells.get('2:8'),9);assert.equal(cells.get('2:2'),submitted);
assert.equal(cells.get('2:14'),1);assert.equal(cells.get('2:15'),250);assert.equal(cells.get('2:17'),'INV-001');
assert.equal(cells.get('2:16'),'=IF(OR(N2="",O2=""),"",N2*O2)');
context.saveTickets([{...t,id:'ticket-2'},{...t,id:'ticket-2',hours:'10'}]);
assert.equal(lastRow,3);assert.equal(cells.get('3:8'),10);
assert.throws(()=>context.saveTickets([{...t,id:'ticket-3'},{...t,id:'bad',hours:'-1'}]));
assert.equal(lastRow,3);assert.throws(()=>context.saveTickets([]));assert.equal(released,3);
console.log('PASS: new ticket, idempotent update, billing preservation, batch deduplication, validation before writes, formula input escaping, lock release.');
