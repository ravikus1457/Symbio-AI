#!/usr/bin/env python3
"""
Symbio AI — Free Website Scan
=============================

Point it at a URL; it audits the site and produces a clean, branded report a
prospect can actually read — the deliverable behind the "free scan" CTA the lead
engine sends. Output is a self-contained HTML file (print to PDF from any
browser), with an optional one-shot PDF render if a Chrome/Chromium binary is
available.

    python3 freescan.py https://example.com
    python3 freescan.py https://example.com --out report.html --pdf
    python3 freescan.py https://example.com --json        # raw findings only

Core is standard-library only. The audit is intentionally coarse and fast
(fetch + parse), not a full Lighthouse run — enough to start a real conversation.

Pairs with the lead engine: that tool finds and queues prospects; this tool
generates the report you hand them.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime

USER_AGENT = os.environ.get(
    "FREESCAN_UA", "Mozilla/5.0 (compatible; SymbioFreeScan/1.0; +site-audit)"
)
TIMEOUT = float(os.environ.get("FREESCAN_TIMEOUT", "12"))
BRAND = os.environ.get("SYMBIO_BRAND", "Symbio AI")
BRAND_CONTACT = os.environ.get("SYMBIO_CONTACT", "ravikus1457@gmail.com")
BRAND_CTA_URL = os.environ.get("SYMBIO_CTA_URL", "")  # e.g. a booking link

PASS, WARN, FAIL = "pass", "warn", "fail"
_SCORE = {PASS: 1.0, WARN: 0.5, FAIL: 0.0}


@dataclass
class Check:
    category: str
    label: str
    status: str
    detail: str
    fix: str = ""


@dataclass
class ScanResult:
    url: str
    final_url: str = ""
    reachable: bool = False
    load_ms: int = 0
    html_kb: int = 0
    checks: list[Check] = field(default_factory=list)
    error: str = ""

    def add(self, *a, **k) -> None:
        self.checks.append(Check(*a, **k))


# --------------------------------------------------------------------------- #
# Audit
# --------------------------------------------------------------------------- #

def _norm(url: str) -> str:
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def _find(pattern: str, text: str) -> re.Match | None:
    return re.search(pattern, text, re.I | re.S)


def scan(url: str) -> ScanResult:
    url = _norm(url)
    res = ScanResult(url=url)
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            res.final_url = resp.geturl()
            raw = resp.read(1_500_000)
        res.load_ms = int((time.monotonic() - t0) * 1000)
        page = raw.decode("utf-8", errors="ignore")
        res.html_kb = max(1, len(raw) // 1024)
        res.reachable = True
    except Exception as exc:  # noqa: BLE001
        res.error = f"{type(exc).__name__}: {exc}"
        res.add("Reachability & security", "Site loads", FAIL,
                f"The site didn't load ({res.error}).",
                "Make sure the domain resolves and the server responds over HTTPS.")
        return res

    _audit_security(res, page)
    _audit_mobile(res, page)
    _audit_seo(res, page)
    _audit_conversion(res, page)
    _audit_performance(res, page)
    return res


def _audit_security(res: ScanResult, page: str) -> None:
    https = res.final_url.lower().startswith("https://")
    res.add("Reachability & security", "Loads successfully", PASS,
            f"Responded in {res.load_ms} ms.")
    res.add("Reachability & security", "Served over HTTPS",
            PASS if https else FAIL,
            "Secure padlock present." if https else "No HTTPS — browsers flag this 'Not secure'.",
            "" if https else "Install an SSL certificate and redirect all http:// traffic to https://.")


def _audit_mobile(res: ScanResult, page: str) -> None:
    vp = bool(_find(r'<meta[^>]+name=["\']viewport["\']', page))
    res.add("Mobile", "Mobile viewport set", PASS if vp else FAIL,
            "Has a responsive viewport tag." if vp else "No viewport tag — the site won't scale on phones.",
            "" if vp else 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and a responsive layout.')


def _audit_seo(res: ScanResult, page: str) -> None:
    tm = _find(r"<title[^>]*>(.*?)</title>", page)
    title = (tm.group(1).strip() if tm else "")
    if not title:
        res.add("SEO basics", "Page title", FAIL, "No <title> tag.",
                "Add a descriptive 50–60 character title with your business + location.")
    elif not (10 <= len(title) <= 65):
        res.add("SEO basics", "Page title", WARN,
                f"Title is {len(title)} chars (“{title[:50]}”).",
                "Aim for ~50–60 chars including your business name and city.")
    else:
        res.add("SEO basics", "Page title", PASS, f"“{title[:60]}”")

    dm = _find(r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']', page)
    desc = dm.group(1).strip() if dm else ""
    if not desc:
        res.add("SEO basics", "Meta description", FAIL, "Missing — Google writes its own snippet.",
                "Add a 120–155 char meta description that sells the click.")
    elif not (50 <= len(desc) <= 165):
        res.add("SEO basics", "Meta description", WARN, f"Description is {len(desc)} chars.",
                "Target ~120–155 chars.")
    else:
        res.add("SEO basics", "Meta description", PASS, "Present and well-sized.")

    h1 = len(re.findall(r"<h1[\s>]", page, re.I))
    res.add("SEO basics", "Has an H1 heading", PASS if h1 >= 1 else FAIL,
            f"{h1} H1 heading(s)." if h1 else "No H1 — search engines can't tell what the page is about.",
            "" if h1 else "Add one clear <h1> describing the business/service.")

    og = bool(_find(r'<meta[^>]+property=["\']og:(title|image)["\']', page))
    res.add("SEO basics", "Social share tags (Open Graph)", PASS if og else WARN,
            "Open Graph tags present." if og else "No Open Graph tags — links share with no preview image/title.",
            "" if og else "Add og:title, og:description, and og:image for clean link previews.")


def _audit_conversion(res: ScanResult, page: str) -> None:
    low = page.lower()
    tel = "tel:" in low or bool(re.search(r"\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b", page))
    res.add("Conversion & trust", "Phone number / click-to-call", PASS if tel else FAIL,
            "Phone present." if tel else "No visible phone or click-to-call.",
            "" if tel else "Add a tap-to-call link (tel:) in the header — local customers expect it.")

    booking = bool(re.search(r"\b(book|booking|appointment|schedule|reserve|calendly|acuity|squareup)\b", low))
    res.add("Conversion & trust", "Booking / contact path", PASS if booking else FAIL,
            "Has a booking or scheduling path." if booking else "No obvious way to book or request a quote.",
            "" if booking else "Add a booking widget or a prominent 'Get a quote' form/CTA.")

    social = bool(re.search(r"(instagram\.com|facebook\.com|tiktok\.com|yelp\.com|g\.page|google\.com/maps)", low))
    res.add("Conversion & trust", "Social / reviews linked", PASS if social else WARN,
            "Links to social or reviews." if social else "No social or reviews links found.",
            "" if social else "Link your Instagram/TikTok and Google reviews to build trust.")


def _audit_performance(res: ScanResult, page: str) -> None:
    if res.load_ms <= 1200:
        st, msg = PASS, f"Fast first response ({res.load_ms} ms)."
        fix = ""
    elif res.load_ms <= 3000:
        st, msg = WARN, f"Server response is a bit slow ({res.load_ms} ms)."
        fix = "Enable caching/CDN and check hosting; aim under ~1.2s."
    else:
        st, msg = FAIL, f"Slow server response ({res.load_ms} ms)."
        fix = "Move to faster hosting + a CDN; slow load = lost mobile visitors."
    res.add("Performance", "Server response time", st, msg, fix)

    imgs = re.findall(r"<img\b[^>]*>", page, re.I)
    if imgs:
        with_alt = sum(1 for t in imgs if re.search(r'\balt\s*=', t, re.I))
        pct = round(100 * with_alt / len(imgs))
        st = PASS if pct >= 80 else (WARN if pct >= 40 else FAIL)
        res.add("Performance", "Image alt text", st,
                f"{with_alt}/{len(imgs)} images have alt text ({pct}%).",
                "" if st == PASS else "Add alt text to images (accessibility + image SEO).")

    res.add("Performance", "HTML page weight", PASS if res.html_kb <= 200 else WARN,
            f"HTML document is {res.html_kb} KB.",
            "" if res.html_kb <= 200 else "Large HTML — trim inline data and defer non-critical content.")


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #

def category_scores(res: ScanResult) -> dict[str, int]:
    cats: dict[str, list[float]] = {}
    for c in res.checks:
        cats.setdefault(c.category, []).append(_SCORE[c.status])
    return {k: round(100 * sum(v) / len(v)) for k, v in cats.items()}


def overall_score(res: ScanResult) -> int:
    if not res.checks:
        return 0
    return round(100 * sum(_SCORE[c.status] for c in res.checks) / len(res.checks))


def grade(score: int) -> str:
    for cut, g in [(90, "A"), (80, "B"), (70, "C"), (60, "D")]:
        if score >= cut:
            return g
    return "F"


def top_fixes(res: ScanResult, n: int = 5) -> list[Check]:
    order = {FAIL: 0, WARN: 1, PASS: 2}
    ranked = sorted([c for c in res.checks if c.status != PASS and c.fix],
                    key=lambda c: order[c.status])
    return ranked[:n]


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #

_STATUS_META = {
    PASS: ("✓", "#3fd089"),
    WARN: ("!", "#ffce5a"),
    FAIL: ("✗", "#ff6f57"),
}


def render_html(res: ScanResult) -> str:
    e = html.escape
    score = overall_score(res)
    g = grade(score)
    cats = category_scores(res)
    arc = "#3fd089" if score >= 80 else ("#ffce5a" if score >= 60 else "#ff6f57")
    date = datetime.now().strftime("%B %d, %Y")
    domain = re.sub(r"^https?://", "", res.final_url or res.url).rstrip("/")

    fixes = top_fixes(res)
    fixes_html = "".join(
        f'<li><strong>{e(c.label)}.</strong> {e(c.fix)}</li>' for c in fixes
    ) or "<li>Nice — no critical issues found. Let's talk about polish and growth.</li>"

    cat_html = ""
    for cat, items in _grouped(res.checks).items():
        rows = ""
        for c in items:
            sym, col = _STATUS_META[c.status]
            fix = f'<div class="fix">→ {e(c.fix)}</div>' if c.fix else ""
            rows += (
                f'<div class="row"><div class="dot" style="background:{col}">{sym}</div>'
                f'<div class="row-body"><div class="row-label">{e(c.label)}</div>'
                f'<div class="row-detail">{e(c.detail)}</div>{fix}</div></div>'
            )
        cat_html += (
            f'<section class="cat"><div class="cat-head"><h2>{e(cat)}</h2>'
            f'<span class="cat-score">{cats.get(cat, 0)}/100</span></div>{rows}</section>'
        )

    cta = (
        f'<a class="cta" href="{e(BRAND_CTA_URL)}">Book a free consult</a>'
        if BRAND_CTA_URL else
        f'<span class="cta">Reply to this email or contact {e(BRAND_CONTACT)}</span>'
    )

    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Website Scan — {e(domain)} | {e(BRAND)}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ margin:0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         color:#f4f1ea; background:#0b0b0c; line-height:1.55; }}
  .wrap {{ max-width: 820px; margin: 0 auto; padding: 40px 28px 64px; }}
  .top {{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px;
          border-bottom:1px solid rgba(255,221,138,.18); padding-bottom:20px; }}
  .brand {{ font-weight:800; letter-spacing:.02em; }}
  .brand b {{ color:#ffdd8a; }}
  .muted {{ color:#a39c8d; font-size:13px; }}
  h1 {{ font-size:26px; margin:24px 0 4px; }}
  .url {{ color:#ffdd8a; word-break:break-all; }}
  .hero {{ display:flex; align-items:center; gap:24px; margin:26px 0 8px;
           background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));
           border:1px solid rgba(255,221,138,.18); border-radius:16px; padding:22px 24px; }}
  .donut {{ width:104px; height:104px; border-radius:50%; flex:0 0 auto;
            background: conic-gradient({arc} {score*3.6}deg, rgba(255,255,255,.08) 0);
            display:grid; place-items:center; }}
  .donut .inner {{ width:80px; height:80px; border-radius:50%; background:#0b0b0c;
                   display:grid; place-items:center; text-align:center; }}
  .donut .num {{ font-size:26px; font-weight:800; }}
  .donut .lbl {{ font-size:11px; color:#a39c8d; }}
  .grade {{ font-size:40px; font-weight:800; color:{arc}; }}
  .summary {{ flex:1; }}
  .cats {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }}
  .pill {{ font-size:12px; padding:5px 10px; border:1px solid rgba(255,221,138,.2);
           border-radius:999px; color:#cdc6b6; }}
  section.cat {{ margin-top:26px; }}
  .cat-head {{ display:flex; justify-content:space-between; align-items:baseline;
               border-bottom:1px solid rgba(255,255,255,.08); padding-bottom:8px; }}
  .cat-head h2 {{ font-size:16px; margin:0; }}
  .cat-score {{ color:#a39c8d; font-size:13px; }}
  .row {{ display:flex; gap:12px; padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05); }}
  .dot {{ width:22px; height:22px; border-radius:50%; flex:0 0 auto; color:#0b0b0c;
          font-weight:900; font-size:13px; display:grid; place-items:center; }}
  .row-label {{ font-weight:700; }}
  .row-detail {{ color:#bdb6a7; font-size:14px; }}
  .fix {{ color:#ffdd8a; font-size:13px; margin-top:3px; }}
  .fixes {{ margin-top:30px; background:rgba(255,221,138,.06);
            border:1px solid rgba(255,221,138,.22); border-radius:16px; padding:20px 24px; }}
  .fixes h2 {{ margin:0 0 10px; font-size:18px; }}
  .fixes ol {{ margin:0; padding-left:20px; }} .fixes li {{ margin:7px 0; }}
  .foot {{ margin-top:34px; text-align:center; }}
  .cta {{ display:inline-block; background:linear-gradient(135deg,#ffe9a8,#d7a84f);
          color:#1a1206; font-weight:800; padding:12px 22px; border-radius:999px; }}
  .foot .muted {{ margin-top:12px; }}
  @media print {{ body {{ background:#fff; color:#111; }} .donut .inner {{ background:#fff; }}
    .hero, .fixes {{ background:#faf7ef; }} a.cta {{ color:#1a1206; }} }}
</style></head>
<body><div class="wrap">
  <div class="top">
    <div><div class="brand"><b>{e(BRAND)}</b> · Website Scan</div>
      <div class="muted">Prepared {e(date)}</div></div>
    <div class="muted">{e(BRAND_CONTACT)}</div>
  </div>

  <h1>Website scan</h1>
  <div class="url">{e(res.final_url or res.url)}</div>

  <div class="hero">
    <div class="donut"><div class="inner">
      <div><div class="num">{score}</div><div class="lbl">/ 100</div></div></div></div>
    <div class="summary">
      <div class="grade">Grade {g}</div>
      <div class="muted">{_headline(score)}</div>
      <div class="cats">{''.join(f'<span class="pill">{e(k)}: {v}</span>' for k,v in cats.items())}</div>
    </div>
  </div>

  <div class="fixes"><h2>Top fixes, in priority order</h2><ol>{fixes_html}</ol></div>

  {cat_html}

  <div class="foot">{cta}
    <div class="muted">Scan by {e(BRAND)}. This is a quick automated audit — a full
    review covers performance, accessibility, and conversion in depth.</div></div>
</div></body></html>"""


def _grouped(checks: list[Check]) -> dict[str, list[Check]]:
    out: dict[str, list[Check]] = {}
    for c in checks:
        out.setdefault(c.category, []).append(c)
    return out


def _headline(score: int) -> str:
    if score >= 90:
        return "Strong foundation — a few tweaks from excellent."
    if score >= 75:
        return "Solid, with clear quick wins available."
    if score >= 55:
        return "Real gaps that are likely costing you customers."
    return "Major gaps — this is leaving money on the table."


# --------------------------------------------------------------------------- #
# PDF (optional)
# --------------------------------------------------------------------------- #

def find_chrome() -> str | None:
    cand = [os.environ.get("CHROME_BIN", "")]
    cand += [
        "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
    ]
    for c in cand:
        if c and os.path.exists(c):
            return c
    return None


def render_pdf(html_path: str, pdf_path: str) -> bool:
    chrome = find_chrome()
    if not chrome:
        print("  ! No Chrome/Chromium found — open the HTML and 'Save as PDF' instead.",
              file=sys.stderr)
        return False
    url = "file://" + os.path.abspath(html_path)
    try:
        subprocess.run(
            [chrome, "--headless", "--no-sandbox", "--disable-gpu",
             "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}", url],
            check=True, capture_output=True, timeout=60,
        )
        return os.path.exists(pdf_path)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! PDF render failed: {exc}", file=sys.stderr)
        return False


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Symbio AI — free website scan")
    p.add_argument("url", help="site to scan, e.g. https://example.com")
    p.add_argument("--out", help="HTML output path (default: scan-<domain>.html)")
    p.add_argument("--pdf", action="store_true", help="also render a PDF (needs Chrome/Chromium)")
    p.add_argument("--json", action="store_true", help="print raw findings as JSON and exit")
    args = p.parse_args(argv)

    res = scan(args.url)

    if args.json:
        print(json.dumps({
            "url": res.url, "final_url": res.final_url, "reachable": res.reachable,
            "load_ms": res.load_ms, "overall": overall_score(res), "grade": grade(overall_score(res)),
            "categories": category_scores(res),
            "checks": [vars(c) for c in res.checks], "error": res.error,
        }, indent=2))
        return 0

    domain = re.sub(r"[^a-z0-9.]+", "-", re.sub(r"^https?://", "", res.url).lower()).strip("-")
    out = args.out or f"scan-{domain or 'site'}.html"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(render_html(res))
    print(f"Overall: {overall_score(res)}/100 (grade {grade(overall_score(res))})")
    print(f"Report:  {out}")

    if args.pdf:
        pdf = re.sub(r"\.html?$", "", out) + ".pdf"
        if render_pdf(out, pdf):
            print(f"PDF:     {pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
