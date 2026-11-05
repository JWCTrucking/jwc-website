/**
 * JWC QuickBooks Sync — rolling invoices built from the Ticket Log.
 *
 * Install as its OWN file in the Apps Script project attached to the JWC Master Tickets sheet
 * (Extensions → Apps Script). Every name here starts with "qbs" so it cannot clash with the
 * public form receiver. See google-sheets/QUICKBOOKS.md for setup.
 *
 * What it does, every night around 10 PM (Alberta time):
 *  - One open (unsent) invoice per customer. New tickets are added to it as lines.
 *  - Rate/hour changes in the sheet update that ticket's line, unless the line was edited in QuickBooks.
 *  - Lines Jordan adds or edits in QuickBooks are kept as he left them.
 *  - Once an invoice is emailed, printed, paid (even partly) or voided, it is never touched again;
 *    the customer's next tickets start a new invoice.
 *  - Nothing is ever emailed, sent or charged. Jordan reviews and sends in QuickBooks.
 */
const QBS_SHEET_ID = '1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4';
const QBS_TZ = 'America/Edmonton';
const QBS_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBS_API = 'https://quickbooks.api.intuit.com/v3/company/';
const QBS_TABS = {setup: 'QuickBooks', customers: 'QB Customers', invoices: 'QB Invoices', log: 'QB Sync Log'};
const QBS_SKIP = /SYSTEM TEST|DO NOT BILL/i;
const QBS_NOTE = 'Rolling invoice updated nightly from JWC field tickets. Not sent automatically — review and send from QuickBooks.';

/* ---------- One-time setup and menu ---------- */

function qbsSetup() {
  const book = qbsBook_();
  qbsTabs_(book);
  const handlers = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!handlers.includes('qbsOnOpen')) ScriptApp.newTrigger('qbsOnOpen').forSpreadsheet(book).onOpen().create();
  if (!handlers.includes('qbsNightlySync')) ScriptApp.newTrigger('qbsNightlySync').timeBased().atHour(22).nearMinute(0).everyDays(1).inTimezone(QBS_TZ).create();
  qbsStatus_({status: 'Setup done. Next: reload the sheet, then QuickBooks menu → Connect QuickBooks.'});
  console.log('Intuit redirect URL: ' + qbsRedirectUri_());
  return qbsRedirectUri_();
}

function qbsOnOpen() {
  SpreadsheetApp.getUi().createMenu('QuickBooks')
    .addItem('Connect QuickBooks', 'qbsConnect')
    .addItem('Sync invoices now', 'qbsSyncNow')
    .addSeparator()
    .addItem('Show Intuit redirect URL', 'qbsShowRedirect')
    .addItem('Disconnect QuickBooks', 'qbsDisconnect')
    .addToUi();
}

function qbsShowRedirect() {
  const url = qbsRedirectUri_();
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(
    '<p style="font:14px Arial">Paste this into the Intuit app under <b>Redirect URIs</b>:</p>' +
    '<textarea style="width:100%;height:70px;font:13px monospace" readonly onclick="this.select()">' + qbsEsc_(url) + '</textarea>'
  ).setWidth(460).setHeight(170), 'Intuit redirect URL');
}

function qbsConnect() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('QB_CLIENT_ID') || !p.getProperty('QB_CLIENT_SECRET')) {
    throw new Error('Add QB_CLIENT_ID and QB_CLIENT_SECRET under Project Settings → Script Properties first.');
  }
  const state = ScriptApp.newStateToken().withMethod('qbsAuthCallback').withTimeout(600).createToken();
  const url = QBS_AUTH_URL + '?' + qbsForm_({
    client_id: p.getProperty('QB_CLIENT_ID'), response_type: 'code', scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: qbsRedirectUri_(), state: state
  });
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(
    '<p style="font:14px Arial">Sign in to QuickBooks and choose <b>JWC Contracting Ltd.</b></p>' +
    '<p><a href="' + qbsEsc_(url) + '" target="_blank" style="font:bold 16px Arial">Connect QuickBooks →</a></p>'
  ).setWidth(380).setHeight(140), 'Connect QuickBooks');
}

