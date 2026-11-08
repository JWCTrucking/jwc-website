# Basic FLHA and toolbox meetings

The app has separate **FLHA · Hazard Assessment** and **Toolbox Meeting** buttons. Each short form records the date/time, site, job and leader; hazards/topics; controls/actions; optional notes; and 1–8 named crew members with drawn finger/mouse signatures. Each crew member signs the same review/stop-work declaration. Editing job details clears signatures for a fresh review. Separate local drafts survive reloads and failed submissions.

These are simple small-operator records, not a claim of certification or a replacement for a client's required site procedures, permits or hazard-assessment process. The FLHA includes an optional emergency/muster/contact notes field. No risk matrix or extensive checklists are imposed.

## Activate email

The frontend is published separately from Google Apps Script. To enable the signed PDFs, replace only the existing main **Code.gs** with the complete, latest **JWC-App-Update.gs** from this repository. Keep QuickBooks/helper files and private properties. Save, select **authorizeSafetyForms**, Run, and approve permissions as the owner. Then **Deploy → Manage deployments → edit the existing web app → New version → Deploy**, keeping Execute as Me, access Anyone, and the same web app URL. Do not run workbook setup or paste Safety.gs separately when using the complete bundle.

Send a clearly marked test FLHA and toolbox record from the app. Verify the PDF includes every crew signature, dispatch receives it at **dispach@jwchauling.com**, and the matching record appears in **Safety Log**. The app offers a download of the same PDF only after Google confirms the send. Local tests mock Google document conversion/Drive/mail and cannot establish live PDF rendering or mailbox receipt.

## Archive and retries

Safety Log stores immutable record IDs, form type, private payload/PDF file IDs, delivery state and timestamps. Signature PNGs and the complete payload are in a private JSON Drive file, avoiding the Sheets cell-size limit. Temporary source Docs are trashed after PDF conversion. PDFs/JSON have no public sharing added by the code; access follows the deployment owner's Drive permissions. Keep the workbook and Drive archive restricted to authorized staff. Drafts include signatures on the device and are removed after confirmed submission.

The safety receiver allows up to 250,000 characters for signatures; other submission types retain their 50,000-character cap. The public app receiver accepts submissions without a staff session, validates the fields, checks bounded PNG signature headers/dimensions and uses a fixed recipient. Blank signature boxes are rejected by the app; an image alone cannot authenticate a person's identity. Drawn signature capture is an electronic crew acknowledgment, not verified identity.

Same-ID retries return the existing sent PDF without another email. A `pending` record can retry. A `sending` record requires the owner to check Sent Mail/dispatch using the record ID: mark `sent` and fill Emailed only if confirmed delivered, or restore `pending` only if confirmed not sent. Do not overwrite an archived signed record with different content; coordinate corrections with dispatch. MailApp acceptance does not prove mailbox receipt or rule out a bounce.

Checks: `node app/safety.test.cjs` exercises actual touch input on Chromium phones, mouse signatures on desktop, multiple strokes, crew restoration, changed-details invalidation, failure/old-backend retention, retry IDs, downloadable PDF and embedded navigation. `node google-sheets/safety.test.cjs` tests validation, private signature payloads, PDF template images, protected legacy RPCs, public app cores, fixed recipient, quota recovery and ambiguous send handling with Google API stubs.
