// Tests QuickBooks.gs against an in-memory Google Sheet and a simulated QuickBooks Online API.
// Proves the logic only; it does not prove a live Intuit connection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

/* ---- Fake Google Sheets ---- */
function makeSheet() {
  const cells = new Map();
  const key = (r, c) => r + ':' + c;
  const noop = new Proxy({}, {get: () => () => noop});
  const sheet = {
    cells,
    getLastRow() { let m = 0; for (const [k, v] of cells) if (v !== '' && v !== null && v !== undefined) m = Math.max(m, Number(k.split(':')[0])); return m; },
    getRange(r, c, nr = 1, nc = 1) {
      let proxy;
      const range = {
        getValues: () => Array.from({length: nr}, (_, i) => Array.from({length: nc}, (_, j) => cells.has(key(r + i, c + j)) ? cells.get(key(r + i, c + j)) : '')),
        getValue: () => cells.has(key(r, c)) ? cells.get(key(r, c)) : '',
        setValues(rows) { rows.forEach((row, i) => row.forEach((v, j) => cells.set(key(r + i, c + j), v))); return proxy; },
        setValue(v) { cells.set(key(r, c), v); return proxy; },
        clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) cells.delete(key(r + i, c + j)); return proxy; },
      };
      proxy = new Proxy(range, {get: (t, p) => p in t ? t[p] : () => proxy});
      return proxy;
    },
  };
  return new Proxy(sheet, {get: (t, p) => p in t ? t[p] : () => noop});
}
const sheets = new Map();
const book = {
  getSheetByName: n => sheets.get(n) || null,
  insertSheet(n) { const s = makeSheet(); sheets.set(n, s); return s; },
};
const ticketLog = book.insertSheet('Ticket Log');
ticketLog.getRange(1, 1, 1, 17).setValues([['Ticket ID', 'Submitted', 'Date', 'Customer', 'Job', 'Truck', 'Driver', 'Hours', 'Jeep', 'Booster', 'Tridem', 'Description of work', 'Updated', 'Qty', 'Rate', 'Total', 'QB']]);
let nextRow = 3; // Row 2 is blank in the live sheet.
function addTicket(t) {
  const row = nextRow++;
  ticketLog.getRange(row, 1, 1, 17).setValues([[t.id, '', t.date, t.customer, t.job || '', t.truck, t.driver || 'Driver', t.hours, !!t.jeep, false, false, t.work || 'Haul', '', t.hours, t.rate === undefined ? '' : t.rate, '', t.ref || '']]);
  return row;
}

