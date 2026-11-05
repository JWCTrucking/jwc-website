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
