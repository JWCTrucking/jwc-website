/** Receive form submissions from the JWC website without showing Google's hosted form UI. */
function doPost(e) {
  const allowed=['https://www.jwchauling.com','https://jwchauling.com'];
  let packet={},origin=allowed[0],result={type:'JWC_SUBMISSION_RESULT',ok:false};
  try {
    const raw=e && e.parameter && e.parameter.packet;
    if(typeof raw!=='string' || raw.length>50000)throw new Error('Invalid submission.');
    packet=JSON.parse(raw);
    if(!allowed.includes(packet.origin))throw new Error('Invalid app origin.');
    origin=packet.origin;
    if(!/^[A-Za-z0-9_-]{1,100}$/.test(String(packet.requestId||'')))throw new Error('Invalid request.');
    result.requestId=packet.requestId;
    result.id=packet.payload && packet.payload.id;
    if(packet.kind==='auth'){result.session=authenticateStaff_(packet.payload);result.staffPinAccess=true;}
    else if(packet.kind==='session'){requireStaffSession_(packet.sessionToken);result.staffPinAccess=true;}
    else if(packet.kind==='ticket'){saveTickets([packet.payload],packet.sessionToken);result.ticketRatesPermits=true;result.staffPinAccess=true;}
    else if(packet.kind==='pretrip')Object.assign(result,savePretrip(packet.payload,packet.sessionToken));
    else if(packet.kind==='maintenance'){saveMaintenance(packet.payload,packet.sessionToken);result.staffPinAccess=true;}
    else if(packet.kind==='push')qbsSavePushSubscription_(packet.payload);
    else throw new Error('Invalid submission type.');
    result.ok=true;
  } catch(error) {
    result.code=error.code||'SUBMISSION_FAILED';
    result.message=error.code?error.message:'Google Sheets could not save this submission. It is still stored on your device; please retry.';
  }
  const json=JSON.stringify(result).replace(/</g,'\\u003c');
  const target=JSON.stringify(origin);
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage('+json+','+target+');</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
