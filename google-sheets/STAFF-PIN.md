# Website staff PIN; app opens directly

The company website's **FIELD TICKETS** link asks for the four-digit staff PIN. The installed app and direct `/app/` links open all five forms without a PIN or an authentication request. This is the owner's requested website-only navigation gate: people with the app link can open and submit forms without knowing the code.

## Deploy this change

Keep the existing private `JWC_STAFF_PIN` and other Script Properties. Replace only the main **Code.gs** with the latest complete **JWC-App-Update.gs**. Leave QuickBooks and helper files alone. Save, then update the **existing** web app deployment to a **New version**, Execute as Me, access Anyone, keeping its URL. Do not run workbook setup. Updating GitHub changes the frontend but cannot update the Google deployment.

The frontend sets `app/access-config.js` to `enabled:false`. The website explicitly enables its own gate and verifies the PIN with Google's `auth` endpoint. No PIN is included in public source or stored in the browser. The successful website session token is remembered in localStorage, with sessionStorage fallback, until its existing six-hour expiry. Website returns use the unexpired token without another Google check. Cancelling sign-in aborts the pending browser request and ignores late replies.

The public POST receiver dispatches validated ticket, maintenance, pre-trip and safety submissions to private underscore-suffixed implementations without a staff token. The old public Google RPC entry points still require their staff token; this is for compatibility, not a restriction on the intentionally public app submission endpoint. No workbook/billing contents are returned. PDF/email destinations remain fixed. Owner invoice alerts and accounting retain their separate existing authorization.

A stale Google deployment may still reject app submissions with `PIN_REQUIRED`. The app preserves the draft, gives an explicit deployment-update message and does not reopen the PIN screen. Website PIN failures still report incorrect/locked/unconfigured states. Changing the PIN revokes server sessions, while an already cached website navigation session can persist until its local expiry; the app itself is public by design.

Checks cover website wrong/correct PIN, no app auth calls across all five forms, remembered website sessions, no stored PIN, cancelled in-flight sign-in, stale-backend draft retention, Safari dialog fallback, and protected legacy RPCs. Google responses are simulated locally; verify website sign-in and a real app submission after deploying.
