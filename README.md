# JWC website and field app

Public website: https://www.jwchauling.com/

Phone app: https://www.jwchauling.com/app/

The website and installable phone app are hosted by GitHub Pages from `main`. Ticket and maintenance forms submit to the existing Google Apps Script deployment. The staff PIN is checked on Google's server; it belongs in Script Properties, never in this repository.

Employees open `/app/` in Safari on iPhone or Chrome on Android and choose **Add to Home Screen**. Open the saved icon, select Field Tickets or Maintenance, and enter the staff PIN. Stay online and wait for the submitted confirmation. Failed submissions retain the draft; reopening a saved app is not a guaranteed offline submission service. Printable instructions are in `docs/JWC-Field-App-Phone-Setup.pdf`.

## Jordan's daily routine

1. Check submitted rows in **Ticket Log** and **Maintenance Log**. Maintenance Log is created by the first successful maintenance submission.
2. Truck hours × hourly rate is the truck charge. Permits and permit cost are separate. Add missing rates before sending invoices.
3. Check **QuickBooks → To review** and customer matches. The current sync checks every minute from **5 PM to midnight, Alberta time** and maintains one open unsent invoice per customer. There is no automatic weekly cutoff; Jordan decides when to send.
4. Review the invoices in QuickBooks and send them there. A missing truck rate can create a $0 line flagged for review. Unsent invoices still affect accounts receivable.

Do not delete or reorder Ticket Log columns or edit the hidden QB Sync Log. QuickBooks edits take priority over conflicting Sheet edits. See [billing details](google-sheets/QUICKBOOKS.md).

## Updating safely

- Website/app: push reviewed changes to `main`, then check the GitHub Pages deployment. For cached app changes, update the service worker cache version.
- Google form backend: `google-sheets/JWC-App-Update.gs` replaces **Code.gs** only. Do not run initial setup against an existing workbook. See [Google backend instructions](google-sheets/README.md).
- Accounting backend: `google-sheets/QuickBooks.gs` replaces **QuickBooks.gs** only. Keep existing Script Properties and other files. Save, then update the active web deployment to **New version**. See [audit update instructions](google-sheets/QUICKBOOKS.md#updating-an-existing-installation-after-the-handoff-audit).
- Never publish OAuth secrets, Google/QB tokens, owner alert codes or the staff PIN. ChatGPT does not need to stay open for the scheduled sync to run.

## Handoff audit — 6 November 2026

Automated tests cover mobile layouts, intro and app navigation, PIN checks, confirmed ticket/maintenance submissions, draft recovery and retry IDs, separate rates and permits, Sheet write preservation, accounting calculations, customer matching, duplicate-free ordinary reruns, QuickBooks manual edits, closed invoices, and owner-only accounting entry points. Tests use simulated Google and QuickBooks services; they do not establish the state of the deployed Google project or production accounts.

Audit fixes protect accounting/setup functions from anonymous or staff RPC calls, verify scheduled trigger identities, and flag removed or late permit charges for owner review. These fixes must also be installed in the live Google project.

Before final handoff, confirm one legitimate ticket and one maintenance entry reach the live Sheet, and review that ticket's invoice after a sync. Do not send an invoice just to test it. Confirm production HTTPS and that the saved phone icon opens the current app. This workspace cannot inspect authenticated Google or QuickBooks accounts.

Backend checks: run `node google-sheets/<name>.test.cjs` for `maintenance`, `web-submission`, `staff-access`, `quickbooks`, `design`, plus `node google-sheets/test.cjs`. Browser checks use Playwright and Chromium: `app/test.cjs`, `intro.test.cjs`, `access.test.cjs`, `rates.test.cjs`, `forms.test.cjs`, `screen.test.cjs`. Run `python google-sheets/build.py` after changing bundled form/backend sources.

Nightly checks are scheduled for November 6–19, 2026 at midnight Alberta time (06:00 UTC). See [the check schedule and limits](docs/JWC-Nightly-Checks.md). Search health is included; rankings and private account state are not measurable by these checks.