/* ---- Fake QuickBooks ---- */
const qb = {
  customers: [{Id: '100000011', DisplayName: 'River Valley Energy'}, {Id: '100000001', DisplayName: 'Weaver Group Limted'}],
  items: [{Id: '1', Name: 'Services', Type: 'Service'}, {Id: '2', Name: 'Trucking', Type: 'Category'}, {Id: '3', Name: 'Truck- 820', Type: 'Service'}, {Id: '4', Name: 'Truck- 822', Type: 'Service'}],
  taxes: [{Id: '3', Name: 'GST', SalesTaxRateList: {TaxRateDetail: [{TaxRateRef: {value: '4'}}]}}, {Id: '4', Name: 'Exempt'}],
  invoices: new Map([['2', {Id: '2', SyncToken: '0', DocNumber: '1002', CustomerRef: {value: '100000011'}, Line: [], TotalAmt: 105000, Balance: 105000, EmailStatus: 'NotSet'}]]),
  nextId: 10, posts: 0,
};
// Mimics QuickBooks: tax is computed on create, but an update keeps the OLD tax unless TxnTaxDetail is sent.
function finalize(inv, keepTax) {
  let sub = 0, n = 1, taxable = 0;
  inv.Line = inv.Line.filter(l => l.DetailType !== 'SubTotalLineDetail').map(l => {
    const d = l.SalesItemLineDetail;
    if (d) assert.ok(Math.abs(d.Qty * d.UnitPrice - l.Amount) < 0.005, 'Line amount must equal qty × rate');
    sub += l.Amount;
    if (d && d.TaxCodeRef && d.TaxCodeRef.value === '3') taxable += l.Amount;
    return {...l, Id: l.Id || String(100 + qb.nextId++), LineNum: n++};
  });
  inv.Line.push({DetailType: 'SubTotalLineDetail', Amount: sub, SubTotalLineDetail: {}});
  if (!inv.TxnTaxDetail || !keepTax) inv.TxnTaxDetail = {TotalTax: Math.round(taxable * 5) / 100};
  inv.TotalAmt = Math.round((sub + inv.TxnTaxDetail.TotalTax) * 100) / 100;
  inv.Balance = inv.TotalAmt;
  return inv;
}
function api(url, opts) {
  if (url.startsWith('https://fcm.googleapis.com/')) { pushes.push({url, opts}); return {getResponseCode: () => pushStatus, getContentText: () => ''}; }
  const ok = body => ({getResponseCode: () => 200, getContentText: () => JSON.stringify(body)});
  if (url.includes('oauth2')) return ok({access_token: 'a', refresh_token: 'r', expires_in: 3600});
  const path = url.split('/company/realm1')[1].split(/[?&]minorversion/)[0];
  if (path.startsWith('/query')) {
    const sql = decodeURIComponent(path.split('query=')[1]);
    if (/FROM Customer/.test(sql)) return ok({QueryResponse: {Customer: qb.customers}});
    if (/FROM Item/.test(sql)) return ok({QueryResponse: {Item: qb.items}});
    if (/FROM TaxCode/.test(sql)) return ok({QueryResponse: {TaxCode: qb.taxes}});
    if (/FROM TaxRate WHERE Id = '4'/.test(sql)) return ok({QueryResponse: {TaxRate: [{Id: '4', Name: 'GST', RateValue: 5}]}});
    if (/FROM Invoice/.test(sql)) return ok({QueryResponse: {Invoice: [...qb.invoices.values()].map(i => ({DocNumber: i.DocNumber}))}});
  }
  if (opts.method === 'get' && path.startsWith('/invoice/')) {
    const inv = qb.invoices.get(path.split('/')[2]);
    return inv ? ok({Invoice: JSON.parse(JSON.stringify(inv))}) : {getResponseCode: () => 400, getContentText: () => JSON.stringify({Fault: {Error: [{Message: 'Object Not Found', code: '610'}]}})};
  }
  if (opts.method === 'post' && path === '/invoice') {
    qb.posts++;
    const body = JSON.parse(opts.payload);
    assert.ok(!('EmailStatus' in body) || body.EmailStatus !== 'NeedToSend', 'Must never queue an email');
    if (body.Id) {
      const cur = qb.invoices.get(body.Id);
      assert.equal(body.SyncToken, cur.SyncToken, 'Stale SyncToken');
      const inv = finalize({...cur, Line: body.Line, SyncToken: String(Number(cur.SyncToken) + 1), TxnTaxDetail: body.TxnTaxDetail || cur.TxnTaxDetail}, true);
      qb.invoices.set(inv.Id, inv);
      return ok({Invoice: inv});
    }
    const inv = finalize({...body, Id: String(qb.nextId++), SyncToken: '0', EmailStatus: 'NotSet'});
    qb.invoices.set(inv.Id, inv);
    return ok({Invoice: inv});
  }
  throw new Error('Unexpected call ' + opts.method + ' ' + path);
}

const mail = [];
const pushes = [];
let pushStatus = 201;
const nodeCrypto = require('node:crypto');
const toSigned = a => Array.from(a, v => (v & 255) > 127 ? (v & 255) - 256 : (v & 255));
const toBuf = v => typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(Array.from(v, x => x & 255));
const props = new Map([['QB_REALM_ID', 'realm1'], ['QB_REFRESH', 'r'], ['QB_ACCESS', 'a'], ['QB_EXPIRES', String(Date.now() + 3e6)]]);
const context = vm.createContext({
  SpreadsheetApp: {openById: () => book, newDataValidation: () => new Proxy({}, {get: (t, p) => () => new Proxy({}, {get: () => function () { return this; }})})},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => props.get(k) || null, setProperty: (k, v) => props.set(k, v), setProperties: o => Object.entries(o).forEach(([k, v]) => props.set(k, v)), deleteProperty: k => props.delete(k)})},
  LockService: {getScriptLock: () => ({tryLock: () => true, waitLock() {}, releaseLock() {}})},
  UrlFetchApp: {fetch: api},
  Utilities: {
    formatDate: d => d.toISOString().slice(0, 10), base64Encode: s => Buffer.from(s).toString('base64'),
    DigestAlgorithm: {SHA_256: 'sha256'}, getUuid: () => nodeCrypto.randomUUID(),
    computeDigest: (alg, v) => toSigned(nodeCrypto.createHash('sha256').update(toBuf(v)).digest()),
    computeHmacSha256Signature: (v, k) => toSigned(nodeCrypto.createHmac('sha256', toBuf(k)).update(toBuf(v)).digest()),
    base64EncodeWebSafe: b => toBuf(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    newBlob: str => ({getBytes: () => toSigned(Buffer.from(str, 'utf8'))}),
  },
  ScriptApp: {getScriptId: () => 'script1'},
  Session: {getEffectiveUser: () => ({getEmail: () => 'dispatch@jwchauling.com'})},
  MailApp: {sendEmail: m => mail.push(m)},
  console,
});
vm.runInContext(fs.readFileSync(__dirname + '/QuickBooks.gs', 'utf8'), context);
const sync = () => context.qbsSync_();
const setup = () => sheets.get('QuickBooks');
const problems = () => setup().getRange(10, 2, 50, 1).getValues().flat().filter(Boolean).join('\n');
const byDoc = doc => [...qb.invoices.values()].find(i => i.DocNumber === doc);
const lineFor = (inv, id) => inv.Line.find(l => String(l.Description || '').includes(context.qbsTag_(id)));