function qbsAuthCallback(request) {
  const q = (request && request.parameter) || {};
  if (q.error || !q.code || !q.realmId) return HtmlService.createHtmlOutput('<p style="font:16px Arial">QuickBooks was not connected: ' + qbsEsc_(q.error || 'missing details') + '</p>');
  qbsSaveTokens_(qbsTokenRequest_({grant_type: 'authorization_code', code: q.code, redirect_uri: qbsRedirectUri_()}));
  const p = PropertiesService.getScriptProperties();
  p.setProperty('QB_REALM_ID', String(q.realmId));
  let name = '';
  try { name = qbsApi_('get', '/companyinfo/' + q.realmId).CompanyInfo.CompanyName; } catch (e) {}
  p.setProperty('QB_COMPANY', name);
  qbsStatus_({status: 'Connected to ' + (name || 'QuickBooks') + '. Invoices update nightly around 10 PM.', company: name});
  return HtmlService.createHtmlOutput('<p style="font:16px Arial">Connected to <b>' + qbsEsc_(name) + '</b>. You can close this tab.</p>');
}

function qbsDisconnect() {
  const p = PropertiesService.getScriptProperties();
  ['QB_ACCESS', 'QB_REFRESH', 'QB_EXPIRES', 'QB_REALM_ID', 'QB_COMPANY'].forEach(k => p.deleteProperty(k));
  qbsStatus_({status: 'Disconnected. Nightly sync will do nothing until QuickBooks is connected again.', company: ''});
}

function qbsSyncNow() {
  const summary = qbsNightlySync();
  SpreadsheetApp.getUi().alert(summary);
}

function qbsNightlySync() {
  try { return qbsSync_(); }
  catch (e) { qbsStatus_({status: 'Last sync FAILED: ' + e.message}); throw e; }
}

/* ---------- The sync ---------- */

