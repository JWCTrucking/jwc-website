"""Build the Apps Script HTML file from the current ticket app (no dependencies)."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
output = root / 'google-sheets' / 'Tickets.html'
html = (root / 'tickets' / 'index.html').read_text()
html = html.replace('<head>', '<head><base target="_top">', 1)
html = html.replace('../assets/jwc-logo.png', 'https://www.jwchauling.com/assets/jwc-logo.png')
html = html.replace('href="../"', 'href="https://www.jwchauling.com/"')
html = html.replace('Tickets are saved in this browser only. Google Sheets sync is not connected. Export CSV to keep a backup.', 'Tickets save on this device first, then send to the shared Google Sheet. Keep this page open until sending completes.')
html = html.replace("$('status').textContent='Saved on this device. Not yet sent to Google Sheets.';render()", "$('status').textContent='Saved on this device. Sending to Google Sheets…';render();google.script.run.withSuccessHandler(()=>{$('status').textContent='Saved to Google Sheets.'}).withFailureHandler(()=>{$('status').textContent='Saved on this device; Sheets upload failed. Check your Google account access and press Save ticket to retry.'}).saveTickets([t])")
html = html.replace('Saved on this device</summary>', 'Google Sheets connected</summary>')
html = html.replace("id:editing||String(Date.now())", "id:editing||crypto.randomUUID()")
assert 'google.script.run.withSuccessHandler' in html, 'Ticket save handler changed; update the Sheets adapter.'
output.write_text(html)
print(output)

# Single-file installer: one paste into Apps Script, with the current mobile form embedded.
import json
code = (root / 'google-sheets' / 'Code.gs').read_text()
code = code.replace("HtmlService.createHtmlOutputFromFile('Tickets')", 'HtmlService.createHtmlOutput(JWC_TICKET_HTML)')
bundle = root / 'google-sheets' / 'JWC-Sheets-Setup.gs'
bundle.write_text(code + '\nconst JWC_TICKET_HTML = ' + json.dumps(html) + ';\n')
print(bundle)
