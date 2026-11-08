"""Build the Apps Script HTML file from the current ticket app (no dependencies)."""
from pathlib import Path
import re
import base64
root = Path(__file__).resolve().parents[1]
output = root / 'google-sheets' / 'Tickets.html'
html = (root / 'tickets' / 'index.html').read_text()
html = re.sub(r'<script data-hosted-tickets>.*?</script>', '', html, flags=re.S)
html = html.replace('<head>', '<head><base target="_top">', 1)
logo = 'data:image/png;base64,' + base64.b64encode((root / 'assets' / 'jwc-logo-form.png').read_bytes()).decode('ascii')
html = html.replace('../assets/jwc-logo.png', logo)
html = html.replace('href="../"', 'href="https://www.jwchauling.com/"')
html = html.replace('Tickets are saved in this browser only. Google Sheets sync is not connected. Automatic submission is not connected yet.', 'Tickets save on this device first, then send to the shared Google Sheet. Keep this page open until submitting completes.')
html = html.replace('Saved on this device</summary>', 'Google Sheets connected</summary>')
import re
adapter = """/* SHEETS_ADAPTER_START */
function deliverTicket(ticket, success, failure) {
  google.script.run.withSuccessHandler(success).withFailureHandler(failure).saveTickets([ticket]);
}
/* SHEETS_ADAPTER_END */"""
html, count = re.subn(r'/\* SHEETS_ADAPTER_START \*/.*?/\* SHEETS_ADAPTER_END \*/', lambda _: adapter, html, flags=re.S)
assert count == 1, 'Ticket adapter changed; update the Sheets build.'
maintenance_adapter = """/* MAINTENANCE_ADAPTER_START */
function deliverMaintenance(entry, success, failure) {
  google.script.run.withSuccessHandler(success).withFailureHandler(failure).saveMaintenance(entry);
}
/* MAINTENANCE_ADAPTER_END */"""
html, maintenance_count = re.subn(r'/\* MAINTENANCE_ADAPTER_START \*/.*?/\* MAINTENANCE_ADAPTER_END \*/', lambda _: maintenance_adapter, html, flags=re.S)
assert maintenance_count == 1, 'Maintenance adapter changed; update the build.'
html = html.replace('</style>', '\n' + (root / 'app' / 'form-ui.css').read_text() + '\n</style>', 1)
output.write_text(html)
print(output)

# Single-file installer: one paste into Apps Script, with the current mobile form embedded.
import json
code = (root / 'google-sheets' / 'Code.gs').read_text()
code += '\n' + (root / 'google-sheets' / 'StaffAccess.gs').read_text()
code += '\n' + (root / 'google-sheets' / 'Maintenance.gs').read_text()
code += '\n' + (root / 'app' / 'pretrip-data.js').read_text()
code += '\n' + (root / 'google-sheets' / 'Pretrip.gs').read_text()
code += '\n' + (root / 'google-sheets' / 'Safety.gs').read_text()
code += '\n' + (root / 'google-sheets' / 'WebSubmission.gs').read_text()
code += '\n' + (root / 'google-sheets' / 'Design.gs').read_text()
code = code.replace("HtmlService.createHtmlOutputFromFile('Tickets')", 'HtmlService.createHtmlOutput(JWC_TICKET_HTML)')
bundle = root / 'google-sheets' / 'JWC-Sheets-Setup.gs'
bundle.write_text(code + '\nconst JWC_TICKET_HTML = ' + json.dumps(html) + ';\n')
print(bundle)

# Form-only update for an existing project: no setup/design functions to rerun or duplicate.
runtime = (root / 'google-sheets' / 'Code.gs').read_text()
runtime = runtime[runtime.index('function doGet('):]
runtime += '\n' + (root / 'google-sheets' / 'StaffAccess.gs').read_text()
runtime += '\n' + (root / 'google-sheets' / 'Maintenance.gs').read_text()
runtime += '\n' + (root / 'app' / 'pretrip-data.js').read_text()
runtime += '\n' + (root / 'google-sheets' / 'Pretrip.gs').read_text()
runtime += '\n' + (root / 'google-sheets' / 'Safety.gs').read_text()
runtime += '\n' + (root / 'google-sheets' / 'WebSubmission.gs').read_text()
runtime = runtime.replace("HtmlService.createHtmlOutputFromFile('Tickets')", 'HtmlService.createHtmlOutput(JWC_TICKET_HTML)')
update = root / 'google-sheets' / 'JWC-App-Update.gs'
update.write_text(runtime + '\nconst JWC_TICKET_HTML = ' + json.dumps(html) + ';\n')
print(update)
