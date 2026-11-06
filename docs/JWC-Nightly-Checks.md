# JWC nightly checks

Checks are scheduled for **midnight MST (07:00 UTC), November 6–19, 2026**, covering 14 nights. GitHub can delay scheduled starts. The date guard prevents checks running again on these calendar dates in future years. Code pushes also run the checks, and the workflow supports manual runs.

Results: https://github.com/JWCTrucking/jwc-website/actions/workflows/jwc-nightly-checks.yml

Each run checks:

- Ticket and maintenance forms, PIN access, retry/draft behavior, app layout/intro, rates and permits in Chromium and WebKit.
- Sheet writes and QuickBooks invoice logic against simulated services, including preservation of manual edits and owner-only accounting access.
- Live HTTPS availability of the website, app, key scripts and the public Google deployment, without submitting records.
- Search crawl access, sitemap, canonical URL, visible business/service/location information, contact consistency, structured business data, images and links.

Browser screenshots are saved with the run for 14 days. A red failed run needs attention; the log names the failing check. GitHub email alerts depend on the owner's Actions notification settings. Scheduled checks run on GitHub without ChatGPT being open.

These are automated tests and health checks, not an unattended AI repair service. They do not inspect private production Sheet rows, prove the live QuickBooks connection, monitor Google rankings or guarantee Google AI mentions. They never create/send invoices, add live ticket rows, or change business copy automatically. Search improvements should use real service information, customer questions, photos and approved business details.

The Safari fallback tests simulate older missing APIs. The WebKit job exercises the current WebKit engine, which is related to Safari but is not a test on Jordan's exact Mac or iPhone.