function qbsSync_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'Another sync is already running.';
  try {
    const book = qbsBook_();
    const tabs = qbsTabs_(book);
    const problems = [];
    const qb = qbsReference_();
    const start = qbsDateStr_(tabs.setup.getRange(7, 2).getValue());
    const log = qbsReadLog_(tabs.log);
    const today = Utilities.formatDate(new Date(), QBS_TZ, 'yyyy-MM-dd');

    // 1. Which tickets are billable.
    const tickets = qbsTickets_(book).filter(t => {
      if (!t.id) return false;
      if (QBS_SKIP.test([t.customer, t.job, t.driver, t.work].join(' '))) return false;
      const prev = log.get(t.id);
      if (!prev && t.ref !== '') return false;           // Jordan typed his own reference / NO BILL.
      if (!prev && start && t.date < start) return false; // Before billing start date.
      if (!(t.qty > 0)) return false;
      return true;
    });

    // 2. Match sheet customers to QuickBooks customers.
    const map = qbsCustomerMap_(tabs.customers, [...new Set(tickets.map(t => t.customer))], qb.customers, problems);
    const groups = new Map();
    tickets.forEach(t => {
      const c = map.get(t.customer);
      if (!c) return;
      if (!groups.has(c.Id)) groups.set(c.Id, {customer: c, tickets: []});
      groups.get(c.Id).tickets.push(t);
    });

    // 3. One open invoice per customer.
    const recs = qbsReadInvoices_(tabs.invoices);
    let created = 0, updated = 0, lineCount = 0;
    for (const [qbId, group] of groups) {
      const rec = recs.get(qbId);
      let inv = null;
      if (rec && rec.invoiceId && !rec.startNew) {
        inv = qbsGetInvoice_(rec.invoiceId);
        if (inv && qbsClosed_(inv)) {
          qbsWriteInvoiceRec_(tabs.invoices, recs, qbId, [group.customer.DisplayName, qbId, rec.doc, rec.invoiceId, 'Sent / closed — next tickets start a new invoice', false, new Date()]);
          inv = null;
        }
      }
      const lines = inv ? (inv.Line || []).filter(l => l.DetailType !== 'SubTotalLineDetail').map(qbsCleanLine_) : [];
      const touched = [];
      for (const t of group.tickets) {
        const want = qbsLine_(t, qb);
        const prev = log.get(t.id);
        if (want.rate === 0 && !prev) problems.push('Needs a rate: ' + t.customer + ' · ' + t.date + ' · truck ' + t.truck + ' (added at $0 — enter the rate in the sheet or on the invoice).');
        if (!prev) { lines.push(want.line); touched.push([t, want]); continue; }
        if (!qbsDiffers_(prev, want)) continue;
        const where = '#' + (prev.doc || prev.invoiceId);
        if (!inv || prev.invoiceId !== String(inv.Id)) { problems.push('Ticket changed after invoice ' + where + ' was sent/closed — not updated: ' + t.customer + ' · ' + t.date + ' · truck ' + t.truck + '.'); continue; }
        const line = lines.find(l => String(l.Description || '').includes(qbsTag_(t.id)));
        if (!line) { problems.push('Ticket was removed from invoice ' + where + ' in QuickBooks — not re-added: ' + t.customer + ' · ' + t.date + '.'); continue; }
        const d = line.SalesItemLineDetail || {};
        if (!qbsSame_(d.Qty, prev.qty) || !qbsSame_(d.UnitPrice, prev.rate)) { problems.push('Line edited in QuickBooks on invoice ' + where + ' — sheet change not applied: ' + t.customer + ' · ' + t.date + '.'); continue; }
        d.Qty = want.qty; d.UnitPrice = want.rate; line.Amount = want.amount;
        if (qbsNorm_(line.Description) === qbsNorm_(prev.desc)) line.Description = want.desc;
        touched.push([t, want]);
      }
      if (!touched.length) continue;

      let saved;
      if (inv) {
        saved = qbsApi_('post', '/invoice', {Id: inv.Id, SyncToken: inv.SyncToken, sparse: true, Line: lines}).Invoice;
        updated++;
      } else {
        saved = qbsApi_('post', '/invoice', {
          CustomerRef: {value: qbId}, DocNumber: qbsNextDocNumber_(), TxnDate: today,
          GlobalTaxCalculation: 'TaxExcluded', PrivateNote: QBS_NOTE, Line: lines
        }).Invoice;
        created++;
      }
      const doc = String(saved.DocNumber || saved.Id);
      touched.forEach(([t, want]) => {
        qbsWriteLog_(tabs.log, log, t.id, [t.id, String(saved.Id), doc, want.qty, want.rate, want.desc, new Date()]);
        book.getSheetByName('Ticket Log').getRange(t.row, 17).setValue(doc);
      });
      lineCount += touched.length;
      qbsWriteInvoiceRec_(tabs.invoices, recs, qbId, [group.customer.DisplayName, qbId, doc, String(saved.Id), 'Open — not sent. Total $' + Number(saved.TotalAmt || 0).toFixed(2), false, new Date()]);
    }

    const summary = created + ' new invoice(s), ' + updated + ' updated, ' + lineCount + ' ticket line(s) added/changed. ' + (problems.length ? problems.length + ' item(s) to review below.' : 'Nothing to review.');
    qbsStatus_({status: 'Last sync OK.', summary: summary, problems: problems, ran: new Date()});
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function qbsLine_(t, qb) {
  const qty = Number(t.qty);
  const rate = t.rate === null ? 0 : Number(t.rate);
  const amount = Math.round(qty * rate * 100) / 100;
  const extras = [t.jeep && 'Jeep', t.booster && 'Booster', t.tridem && 'Tridem'].filter(Boolean);
  let head = [t.date, t.job && ('Job ' + t.job), 'Truck ' + t.truck, t.driver].filter(Boolean).join(' · ');
  if (extras.length) head += ' · ' + extras.join(', ');
  const desc = (head + '\n' + String(t.work || '').trim()).slice(0, 3900) + '\nRef ' + qbsTag_(t.id);
  const item = qbsItemFor_(t.truck, qb.items);
  return {qty, rate, amount, desc, line: {
    DetailType: 'SalesItemLineDetail', Amount: amount, Description: desc,
    SalesItemLineDetail: {ItemRef: {value: String(item.Id)}, Qty: qty, UnitPrice: rate, ServiceDate: t.date, TaxCodeRef: {value: String(qb.gst)}}
  }};
}

function qbsItemFor_(truck, items) {
  const digits = String(truck).replace(/\D/g, '');
  const services = items.filter(i => i.Type === 'Service');
  return (digits && services.find(i => String(i.Name).replace(/\D/g, '') === digits))
    || services.find(i => /^services$/i.test(i.Name)) || services[0];
}

function qbsClosed_(inv) {
  return inv.EmailStatus === 'EmailSent' || inv.PrintStatus === 'PrintComplete'
    || Number(inv.Balance) < Number(inv.TotalAmt) || /void/i.test(inv.PrivateNote || '');
}

/* ---------- Sheet helpers ---------- */

function qbsBook_() { return SpreadsheetApp.openById(QBS_SHEET_ID); }

function qbsTickets_(book) {
  const sheet = book.getSheetByName('Ticket Log');
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const yes = v => v === true || String(v).toUpperCase() === 'TRUE';
  return sheet.getRange(2, 1, last - 1, 17).getValues().map((r, i) => ({
    row: i + 2, id: String(r[0]).trim(), date: qbsDateStr_(r[2]), customer: String(r[3]).trim(), job: String(r[4]).trim(),
    truck: String(r[5]).trim(), driver: String(r[6]).trim(), jeep: yes(r[8]), booster: yes(r[9]), tridem: yes(r[10]),
    work: String(r[11]), qty: r[13] === '' ? Number(r[7]) : Number(r[13]), rate: r[14] === '' || r[14] === null ? null : Number(r[14]),
    ref: String(r[16] === null || r[16] === undefined ? '' : r[16]).trim()
  }));
}

function qbsTabs_(book) {
  const make = (name, headers, widths) => {
    let s = book.getSheetByName(name);
    if (s) return s;
    s = book.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setBackground('#343a43').setFontColor('#f2f4f7').setFontWeight('bold');
    s.setFrozenRows(1);
    s.setTabColor('#aeb6c1');
    widths.forEach((w, i) => s.setColumnWidth(i + 1, w));
    return s;
  };
  let setup = book.getSheetByName(QBS_TABS.setup);
  if (!setup) {
    setup = book.insertSheet(QBS_TABS.setup);
    setup.getRange(1, 1, 8, 2).setValues([
      ['JWC  /  QUICKBOOKS', ''], ['', ''], ['Status', 'Not connected'], ['QuickBooks company', ''],
      ['Last sync', ''], ['Result', ''], ['Bill tickets dated on or after', Utilities.formatDate(new Date(), QBS_TZ, 'yyyy-MM-dd')], ['', '']
    ]);
    setup.getRange(9, 1).setValue('To review');
    setup.getRange(1, 1, 60, 2).setBackground('#111418').setFontColor('#e5e7eb').setFontFamily('Arial');
    setup.getRange(1, 1).setFontSize(18).setFontWeight('bold');
    setup.getRange(3, 1, 7, 1).setFontWeight('bold');
    setup.getRange(7, 2).setBackground('#dce1e8').setFontColor('#101216').setNote('Tickets dated before this are never sent to QuickBooks. Format: 2026-11-05');
    setup.setColumnWidth(1, 260);
    setup.setColumnWidth(2, 640);
    setup.setTabColor('#aeb6c1');
  }
  const customers = make(QBS_TABS.customers, ['Customer on tickets', 'QuickBooks customer', 'QuickBooks ID'], [260, 260, 120]);
  const invoices = make(QBS_TABS.invoices, ['QuickBooks customer', 'QuickBooks ID', 'Open invoice #', 'Invoice ID', 'Status', 'Start a new invoice next sync', 'Last updated'], [240, 110, 120, 100, 340, 200, 160]);
  const log = book.getSheetByName(QBS_TABS.log) || (() => { const s = make(QBS_TABS.log, ['Ticket ID', 'Invoice ID', 'Invoice #', 'Qty', 'Rate', 'Line description', 'Synced'], [280, 100, 100, 80, 80, 400, 160]); s.hideSheet(); return s; })();
  return {setup, customers, invoices, log};
}

function qbsCustomerMap_(sheet, names, qbCustomers, problems) {
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, 3).getValues() : [];
  const byName = new Map();
  rows.forEach((r, i) => { if (String(r[0]).trim()) byName.set(String(r[0]).trim(), {row: i + 2, qbName: String(r[1]).trim()}); });
  for (const name of names) {
    if (byName.has(name)) continue;
    const guess = qbsGuessCustomer_(name, qbCustomers);
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 3).setValues([[name, guess ? guess.DisplayName : '', guess ? String(guess.Id) : '']]);
    byName.set(name, {row: row, qbName: guess ? guess.DisplayName : ''});
  }
  const list = qbCustomers.map(c => c.DisplayName).sort();
  if (list.length) sheet.getRange(2, 2, Math.max(sheet.getLastRow() - 1, 1), 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(true).build());
  const out = new Map();
  for (const name of names) {
    const rec = byName.get(name);
    const c = qbCustomers.find(x => String(x.DisplayName).toLowerCase() === rec.qbName.toLowerCase());
    if (!c) { problems.push('Customer "' + name + '" is not matched to a QuickBooks customer — pick one in the QB Customers tab. Its tickets were skipped.'); continue; }
    sheet.getRange(rec.row, 3).setValue(String(c.Id));
    out.set(name, c);
  }
  return out;
}