// Old test rows exist before go-live.
addTicket({id: 'old-weaver-test', date: '2026-11-04', customer: 'Weaver Group Ltd', truck: '822', hours: 13, rate: 375, driver: 'Jordan Cowan'});
addTicket({id: 'old-ruel-test', date: '2026-11-04', customer: 'Ruel Concrete', truck: '822', hours: 0, driver: 'SYSTEM TEST — DO NOT BILL'});
context.qbsTabs_(book);
setup().getRange(7, 2).setValue('2026-11-05');

// 1. First nightly run.
const r1 = addTicket({id: 'aaaa-1111-weaver', date: '2026-11-05', customer: 'Weaver Group Ltd', job: '1250', truck: '822', hours: 10, rate: 375, jeep: true, work: 'Mobe excavator to Km 165'});
const r2 = addTicket({id: 'bbbb-2222-river', date: '2026-11-05', customer: 'River Valley Energy Services', truck: '820', hours: 8});
addTicket({id: 'cccc-3333-unknown', date: '2026-11-05', customer: 'Ruel Concrete', truck: '822', hours: 4, rate: 200});
addTicket({id: 'dddd-4444-nobill', date: '2026-11-05', customer: 'Weaver Group Ltd', truck: '822', hours: 2, rate: 375, ref: 'NO BILL'});
sync();
const weaver = byDoc('1003'), river = byDoc('1004');
assert.ok(weaver && river, 'One new invoice per customer, numbered after 1002');
assert.equal(weaver.CustomerRef.value, '100000001', 'Weaver Group Ltd matched to "Weaver Group Limted"');
assert.equal(river.CustomerRef.value, '100000011', 'River Valley Energy Services matched');
assert.equal(weaver.Line.length, 2, 'Only the go-live Weaver ticket (not old test, not NO BILL) + subtotal');
const w1 = lineFor(weaver, 'aaaa-1111-weaver');
assert.equal(w1.SalesItemLineDetail.ItemRef.value, '4', 'Truck 822 item');
assert.equal(w1.SalesItemLineDetail.TaxCodeRef.value, '3', 'GST');
assert.equal(w1.Amount, 3750);
assert.match(w1.Description, /Job 1250 · Truck 822 · Driver · Jeep\nMobe excavator/);
assert.equal(weaver.TotalAmt, 3937.5, 'GST added');
assert.equal(weaver.GlobalTaxCalculation, 'TaxExcluded');
assert.equal(lineFor(river, 'bbbb-2222-river').SalesItemLineDetail.UnitPrice, 0, 'Missing rate goes on at $0');
assert.equal(ticketLog.getRange(r1, 17).getValue(), '1003', 'Invoice # written back to the ticket');
assert.match(problems(), /Needs a rate: River Valley/);
assert.match(problems(), /Customer "Ruel Concrete" is not matched/);
assert.equal(byDoc('1002').SyncToken, '0', 'Existing invoice #1002 untouched');

// 2. Rerun with no changes: no writes, no duplicates.
let posts = qb.posts; sync();
assert.equal(qb.posts, posts, 'Rerun is a no-op');

