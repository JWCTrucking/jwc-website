const {spawnSync}=require('node:child_process');
const backend=['google-sheets/test.cjs',...['maintenance','web-submission','staff-access','quickbooks','design'].map(n=>'google-sheets/'+n+'.test.cjs'),'app/ids.test.cjs','scripts/nightly-window.test.cjs'];
const browser=['app/test.cjs',...['intro','access','forms','rates','screen','safari-compat'].map(n=>'app/'+n+'.test.cjs')];
const group=process.argv[2]||'all';
if(!['backend','browser','all'].includes(group))throw new Error('Unknown check group: '+group);
const tests=group==='all'?[...backend,...browser]:group==='backend'?backend:browser;
let failed=0;
for(const file of tests){console.log('\nChecking '+file);const r=spawnSync(process.execPath,[file],{stdio:'inherit',timeout:180000});if(r.error||r.status!==0){failed++;console.error('FAILED: '+file,r.error?.message||'');}}
console.log('\n'+(tests.length-failed)+'/'+tests.length+' check files passed.');process.exitCode=failed?1:0;
