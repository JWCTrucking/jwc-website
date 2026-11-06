const fs=require('node:fs');
// The requested 14 nightly runs: November 6–19, 2026 at 06:00 UTC (midnight Alberta time, UTC−6 in this window).
// Fixed timestamps avoid differing time-zone databases between runners.
function withinWindow(now){return now>=new Date('2026-11-06T06:00:00Z')&&now<new Date('2026-11-20T06:00:00Z');}
module.exports={withinWindow};
if(require.main===module){
 const run=process.env.GITHUB_EVENT_NAME!=='schedule'||withinWindow(new Date());
 const line='run='+run+'\n';if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,line);else process.stdout.write(line);
}