// 3. Next day's ticket rolls onto the same open invoice.
addTicket({id: 'eeee-5555-weaver', date: '2026-11-06', customer: 'Weaver Group Ltd', truck: '822', hours: 12, rate: 375});
sync();
assert.equal(byDoc('1003').Line.length, 3, 'Second ticket added to the same Weaver invoice');
assert.equal(byDoc('1003').TxnTaxDetail.TotalTax, 412.5, 'GST recalculated on update (3750 + 4500) × 5%');
assert.equal(byDoc('1003').TotalAmt, 8662.5);
// Stale tax left by an earlier update gets repaired even with no new tickets.
qb.invoices.get(byDoc('1003').Id).TxnTaxDetail = {TotalTax: 187.5};
let before = qb.posts; sync();
assert.equal(qb.posts, before + 1, 'Stale GST triggers a repair');
assert.equal(byDoc('1003').TxnTaxDetail.TotalTax, 412.5);
assert.ok(!byDoc('1005'), 'No extra invoice created');

// 4. Rate entered later in the sheet updates the line.
ticketLog.getRange(r2, 15).setValue(300);
sync();
const rl = lineFor(byDoc('1004'), 'bbbb-2222-river');
assert.equal(rl.SalesItemLineDetail.UnitPrice, 300);
assert.equal(rl.Amount, 2400);