function qbsGuessCustomer_(name, customers) {
  const core = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w && !['ltd', 'limited', 'inc', 'corp', 'co', 'the', 'services', 'service'].includes(w)).slice(0, 2).join(' ');
  const key = core(name);
  if (!key) return null;
  const hits = customers.filter(c => core(c.DisplayName) === key);
  return hits.length === 1 ? hits[0] : null;
}

function qbsReadLog_(sheet) {
  const m = new Map();
  const last = sheet.getLastRow();
  if (last < 2) return m;
  sheet.getRange(2, 1, last - 1, 6).getValues().forEach((r, i) => {
    if (String(r[0])) m.set(String(r[0]), {row: i + 2, invoiceId: String(r[1]), doc: String(r[2]), qty: Number(r[3]), rate: Number(r[4]), desc: String(r[5])});
  });
  return m;
}

function qbsWriteLog_(sheet, log, id, values) {
  const prev = log.get(id);
  const row = prev ? prev.row : sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 7).setValues([values]);
  log.set(id, {row, invoiceId: values[1], doc: values[2], qty: values[3], rate: values[4], desc: values[5]});
}

function qbsReadInvoices_(sheet) {
  const m = new Map();
  const last = sheet.getLastRow();
  if (last < 2) return m;
  sheet.getRange(2, 1, last - 1, 6).getValues().forEach((r, i) => {
    if (String(r[1])) m.set(String(r[1]), {row: i + 2, doc: String(r[2]), invoiceId: String(r[3]), startNew: r[5] === true || String(r[5]).toUpperCase() === 'TRUE'});
  });
  return m;
}

