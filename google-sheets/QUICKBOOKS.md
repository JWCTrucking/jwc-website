# QuickBooks rolling invoices

`QuickBooks.gs` builds JWC's QuickBooks invoices from the **Ticket Log** every night around 10 PM (Alberta time). It runs entirely inside JWC's own Google account and talks directly to JWC's own QuickBooks Online company. No AI, Claude, ChatGPT or paid service is needed for it to run.

## How it behaves

- **One open invoice per customer.** Each night, new tickets are added as lines to that customer's open invoice. Jordan can send it after one day or after a week — whenever he wants.
- **Never sends anything.** Invoices are created unsent. Jordan reviews, edits and sends from QuickBooks.
- Unsent invoices still show as money owed (accounts receivable) in QuickBooks. QuickBooks Online has no true "draft".
- **After an invoice is emailed, printed, paid (even partly) or voided, it is never changed again.** That customer's next tickets start a new invoice.
- To start a fresh invoice for a customer without sending the current one, tick **Start a new invoice next sync** in the **QB Invoices** tab.
- **Each line:** the truck's item (e.g. "Truck- 822"), quantity = billing quantity (hours), rate from the sheet, GST, the ticket date, and a description (date · job · truck · driver · Jeep/Booster/Tridem, then the work description, then a short `Ref JWC-…` tag used to find the line again). Leave the `Ref` tag in place.
- **Rates:** enter them in the sheet (Rate column) or on the invoice in QuickBooks. A ticket with no rate goes on at $0 and is listed under *To review*. A rate typed in the sheet later updates the line, as long as the line was not edited in QuickBooks.
- **Edits made in QuickBooks win.** If Jordan changes a line's quantity or rate, or adds his own lines (fuel surcharge, etc.), the sync leaves them alone and lists any conflicting sheet change under *To review*.
- **Skipped tickets:** dated before the start date on the **QuickBooks** tab; zero quantity; containing "SYSTEM TEST" or "DO NOT BILL"; or with anything typed in the Ticket Log's last column (QB invoice reference) before the sync touched it. Typing `NO BILL` there keeps a ticket off invoices.
- **Customers:** ticket customer names are matched to QuickBooks customers in the **QB Customers** tab (e.g. "Weaver Group Ltd" → "Weaver Group Limted"). If no match is found, the tickets wait and the customer is listed under *To review*. Pick the QuickBooks name from the dropdown and the next sync picks them up.

## Tabs it adds

- **QuickBooks**: status, last sync, start date (editable), and the *To review* list.
- **QB Customers**: ticket customer name → QuickBooks customer.
- **QB Invoices**: each customer's current open invoice.
- **QB Sync Log** (hidden): which ticket went on which invoice. Don't edit it.

The existing Ticket Log columns are not moved. The sync only writes the invoice number into column Q.

## One-time setup

1. **Install the script.** In the JWC Master Tickets sheet: **Extensions → Apps Script**. Click **+** next to Files → **Script**, and name it `QuickBooks`. Paste the full contents of `google-sheets/QuickBooks.gs` and click **Save**. Don't paste it into, or replace, any other file.
2. In the function dropdown at the top, choose **qbsSetup**, click **Run**, and approve Google's permission prompts. This adds the tabs, the QuickBooks menu, and the nightly 10 PM trigger. Copy the **Intuit redirect URL** it prints in the log (it's also under **QuickBooks → Show Intuit redirect URL** after reloading the sheet).
3. **Create the Intuit app.** Go to https://developer.intuit.com, signed in with JWC's Intuit login. Click **Dashboard → Create an app → QuickBooks Online and Payments**, name it `JWC Billing Sync`, and choose the **Accounting** scope. Fill in the production settings:
   - Redirect URI: the URL from step 2
   - Host domain: `jwchauling.com`
   - Launch URL and Disconnect URL: `https://www.jwchauling.com/`
   - Privacy policy: `https://www.jwchauling.com/privacy/`
   - End-user licence (EULA): `https://www.jwchauling.com/terms/`

   Finish Intuit's production questionnaire, then open **Production → Keys & credentials**.
4. In Apps Script: **Project Settings** (gear icon) → **Script Properties** → add `QB_CLIENT_ID` and `QB_CLIENT_SECRET` with the production values. Never put these in chat, email, or the repository.
5. Reload the sheet. Open **QuickBooks → Connect QuickBooks**, sign in, and choose **JWC Contracting Ltd.**
6. Run **QuickBooks → Sync invoices now** once and check the **QuickBooks** tab.

## Keeping it running

- If the **QuickBooks** tab says the sign-in expired, use **QuickBooks → Connect QuickBooks** again. Nothing else needs redoing.
- To stop everything: **QuickBooks → Disconnect QuickBooks** (or remove the app in QuickBooks under Settings → Apps).
- Local check: `node google-sheets/quickbooks.test.cjs`. It runs against a simulated QuickBooks and does not prove the live connection.
