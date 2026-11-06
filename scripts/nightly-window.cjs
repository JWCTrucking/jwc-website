const fs=require('node:fs');
// The requested 14 nightly runs: November 6–19, 2026 at 07:00 UTC (midnight MST).
// Fixed timestamps avoid differing time-zone databases between runners.
function withinWindow(now){return now>=new Date('2026-11-06T07:00:00Z')&&now<new Date('2026-11-20T07:00:00Z');}
module.exports={withinWindow};
if(require.main===module){
 const run=process.env.GITHUB_EVENT_NAME!=='schedule'||withinWindow(new Date());
 const line='run='+run+'\n';if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,line);else process.stdout.write(line);
}