function qbsWriteInvoiceRec_(sheet, recs, qbId, values) {
  const prev = recs.get(qbId);
  const row = prev ? prev.row : sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 7).setValues([values]);
  sheet.getRange(row, 6).insertCheckboxes();
  recs.set(qbId, {row, doc: values[2], invoiceId: values[3], startNew: false});
}

function qbsStatus_(s) {
  const sheet = qbsTabs_(qbsBook_()).setup;
  if (s.status !== undefined) sheet.getRange(3, 2).setValue(s.status);
  if (s.company !== undefined) sheet.getRange(4, 2).setValue(s.company);
  if (s.ran) sheet.getRange(5, 2).setValue(Utilities.formatDate(s.ran, QBS_TZ, 'yyyy-MM-dd h:mm a'));
  if (s.summary !== undefined) sheet.getRange(6, 2).setValue(s.summary);
  if (s.problems) {
    sheet.getRange(10, 1, 50, 2).clearContent();
    const list = (s.problems.length ? s.problems : ['Nothing to review.']).slice(0, 50);
    sheet.getRange(10, 1, list.length, 2).setValues(list.map(p => ['•', p]));
  }
}

/* ---------- QuickBooks API ---------- */

function qbsReference_() {
  const customers = qbsQuery_("SELECT Id, DisplayName FROM Customer WHERE Active = true MAXRESULTS 1000").Customer || [];
  const items = qbsQuery_("SELECT Id, Name, Type FROM Item WHERE Active = true MAXRESULTS 1000").Item || [];
  const gst = (qbsQuery_("SELECT Id, Name FROM TaxCode").TaxCode || []).find(t => t.Name === 'GST');
  if (!gst) throw new Error('No tax code named "GST" was found in QuickBooks.');
  if (!items.some(i => i.Type === 'Service')) throw new Error('No service items found in QuickBooks.');
  return {customers, items, gst: gst.Id};
}

function qbsGetInvoice_(id) {
  try { return qbsApi_('get', '/invoice/' + encodeURIComponent(id)).Invoice; }
  catch (e) { if (/not found|deleted|610/i.test(e.message)) return null; throw e; }
}

