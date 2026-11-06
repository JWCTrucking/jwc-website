// Use downloaded Playwright browsers in CI and the installed Chromium locally.
const fs=require('node:fs'),playwright=require('playwright');
const name=process.env.JWC_BROWSER||'chromium';
if(!['chromium','webkit'].includes(name))throw new Error('Unsupported test browser: '+name);
const launchOptions={};
if(name==='chromium'){
 const executable=process.env.JWC_CHROMIUM_PATH||'/usr/bin/chromium';
 if(fs.existsSync(executable))launchOptions.executablePath=executable;
 launchOptions.args=['--no-sandbox'];
}
module.exports={browserType:playwright[name],launchOptions};
