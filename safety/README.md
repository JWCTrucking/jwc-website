# JWC safety and carrier compliance program

Public page: `/safety/`. Homepage and fleet Safety links point here. The PDF and editable Markdown source are served locally alongside the page; they do not depend on an expiring external asset link.

Scope confirmed by the owner: Alberta only, non-dangerous oilfield pipe/materials/equipment and heavy hauling. Program JWC-HSE-001, revision 1.0, effective November 7, 2026. The owner explicitly requested publication with JWC branding and Jordan Cowan, CEO approval. The approval is visibly a **typed approval signature**, not a handwritten autograph or cryptographic signature. No regulator, COR/SECOR, insurance, fleet or site certification is invented.

The program combines carrier safety/maintenance requirements with OHS procedures. Official sources, provincial HOS numbers, break options, local-record conditions, required onboard logs, reporting/retention and permit/inspection requirements were checked during drafting. Additional JWC company policies (for example the monthly/10,000 km maintenance-inspection baseline and check-in timings) are identified as company rules. Actual fleet-specific OEM schedules, driver files, authority records, worksite emergency cards and implementation remain necessary.

Edit `JWC-Safety-Program.md`, then run `python3 scripts/build-safety.py` from the repository to regenerate the HTML and update navigation/sitemap idempotently. Recreate the PDF with Adobe's Markdown-to-PDF tool, including the official JWC logo image. Download the final PDF to a new scratch filename, verify the operation succeeded, then replace `JWC-Safety-Program.pdf` with the matching revision. Do not leave a public source/PDF mismatch or silently change the approval/date.

Validation: public SEO/link check; phone and desktop browser checks for all 25 sections, signature, logo decoding, contents navigation, PDF download and horizontal overflow. Private worker signatures, driver/medical records, live check-in contacts and incident records are not published.
