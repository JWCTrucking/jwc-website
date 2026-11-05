# JWC Field App welcome screen

`/app/` is the staff home-screen entry point. A brief silver flash introduces chrome J, W, C letters, then the official logo grows to fill the screen before panning into the full hauling photograph and Welcome to JWC heading. Two buttons open Field Tickets or Maintenance. The intro runs on every fresh page load and after returning from at least five minutes in the background. There is no Skip intro button. Reduced-motion users reach the welcome screen immediately. Home-screen icons use the supplied official JWC logo. There is no form or Google sign-in control on this welcome page.

The buttons open the existing public Google Apps Script deployment with `view=tickets` or `view=maintenance`. To allow submissions without employee Google accounts, that Google deployment must be configured to execute as its owner with access set to Anyone. The repository cannot change that account setting or confirm anonymous access from this workspace.

The public company website retains Safety and Contact navigation. `/tickets/` redirects to `/app/` for compatibility with earlier setup guides. Existing shortcuts saved directly to a Google URL cannot be changed remotely; replace those shortcuts using `/app/`.

The manifest, icons, and service worker support adding the welcome screen to a phone home screen. Cached welcome assets may open offline, but forms and submissions require cell service or Wi-Fi. This release does not promise offline submission or background syncing. The unfinished Google OAuth/offline-form interface was removed from the active app at the user's request.

`node app/test.cjs` checks the welcome screen, image loading, responsive layout, both button destinations, legacy route redirect, and offline welcome behavior. Form destinations are mocked; live Google access is not established by these tests.
