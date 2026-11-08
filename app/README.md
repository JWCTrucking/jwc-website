# JWC Field App welcome screen

`/app/` is the staff home-screen entry point. A brief silver flash introduces chrome J, W, C letters, then the official logo grows to fill the screen before panning into the full hauling photograph and the app’s two action buttons. These buttons open Field Tickets or Maintenance. The intro runs on every fresh page load and after returning from at least five minutes in the background. There is no Skip intro button. Reduced-motion users reach the welcome screen immediately. Home-screen icons use the supplied official JWC logo. There is no form or Google sign-in control on this welcome page.

The buttons open same-origin form screens inside the app, with a back arrow returning to the main screen. Google is used only by the submission connection. To allow submissions without employee Google accounts, that Google deployment must be configured to execute as its owner with access set to Anyone. The repository cannot change that account setting or confirm anonymous access from this workspace.

The public company website retains Safety and Contact navigation. `/tickets/` redirects to `/app/` for compatibility with earlier setup guides. Existing shortcuts saved directly to a Google URL cannot be changed remotely; replace those shortcuts using `/app/`.

The manifest, icons, and service worker support adding the welcome screen to a phone home screen. Cached welcome assets may open offline, but forms and submissions require cell service or Wi-Fi. This release does not promise offline submission or background syncing. The unfinished Google OAuth/offline-form interface was removed from the active app at the user's request.

`node app/test.cjs` checks the welcome screen, image loading, responsive layout, both button destinations, legacy route redirect, and offline welcome behavior. Form destinations are mocked; live Google access is not established by these tests.

## First-party forms (activated)

`forms.html` and `forms.js` provide JWC-branded ticket and maintenance screens without Google's hosted-form banner. The owner reported deploying the backend update, and ownedFormsReady is enabled. The welcome buttons now open these screens in the app panel.

`google-sheets/WebSubmission.gs` adds the POST receiver to the existing Apps Script project. The complete `JWC-App-Update.gs` includes it and embeds the compact official logo for the legacy Google-hosted form. Deploy the updated backend as its owner with access set to Anyone. This deployment is an account-level action unavailable to this workspace.

The first-party form posts into a hidden response frame. It accepts a result only from Google's script/content origins with the matching fresh request nonce and record ID, and clears the form only on an explicit successful acknowledgment. A timeout or failure preserves the draft on the device. Google receives only submission data; the response contains no sheet contents. Allowed response target origins are limited to the JWC website hosts. This is a public submission service, not a staff authentication system.

Verify a real ticket and maintenance record reach the live workbook after the owner’s deployment, and that failed access does not clear the form. The local tests simulate the response frame, so they do not prove the live Google wrapper/frame behavior or account permissions.

The prepared native-style form screen has an app header, back arrow, grouped phone-sized fields, and a fixed Submit action. It opens in a same-origin full-screen app panel, so the public page URL remains in the installed app scope. The back arrow closes that panel. The submission listener handles Google responses sent to the top app window even when the form is nested. Live Google writes still require a real user test; the workspace cannot access the deployed receiver through its restricted network.

Installed desktop browsers that support Window Controls Overlay can use the branded app title strip; standalone is the fallback. The document title is JWC Field App. A normal browser tab still displays browser controls, and mobile/system security UI cannot be hidden by site CSS. The installed title-bar appearance needs device-specific verification.

Ticket forms now optionally accept Hourly rate, a Permits checkbox and a separate Permit rate. Hourly rate maps to Ticket Log column O; permit flag/rate map to appended R/S, preserving Q. Deploy the regenerated Google runtime for these fields. Until the receiver confirms support, submissions using the new options retain their drafts and show an incomplete-confirmation message instead of reporting full success.

## Safari compatibility

Secure request IDs fall back to `crypto.getRandomValues` if `crypto.randomUUID` is unavailable. The PIN dialog has an accessible modal fallback, and the intro supports the older media-query listener API. Fields stay disabled until initialization and PIN validation finish. Versioned scripts and revalidated app fetches reduce stale-code problems after updates.

`node app/safari-compat.test.cjs` simulates these missing browser APIs in the selected engine (Chromium by default, Chromium and WebKit in CI) and checks phone/laptop PIN entry, cancel/reopen, keyboard focus, and confirmed ticket/maintenance submissions with mocked Google responses. It does not establish compatibility with Jordan's exact Safari installation or prove live submissions to the Google deployment.

## Alberta truck & trailer pre-trip

The third home-screen action opens a daily inspection that opens without a PIN with separate tractor/trailer results for all 23 Schedule 1 systems, defect notes, inspection details and electronic signatures. It saves drafts and only reports success after the updated Google backend confirms PDF generation and email submission to `dispach@jwchauling.com`. The driver can download the same PDF for the vehicle. See [backend deployment and Alberta requirements](../google-sheets/PRETRIP.md); backend deployment and Google authorization are required before live PDF email works.

## Basic safety forms

**FLHA · Hazard Assessment** and **Toolbox Meeting** open short safety records that open without a PIN with named crew and finger/mouse signatures. Both send signed PDFs to `dispach@jwchauling.com` after the latest Google backend is deployed. See [safety form deployment](../google-sheets/SAFETY.md). These are basic small-operator records; site-specific requirements still apply.

## Website-only staff code

The company website's Field Tickets link retains the staff code popup. The app and its forms open immediately without a code or Google authentication check. The latest Google runtime must be redeployed to accept app submissions without a token; a stale backend preserves drafts and displays an update message instead of asking for a PIN. See [website PIN and public app submissions](../google-sheets/STAFF-PIN.md).
