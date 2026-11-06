const {spawnSync}=require('node:child_process');
const backend=['google-sheets/test.cjs',...['maintenance','web-submission','staff-access','quickbooks','design'].map(n=>'google-sheets/'+n+'.test.cjs'),'app/ids.test.cjs','scripts/nightly-window.test.cjs'];
const browser=['app/test.cjs',...['intro','access','forms','rates','screen','safari-compat'].map(n=>'app/'+n+'.test.cjs')];
const group=process.argv[2]||'all';
if(!['backend','browser','all'].includes(group))throw new Error('Unknown check group: '+group);
const tests=group==='all'?[...backend,...browser]:group==='backend'?backend:browser;
let failed=0;
for(const file of tests){console.log('\nChecking '+file);const r=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:180000,maxBuffer:10000000});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.error||r.status!==0){failed++;console.error('FAILED: '+file,r.error?.message||'');if(process.env.GITHUB_ACTIONS==='true'){const detail=(r.error?.message||r.stderr||r.stdout||'Check failed').slice(-4000).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');console.log('::error file='+file+',title=Failed check: '+file+'::'+detail);}}}
console.log('\n'+(tests.length-failed)+'/'+tests.length+' check files passed.');process.exitCode=failed?1:0;