// 5. Jordan edits a line and adds his own line in QuickBooks — both preserved.
const live = qb.invoices.get(byDoc('1003').Id);
lineFor(live, 'aaaa-1111-weaver').SalesItemLineDetail.UnitPrice = 400;
lineFor(live, 'aaaa-1111-weaver').Amount = 4000;
live.Line.splice(live.Line.length - 1, 0, {DetailType: 'SalesItemLineDetail', Amount: 150, Description: 'Fuel surcharge', SalesItemLineDetail: {ItemRef: {value: '1'}, Qty: 1, UnitPrice: 150}});
finalize(live); live.SyncToken = String(Number(live.SyncToken) + 1);
ticketLog.getRange(r1, 14).setValue(11);
addTicket({id: 'ffff-6666-weaver', date: '2026-11-07', customer: 'Weaver Group Ltd', truck: '822', hours: 6, rate: 375});
sync();
const w = byDoc('1003');
assert.equal(lineFor(w, 'aaaa-1111-weaver').SalesItemLineDetail.UnitPrice, 400, 'Jordan\'s QuickBooks edit kept');
assert.equal(lineFor(w, 'aaaa-1111-weaver').SalesItemLineDetail.Qty, 10);
assert.ok(w.Line.some(l => l.Description === 'Fuel surcharge'), 'Jordan\'s own line kept');
assert.ok(lineFor(w, 'ffff-6666-weaver'), 'New ticket still added');
assert.match(problems(), /Line edited in QuickBooks on invoice #1003/);

// 6. Once sent, the invoice is frozen and new tickets start a new invoice.
qb.invoices.get(w.Id).EmailStatus = 'EmailSent';
const frozen = JSON.stringify(qb.invoices.get(w.Id));
ticketLog.getRange(nextRow - 1, 14).setValue(7); // late change to a ticket on the sent invoice
addTicket({id: 'gggg-7777-weaver', date: '2026-11-08', customer: 'Weaver Group Ltd', truck: '822', hours: 9, rate: 375});
sync();
assert.equal(JSON.stringify(qb.invoices.get(w.Id)), frozen, 'Sent invoice never changed');
const next = byDoc('1005');
assert.ok(next && lineFor(next, 'gggg-7777-weaver') && next.Line.length === 2, 'New open invoice with only the new ticket');
assert.match(problems(), /changed after invoice #1003 was sent/);
assert.equal(sheets.get('QB Invoices').getRange(2, 3).getValue() === '1005' || sheets.get('QB Invoices').getRange(3, 3).getValue() === '1005', true);

// 7. Deleted invoice in QuickBooks → next ticket starts a fresh one instead of failing.
qb.invoices.delete(byDoc('1004').Id);
addTicket({id: 'hhhh-8888-river', date: '2026-11-09', customer: 'River Valley Energy Services', truck: '820', hours: 5, rate: 300});
sync();
assert.ok(byDoc('1006') && lineFor(byDoc('1006'), 'hhhh-8888-river'), 'Recovered with a new invoice');

// 8. Nightly run emails Jordan a summary only when something happened.
assert.equal(setup().getRange(8, 2).getValue(), 'dispatch@jwchauling.com', 'Summary goes to the sheet owner by default');
mail.length = 0;
addTicket({id: 'iiii-9999-weaver', date: '2026-11-10', customer: 'Weaver Group Ltd', truck: '822', hours: 4, rate: 375});
context.qbsNightlySync();
assert.equal(mail.length, 1, 'Email after invoices changed');
assert.equal(mail[0].to, 'dispatch@jwchauling.com');
assert.match(mail[0].subject, /JWC invoices updated: 1 invoice, 1 ticket/);
assert.match(mail[0].htmlBody, /Invoice #1005/);
assert.match(mail[0].htmlBody, /Nothing was sent to customers/);
assert.match(mail[0].htmlBody, /qbo\.intuit\.com\/app\/invoice\?txnId=/);
context.qbsNightlySync();
assert.equal(mail.length, 1, 'No email on a quiet night with the same review list');
props.delete('QB_REFRESH');
assert.throws(() => context.qbsNightlySync());
assert.equal(mail.length, 2, 'Failure emails Jordan');
assert.match(mail[1].subject, /FAILED/);
props.set('QB_REFRESH', 'r');

// 9. Phone alerts: keys, owner code, valid ES256 signature, ping instead of email.
const pub = context.qbsSetupPush();
const code = props.get('QB_NOTIFY_CODE');
assert.match(code, /^\d{6}$/);
assert.equal(context.qbsSetupPush(), pub, 'Keys are created once and kept');
assert.throws(() => context.qbsSavePushSubscription_({code: '000000', subscription: {endpoint: 'https://fcm.googleapis.com/fcm/send/x'}}), /Wrong owner code/);
assert.throws(() => context.qbsSavePushSubscription_({code, subscription: {endpoint: 'https://evil.example/push'}}), /Unsupported/);
context.qbsSavePushSubscription_({code, subscription: {endpoint: 'https://fcm.googleapis.com/fcm/send/jordan-phone'}});
assert.equal(pushes.length, 1, 'Test ping sent right after signing up');
const auth = pushes[0].opts.headers.Authorization;
const [, jwt, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(k, pub);
const [h, c, sig] = jwt.split('.');
const claims = JSON.parse(Buffer.from(c, 'base64url'));
assert.equal(claims.aud, 'https://fcm.googleapis.com');
const raw = Buffer.from(pub, 'base64url');
assert.equal(raw.length, 65);
const key = nodeCrypto.createPublicKey({key: {kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url')}, format: 'jwk'});
assert.ok(nodeCrypto.verify('sha256', Buffer.from(h + '.' + c), {key, dsaEncoding: 'ieee-p1363'}, Buffer.from(sig, 'base64url')), 'ES256 signature verifies with Node crypto');
for (let i = 0; i < 5; i++) { // several signatures, different messages
  const j = context.qbsVapidJwt_('https://web.push.apple.com', BigInt('0x' + props.get('QB_VAPID_D'))).split('.');
  assert.ok(nodeCrypto.verify('sha256', Buffer.from(j[0] + '.' + j[1]), {key, dsaEncoding: 'ieee-p1363'}, Buffer.from(j[2], 'base64url')));
}
mail.length = 0; pushes.length = 0;
addTicket({id: 'jjjj-1010-weaver', date: '2026-11-11', customer: 'Weaver Group Ltd', truck: '822', hours: 3, rate: 375});
context.qbsNightlySync();
assert.equal(pushes.length, 1, 'Phone pinged after invoices update');
assert.equal(mail.length, 0, 'No email when the phone ping worked');
pushStatus = 410; pushes.length = 0;
addTicket({id: 'kkkk-1111-weaver', date: '2026-11-12', customer: 'Weaver Group Ltd', truck: '822', hours: 3, rate: 375});
context.qbsNightlySync();
assert.equal(JSON.parse(props.get('QB_PUSH_SUBS')).length, 0, 'Dead phone subscription removed');
assert.equal(mail.length, 1, 'Falls back to email when no phone could be reached');

console.log('PASS: phone alerts (owner code, ES256 verified by Node crypto, ping replaces email, dead subscriptions removed). PASS: nightly summary email (on change / failure only). PASS: rolling invoice per customer, name matching, GST, skips old/test/NO BILL rows, $0 + flag for missing rates, idempotent reruns, sheet rate updates, QuickBooks edits and manual lines preserved, sent invoices frozen, deleted invoices recovered, nothing sent to customers.');