function qbsNextDocNumber_() {
  const list = qbsQuery_("SELECT DocNumber FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 200").Invoice || [];
  const nums = list.map(i => Number(i.DocNumber)).filter(n => Number.isFinite(n) && n > 0);
  return String(nums.length ? Math.max.apply(null, nums) + 1 : 1001);
}

function qbsQuery_(sql) { return qbsApi_('get', '/query?query=' + encodeURIComponent(sql)).QueryResponse || {}; }

function qbsApi_(method, path, body, retried) {
  const realm = PropertiesService.getScriptProperties().getProperty('QB_REALM_ID');
  if (!realm) throw new Error('QuickBooks is not connected. Use QuickBooks menu → Connect QuickBooks.');
  const opts = {method: method, muteHttpExceptions: true, headers: {Authorization: 'Bearer ' + qbsAccessToken_(!!retried), Accept: 'application/json'}};
  if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(QBS_API + realm + path + (path.includes('?') ? '&' : '?') + 'minorversion=75', opts);
  const code = res.getResponseCode();
  if (code === 401 && !retried) return qbsApi_(method, path, body, true);
  const text = res.getContentText();
  let data = {};
  try { data = JSON.parse(text); } catch (e) {}
  if (code >= 300 || data.Fault) {
    const f = data.Fault && data.Fault.Error && data.Fault.Error[0];
    throw new Error('QuickBooks error ' + code + ': ' + (f ? f.Message + ' ' + (f.Detail || '') + ' (' + (f.code || '') + ')' : text.slice(0, 300)));
  }
  return data;
}

function qbsAccessToken_(force) {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('QB_REFRESH')) throw new Error('QuickBooks is not connected. Use QuickBooks menu → Connect QuickBooks.');
  if (force || Date.now() > Number(p.getProperty('QB_EXPIRES') || 0)) {
    qbsSaveTokens_(qbsTokenRequest_({grant_type: 'refresh_token', refresh_token: p.getProperty('QB_REFRESH')}));
  }
  return p.getProperty('QB_ACCESS');
}

function qbsTokenRequest_(form) {
  const p = PropertiesService.getScriptProperties();
  const basic = Utilities.base64Encode(p.getProperty('QB_CLIENT_ID') + ':' + p.getProperty('QB_CLIENT_SECRET'));
  const res = UrlFetchApp.fetch(QBS_TOKEN_URL, {method: 'post', payload: form, muteHttpExceptions: true, headers: {Authorization: 'Basic ' + basic, Accept: 'application/json'}});
  let body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  if (res.getResponseCode() !== 200 || !body.access_token) {
    throw new Error('QuickBooks sign-in expired or failed (' + (body.error || res.getResponseCode()) + '). Use QuickBooks menu → Connect QuickBooks.');
  }
  return body;
}

function qbsSaveTokens_(t) {
  const p = PropertiesService.getScriptProperties();
  const props = {QB_ACCESS: t.access_token, QB_EXPIRES: String(Date.now() + ((Number(t.expires_in) || 3600) - 120) * 1000)};
  if (t.refresh_token) props.QB_REFRESH = t.refresh_token;
  p.setProperties(props);
}

/* ---------- Small utilities ---------- */

function qbsRedirectUri_() { return 'https://script.google.com/macros/d/' + ScriptApp.getScriptId() + '/usercallback'; }
function qbsTag_(id) { return 'JWC-' + String(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 10); }
function qbsNorm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function qbsSame_(a, b) { return Math.abs(Number(a) - Number(b)) < 0.0001; }
function qbsDiffers_(prev, want) { return !qbsSame_(prev.qty, want.qty) || !qbsSame_(prev.rate, want.rate) || qbsNorm_(prev.desc) !== qbsNorm_(want.desc); }
function qbsDateStr_(v) {
  if (v instanceof Date || (v && typeof v.getTime === 'function')) return Utilities.formatDate(v, QBS_TZ, 'yyyy-MM-dd');
  return String(v || '').trim().slice(0, 10);
}
function qbsCleanLine_(l) {
  const c = JSON.parse(JSON.stringify(l));
  delete c.CustomExtensions;
  delete c.LineNum;
  if (c.SalesItemLineDetail) delete c.SalesItemLineDetail.ItemAccountRef;
  return c;
}
function qbsForm_(o) { return Object.keys(o).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&'); }
function qbsEsc_(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }
