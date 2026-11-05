# Google Sheets ticket workflow

This project prepares a live, authenticated version of the ticket app. The public GitHub Pages form still saves locally until the Google app is deployed; it cannot securely write to a private Google Sheet by itself.

## One-time Google setup

1. Open https://script.google.com and create a standalone project using the company's Google account.
2. Replace the default script with the complete contents of **JWC-Sheets-Setup.gs**. This single file includes both the workbook setup and the mobile ticket form. (Code.gs and Tickets.html are separate source files; do not paste them as well.)
3. Run `setupWorkbook`, authorize access, and open the workbook URL in the execution log. Running setup again returns the same workbook; it does not clear existing data.
4. Share the workbook with the staff Google accounts that may submit tickets, granting Editor access. Treat this as billing access too; a separate restricted submission service is needed if drivers must not see billing.
5. Choose **Deploy → New deployment → Web app**. Execute as **User accessing the web app**. Restrict access to your organization if available; otherwise Google accounts. Do not deploy anonymously or execute as the owner. Every user must authorize the app and have workbook edit access.
6. Send the deployed `/exec` URL back to the website maintainer so the Field Tickets link can open the connected app. Test with a staff account before switching the website link.

The connected app stores tickets locally first and confirms “Saved to Google Sheets” only after server success. A failed upload retains the local copy and can be retried with Save ticket. The public site's existing local tickets live under a different origin: export those to CSV before switching. They do not automatically migrate. Google Sheets must be available; this is not a guaranteed offline submission queue.

## Workbook tabs and billing

- **Ticket Log:** one row per ticket ID. Re-saving updates the original row. Columns N (billing quantity), O (unit rate), and Q (invoice number) are manual billing inputs. Quantity defaults to truck hours on a new ticket; use 1 for a flat charge. Rates are deliberately blank. Amount calculates quantity × rate. Billing quantity initially follows truck hours with a formula; updates to hours update the default billed quantity too. A manually overridden quantity is preserved, along with the rate and invoice assignment.
- **Truck Log:** automatically shows date, truck, driver, hours, customer, job, and ticket ID from Ticket Log.
- **Invoicing:** assign an invoice number to the required tickets in column Q, then select that number in B2. Lines, customer, subtotal, tax, and total populate. Enter invoice date, due date and applicable tax percentage manually. Tax defaults to 0, not an assumed jurisdictional rate. Use a unique invoice number per customer and check all rates before issuing. Missing rates or mixed customers show a NOT READY warning and suppress totals: resolve these before issuing. Export/print this tab after checking it. This is invoice preparation, not accounting or a frozen invoice ledger.

Keep the original Ticket Log headers and data column positions. Do not type into Truck Log or invoice line formulas. The formulas refresh from the live ticket data: retain a PDF of issued invoices.

## Updating the connected form

After changes to `tickets/index.html` or Code.gs, run `python3 google-sheets/build.py`, replace the Apps Script code with the regenerated JWC-Sheets-Setup.gs, and deploy a new version. No API keys or credentials belong in this repository.

## Validation status

The existing public ticket app's local save, reopen, update and CSV export were browser-tested. Google workbook creation, Google authorization, sheet formulas and deployed end-to-end submissions require execution in the company's Google account and have not yet been validated live.

## Local checks

Run `node google-sheets/test.cjs` for backend tests with a mocked Sheets adapter: validation, idempotency, formula escaping, and preservation of manual billing inputs. These tests do not evaluate formulas inside Google Sheets. The generated connected form was also browser-tested with a simulated Apps Script bridge for success/failure behavior; actual Google authorization and submissions remain unverified until deployment.
