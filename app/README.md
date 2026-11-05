# JWC phone app

The public website now contains Safety and Contact navigation. Staff tools are separate at `/app/`. The existing `/tickets/` Google app remains available for online ticket entry while the phone app's new authentication setup is completed.

## Current readiness

The phone app can be installed/saved to a home screen and can queue tickets and maintenance entries offline after its first successful online load. The Google browser OAuth client ID in `config.js` is intentionally blank: the phone app cannot send queued records to Google until this setting is supplied. It displays that limitation and never claims an upload succeeded. No live Google OAuth flow or real spreadsheet write has been verified from this workspace.

The existing Apps Script deployment can gain the Maintenance tab independently: replace its original Code.gs with the regenerated `google-sheets/JWC-App-Update.gs`, save, and update the existing deployment to a new version. Its maintenance sheet is created on the first valid submission. This hosted Google version requires a connection; use the phone app for a service-worker-backed offline queue.

## One-time Google browser connection

Use the company's Google Cloud project and account:

1. Enable the Google Sheets API.
2. Configure the OAuth consent screen for the JWC staff audience (Internal for the Workspace organization if supported).
3. Create an OAuth client of type **Web application**. Add `https://www.jwchauling.com` as an authorized JavaScript origin. Also add `https://jwchauling.com` only if the app will be used there. No redirect URL is required for Google's browser token client.
4. Put the public client ID in `app/config.js` as `googleClientId`. This identifier is not a password or client secret. Do not put a client secret in the website.
5. Each staff account must have Editor access to the existing workbook. Open `/app/`, tap Connect Google, and authorize Sheets access. Test a ticket and maintenance record before relying on the app.

The current staff permissions give workbook access, including billing data. Separating driver submissions from private billing requires a later server-side access design. QuickBooks is not connected.

## Daily use

- Open `/app/` in Safari (iPhone) or Chrome (Android). Use Add to Home Screen / Install app.
- Complete the Field Ticket or Maintenance form and tap Submit. A successful IndexedDB transaction is required before the form clears.
- When offline, entries are stored on that device. A pending count remains visible.
- With an unexpired Google sign-in and connectivity, the open app sends queued entries and removes each only after Google confirms the write. Reopening/focusing the app or restoring connectivity retries the queue. An expired sign-in prompts Connect Google and leaves all records queued.
- Phone browsers do not guarantee uploads while the app is closed. Reopen it when service returns. Clearing browser/app data removes locally queued entries. The first online visit must finish caching app files before offline use.

## Data and retries

Tickets use the original Ticket Log column positions. The app preserves manual rates, quantities and references; a new row defaults billed quantity to truck hours and amount to quantity × rate. Maintenance Log visibly shows Date, Truck, Service, Work done, Performed by and Odometer; technical IDs/timestamps remain hidden. It does not guess service intervals or due dates.

Each queued record has a UUID. A retry reads IDs before appending; an interrupted ticket append recovers missing billing formulas. A maintenance retry updates its existing ID. The app requests only the Sheets OAuth scope. Access tokens stay in memory and are never cached by the service worker or written to device storage. The service worker caches only app files and the logo, not Google API requests or authentication responses.

## Validation

`node app/test.cjs` uses Chromium, a local static server, and simulated Google OAuth/API responses. It verifies offline startup after caching, durable queues across reload, ticket and maintenance submission, a failed-response retry without duplicate rows, expired sign-in, unconfigured state, mobile layouts and one visible Submit button per active form. `node google-sheets/maintenance.test.cjs` checks the Apps Script maintenance writer with a mocked Sheets adapter. These are not proof of live Google authorization or actual workbook writes.
