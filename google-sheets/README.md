# Google Sheets ticket workflow

## Current deployment: fixing the old PIN error

The first-party app at https://www.jwchauling.com/app/ intentionally requires no PIN. A deployed script that replies `PIN_REQUIRED` is stale. Replace the existing main **Code.gs** contents with the complete **JWC-App-Update.gs** from this folder. Keep separate QuickBooks/helper files and all script properties. Do not paste the update beside the old Code.gs and do not run workbook setup.

Save, then **Deploy → Manage deployments → pencil on the existing web app → Version: New version → Deploy**. The web app must execute as the owner and allow Anyone. Keep the existing deployment URL. Saving the editor alone does not update the live app. After deployment, reopen the field ticket and tap Submit once; its saved ID is reused to avoid a duplicate row.

The updated receiver also accepts a read-only `health` packet and reports `appWithoutPin: true`; no spreadsheet row is created. The website autosaves ticket and maintenance drafts on input and keeps them after a PIN/deployment failure.

## Original authenticated setup (historical)

The instructions below describe the original Google-hosted version; use the current deployment instructions above for the public first-party app.


This project prepares a live, authenticated version of the ticket app. The website and /tickets/ entry point now open the supplied Google Apps Script deployment. Google sign-in and workbook edit access are required. This repository does not automatically deploy updated Apps Script code.

## One-time Google setup

1. Open https://script.google.com and create a standalone project using the company's Google account.
2. Replace the default script with the complete contents of **JWC-Sheets-Setup.gs**. This single file includes both the workbook setup and the mobile ticket form. (Code.gs and Tickets.html are separate source files; do not paste them as well.)
3. Run `setupWorkbook` and authorize access. The script adds the three tabs to the supplied JWC workbook: https://docs.google.com/spreadsheets/d/1-9vgsLWZLjXDXYxb24oecuvYh8_C2Nr2NtXJ1RKxTE4/edit . Existing tabs are preserved, and conflicting tab names stop setup before changes. Running setup again returns the same workbook; it does not clear existing data.
4. Share the workbook with the staff Google accounts that may submit tickets, granting Editor access. Treat this as billing access too; a separate restricted submission service is needed if drivers must not see billing.
5. Choose **Deploy → New deployment → Web app**. Execute as **User accessing the web app**. Restrict access to your organization if available; otherwise Google accounts. Do not deploy anonymously or execute as the owner. Every user must authorize the app and have workbook edit access.
6. Send the deployed `/exec` URL back to the website maintainer so the Field Tickets link can open the connected app. Test with a staff account before switching the website link.

The connected app stores tickets locally first and confirms “Saved to Google Sheets” only after server success. A failed upload retains the local copy and can be retried with Save ticket. The public site's existing local tickets live under a different origin: export those to CSV before switching. They do not automatically migrate. Google Sheets must be available; this is not a guaranteed offline submission queue.

## Workbook tabs and billing

- **Overview:** JWC logo, ticket count, total truck hours, unpriced tickets, and links to the main logs.
- **Ticket Log:** the source data. Billable quantity follows hours by default; the app’s optional hourly rate fills the existing Rate column (O); blank app rates preserve existing Sheet rates. The truck amount is quantity × truck hourly rate only. Permit cost stays separate. Rate and quantity overrides survive ticket updates. Column Q is an optional QuickBooks reference.
- **Truck Log:** styled live activity, sorted by truck and date, with total tickets and hours.
- **Billing Data:** customer, ticket, date, truck, hours, quantity, rate, amount, job description and optional QuickBooks reference. This is preparation data, not an invoice or a confirmed QuickBooks import format. No accounting connection has been deployed.

Existing installations: add the contents of Design.gs as a new Apps Script file and run `refreshWorkbookDesign`. Existing Truck Log and Invoicing tabs are archived and hidden, not deleted; original ticket data and manual rates are preserved. The update stops before making changes if conflicting archive/view names already exist. Running after a successful update returns without repeating it. The logo uses a public image URL via Sheets IMAGE, so external image access must be allowed if Google prompts.

Keep Ticket Log data columns in their original positions. Edit billing inputs there, not in the automatically generated views. Blank rates remain unpriced rather than implying a free haul. Driver and billing access are still shared at workbook level; a separate access design is required to hide rates from drivers.

## Updating the connected form

After changes to `tickets/index.html` or Code.gs, run `python3 google-sheets/build.py`, replace the Apps Script code with the regenerated JWC-Sheets-Setup.gs, and deploy a new version. No API keys or credentials belong in this repository.

## Validation status

The existing public ticket app's local save, reopen, update and CSV export were browser-tested. Google workbook creation, Google authorization, sheet formulas and deployed end-to-end submissions require execution in the company's Google account and have not yet been validated live.

## Local checks

Run `node google-sheets/test.cjs` for backend tests with a mocked Sheets adapter: validation, idempotency, formula escaping, and preservation of manual billing inputs. These tests do not evaluate formulas inside Google Sheets. The generated connected form was also browser-tested with a simulated Apps Script bridge for success/failure behavior; actual Google authorization and submissions remain unverified until deployment.

## Current deployment

The website navigation and /tickets/ route open the supplied Google deployment. The generated Tickets.html now has one Submit button and no history, print, new-ticket or export controls. It retains browser-local backups, retries failed submissions using the same ticket ID, and clears the form only after confirmed server success.

For this existing Apps Script project, replace only the original Code.gs with JWC-App-Update.gs, save, then use Deploy → Manage deployments → edit the existing web app → New version → Deploy. Leave the separate design/simplification file alone. The form-only update does not rerun workbook setup, change spreadsheet contents, or change the deployment URL. Existing script properties remain in the project. Do not add the update as a second file alongside the original Code.gs, because it replaces the original runtime functions.

Browser checks used a simulated Google bridge and mocked launch destination. Live Google authorization and a real submission into the workbook still require verification after updating the deployed version. The repository cannot update Google Apps Script deployments automatically.

## JWC-only forms and broken logo correction

The compact official logo is embedded directly in the generated Google-hosted HTML so it does not depend on the company's public image URL loading inside Google. This correction requires deploying the regenerated app update.

To keep Google branding out of the employee screen, a first-party form is prepared at `/app/forms.html`. Its `doPost` receiver lives in WebSubmission.gs and is also included in JWC-App-Update.gs. The owner reported deploying the new receiver, and ownedFormsReady is now enabled so the two buttons open embedded first-party app screens. Execute as the owner with access Anyone; verify live submissions reach the workbook. No OAuth browser client ID is needed for this approach.

## Optional hourly and permit rates

The ticket form now has Hourly rate, Permits, and a separate Permit rate. Hourly rate writes to the existing Rate column O. Columns R (Permits) and S (Permit rate) are appended; Q remains the QuickBooks reference. Permit rate is one charge for that ticket, not multiplied by truck hours. Blank optional rates preserve existing manually entered rates. Explicit zero is accepted. Unchecking Permits clears its charge. New/updated truck row totals remain blank when the hourly rate is missing. Permit cost never changes the hourly rate or truck total. The next accepted submission repairs only the exact older combined-total formulas; other manual formulas are preserved. Existing rows are not bulk-rewritten. The existing table filter is expanded through S while preserving its criteria so permit values sort with the rest of each row.

Deploy the regenerated JWC-App-Update.gs in the existing Google project to accept the new fields. Its response confirms ticketRatesPermits support. The app retains the draft and reports an incomplete rate/permit confirmation if an older backend ignores these options; it does not silently clear that data. No workbook setup/reset is needed; headers appear automatically on the next accepted submission.
