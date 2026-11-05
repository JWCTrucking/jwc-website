# Shared four-digit staff PIN

The feature is prepared but not activated. `app/access-config.js` remains disabled until the private Google setting and deployment are ready, so existing employee access is not interrupted mid-rollout. The homepage Field Tickets link becomes visible when enabled and opens the PIN gate before the ticket screen.

## Activate

1. In the existing Apps Script project, open Project Settings → Script Properties. Set `JWC_STAFF_PIN` to the four-digit PIN chosen by the owner, as text (including any leading zero). Keep the existing SPREADSHEET_ID and QuickBooks properties. Never put the PIN in GitHub, public JavaScript, logs, or a screenshot shared publicly.
2. Replace only the original Code.gs with the generated JWC-App-Update.gs. Leave QuickBooks.gs and the separate design/helper file alone. Save and update the existing deployment to a New version, Execute as Me, access Anyone. Do not run workbook setup.
3. Set `window.JWC_ACCESS_CONFIG.enabled` to true in app/access-config.js and publish. Verify wrong PIN is denied, correct PIN opens tickets, and ticket/maintenance submissions reach the workbook.

The chosen PIN value is deliberately not included in this repository. A public deployment cannot privately configure it for its owner; this requires the signed-in Google account.

## Behavior

The PIN is checked on the Google server. Authentication returns a six-hour session token stored in tab sessionStorage; the PIN is never stored in the browser. Each submission checks the token, and direct Google RPC calls to saveTickets/saveMaintenance also require it. Changing the private PIN invalidates existing tokens. Repeated wrong attempts are temporarily blocked per device and across the project. This is shared staff submission access, not individual user accounts or permission to read billing data.

The homepage and app use the same access session. Direct links to the first-party forms are gated too. Legacy Google-hosted form URLs are not the supported PIN UI; use the JWC app. Owner invoice alerts keep their separate existing authorization.

The server fails closed if its PIN property is missing. Google Script Cache may evict a session early; in that case the app asks for the PIN again. Changing source files or pushing GitHub does not update the Google deployment or private properties.

Checks: node google-sheets/staff-access.test.cjs and node app/access.test.cjs. Tests use a fixture PIN, not the owner's PIN, and simulate Google responses. Live authorization still requires the deployment and real user test.
