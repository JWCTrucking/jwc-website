const assert=require('node:assert/strict'),{withinWindow}=require('./nightly-window.cjs');
for(const [time,expected] of [['2026-11-06T06:59:59Z',false],['2026-11-06T07:00:00Z',true],['2026-11-20T06:59:59Z',true],['2026-11-20T07:00:00Z',false],['2027-11-06T07:00:00Z',false]])assert.equal(withinWindow(new Date(time)),expected,time);
for(let n=6;n<=19;n++)assert(withinWindow(new Date('2026-11-'+String(n).padStart(2,'0')+'T07:00:00Z')));
console.log('PASS: 14 scheduled midnights; before, after and annual recurrence excluded.');
