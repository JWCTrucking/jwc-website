# Alberta daily truck and trailer inspection

The app's Truck & Trailer Pre-trip button opens `app/pretrip.html` inside the app without a PIN. It records all 23 NSC Standard 13 Part 2 Schedule 1 categories separately for tractor and trailer, defect details or N/A reasons, required inspection identifiers, readings and electronic signature declarations. Major defects prominently show DO NOT OPERATE. A major-defect report can still be submitted to dispatch; submission never authorizes vehicle operation.

The fixed recipient is **dispach@jwchauling.com**, exactly as supplied by the owner. Do not silently change the spelling.

## Deploy the Google backend before using submissions

1. Open the existing Apps Script project connected to the JWC workbook.
2. Replace the existing main Code.gs with the complete regenerated **JWC-App-Update.gs**. This bundle already includes Pretrip.gs and the schedule category data; do not also paste those as separate files. Keep the separate QuickBooks and helper files and existing script properties.
3. Save. As the owner, run `authorizePretrip` once and grant the requested Google permissions for private Drive PDFs, document creation, spreadsheet writes and email. The authorization function performs no email send and creates no report.
4. Manage deployments → edit the existing web app → New version → Deploy. Keep the existing `/exec` URL, Execute as Me and access Anyone. The public app POST receiver accepts this submission without a staff session. Do not run workbook setup or replace private properties.
5. After deploying the frontend, perform one clearly identified test inspection and confirm the PDF arrives at **dispach@jwchauling.com**, the app offers a matching PDF download, and Pre-trip Log contains the report. Test a failure without clearing the draft. Local mocks do not prove Google authorization, PDF rendering or actual mailbox delivery.

The account-level Google deployment cannot be updated through this repository. A GitHub push alone does not activate PDF emailing. An old backend fails confirmation and preserves the draft.

## Records and delivery

`Pre-trip Log` is created lazily in the configured workbook. It stores immutable report payloads, private PDF file IDs, email state and timestamps. The PDF is created under the deployment owner's Drive without public link sharing and returned to the authorized submitter for download. Temporary source Docs are trashed. Report IDs make retries return the existing PDF without emailing again after a confirmed send. A Google MailApp success means Google accepted the send; it does not establish mailbox receipt or rule out a later bounce.

A `pending` row can retry. A `sending` row means the process stopped during or after a mail attempt; automatic resend is blocked to avoid duplicate dispatch emails. The owner must check Sent Mail and the dispatch inbox using the report ID. If delivered, set Email status to `sent` and fill Emailed; if confirmed not sent, set status to `pending` before retrying the unchanged draft. Never mark an unverified report as sent. The app retains the draft when confirmation fails; changing an already archived report requires dispatch reconciliation rather than overwriting the original.

The driver must download/retain the PDF and keep it and the applicable schedule available in the vehicle. There is no automatic offline submission. Device drafts contain inspection data; shared devices should be managed accordingly. The bundled official NSC PDF is cached by the service worker along with the form.

## Alberta basis and limits

- Alberta Commercial Vehicle Safety Regulation, AR 121/2009, sections 10–16: https://kings-printer.alberta.ca/documents/Regs/2009_121.pdf
- NSC Standard 13 Part 2 Schedule 1, truck/tractor/trailer, pages 4–6: https://www.ccmta.ca/web/default/files/PDF/Standard_13_March_2009.pdf
- Inspection valid for 24 hours from the recorded inspection time; record/report subsequent defects. Major defects require immediate reporting and correction/certification under section 16 before operation. Report other defects no later than the next required daily inspection.
- Forward original to the home terminal within 20 days. Carrier deposits the original at its principal place of business within 30 days of receipt and keeps chronological per-vehicle reports for at least 6 months after receipt. Email/Drive storage does not itself establish all carrier recordkeeping procedures.
- Section 12 permits electronic reports in a format acceptable to the Registrar. Typed signatures are recorded as electronic declarations; this implementation has not been certified or approved by the Registrar. A carrier can print the PDF as needed. This is a daily truck/trailer report, not a CVIP certificate or a claim of compliance across every province.

Checks: `node google-sheets/pretrip.test.cjs`, `node google-sheets/web-submission.test.cjs`, `node app/pretrip.test.cjs`, and the existing regression suite. PDF persistence and mail APIs are mocked in local backend tests; live conversion and delivery need the post-deployment check above.
