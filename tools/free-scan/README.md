# Symbio AI — Free Website Scan

Point it at a URL; it audits the site and produces a clean, **branded report** a
prospect can read — the deliverable behind the "free scan" the lead engine offers.
Output is a self-contained HTML file (print to PDF from any browser), with an
optional one-shot PDF render when a Chrome/Chromium binary is available.

Standard-library only for the scan + HTML. The audit is intentionally fast and
coarse (fetch + parse), not a full Lighthouse run — enough to start a real
conversation and book the work.

## Usage

```bash
cd tools/free-scan
python3 freescan.py https://example.com                 # writes scan-example.com.html
python3 freescan.py https://example.com --out report.html --pdf
python3 freescan.py https://example.com --json          # raw findings, no report
```

`--pdf` looks for Chrome/Chromium (`CHROME_BIN`, then common paths). On a Pi:
`sudo apt install chromium-browser`, or just open the HTML and **Save as PDF**.

## What it checks

| Category | Checks |
| --- | --- |
| Reachability & security | loads, response time, HTTPS |
| Mobile | responsive viewport |
| SEO basics | title (+length), meta description (+length), H1, Open Graph |
| Conversion & trust | click-to-call, booking/contact path, social/reviews links |
| Performance | server response time, image alt coverage, HTML weight |

Each check is pass / warn / fail with a specific fix. The report shows an overall
score + letter grade, per-category scores, and a prioritized "Top fixes" list.

## How it fits

```
lead engine  ──finds & queues prospects──▶  you approve
                                                 │
free scan   ──generates the report you hand them──▶  booked call
```

Drop the customer's URL in, send the report (or attach the PDF). Set
`SYMBIO_BRAND`, `SYMBIO_CONTACT`, and optionally `SYMBIO_CTA_URL` (a booking link)
in the environment to brand it.

## Customers as well as prospects

Same tool works as a paid micro-audit, or as a recurring "site health" report for
clients on a care plan. For a deeper report, swap the regex checks for Google
PageSpeed/Lighthouse (heavier — run it off-Pi).

Built by Symbio AI.
