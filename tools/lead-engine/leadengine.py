#!/usr/bin/env python3
"""
Symbio AI — Outbound Lead Engine
================================

A small, dependency-light agent for a Raspberry Pi (or any always-on box) that:

  1. ingests local businesses from a CSV (or the Google Places API),
  2. audits each one's web presence (no site? slow site? not mobile-friendly?),
  3. scores the opportunity and drafts a personalized first-touch message,
  4. queues everything for YOU to approve before anything is sent.

Approve-before-send is the whole point: the engine never contacts anyone on its
own. You review the ranked queue (in the terminal or pushed to Telegram), approve
the good ones, and it writes a ready-to-send message to ./outbox/. You hit send.

Core runs on the Python standard library alone. Two optional upgrades:
  * `--llm`      → use Claude to write more natural drafts (needs `pip install anthropic`
                   and ANTHROPIC_API_KEY).
  * `--source places` → pull businesses from the Google Places API (needs PLACES_API_KEY).

Quick start:
    python3 leadengine.py init
    python3 leadengine.py ingest --file seeds/businesses.sample.csv
    python3 leadengine.py report
    python3 leadengine.py approve 3
    # -> ./outbox/lead-0003-*.txt is ready to send

⚖️  Compliance is on you, not the model. Cold email is governed by CAN-SPAM,
    SMS by TCPA / A2P 10DLC (register your number), and scraping by each site's
    ToS. The CSV source does no scraping. Keep outreach honest, identify
    yourself, and honor opt-outs. See README.md.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone

# --------------------------------------------------------------------------- #
# Config (env-driven; load a local config.env if present so `python3 leadengine.py`
# works without systemd). systemd uses EnvironmentFile=, which sets the same vars.
# --------------------------------------------------------------------------- #

HERE = os.path.dirname(os.path.abspath(__file__))


def _load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key, val = key.strip(), val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


_load_env_file(os.path.join(HERE, "config.env"))


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


DB_PATH = env("LEADENGINE_DB", os.path.join(HERE, "leads.db"))
OUTBOX = env("LEADENGINE_OUTBOX", os.path.join(HERE, "outbox"))
SENDER_NAME = env("SYMBIO_SENDER_NAME", "Ravi")
SENDER_BRAND = env("SYMBIO_BRAND", "Symbio AI")
SENDER_CONTACT = env("SYMBIO_CONTACT", "ravikus1457@gmail.com")
SENDER_SITE = env("SYMBIO_SITE", "")  # e.g. https://symbio.ai — used in drafts if set
SCAN_OFFER = env("SYMBIO_OFFER", "a free 2-minute scan of your online presence")
LLM_MODEL = env("LEADENGINE_MODEL", "claude-opus-4-8")
HTTP_TIMEOUT = float(env("LEADENGINE_HTTP_TIMEOUT", "7"))
USER_AGENT = env(
    "LEADENGINE_UA",
    "Mozilla/5.0 (compatible; SymbioLeadEngine/1.0; +site-audit)",
)

KIT_NA = "—"


# --------------------------------------------------------------------------- #
# Data model
# --------------------------------------------------------------------------- #

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT NOT NULL,
    name         TEXT NOT NULL,
    website      TEXT,
    phone        TEXT,
    email        TEXT,
    category     TEXT,
    area         TEXT,
    source       TEXT,
    has_site     INTEGER,
    reachable    INTEGER,
    https        INTEGER,
    mobile       INTEGER,
    has_title    INTEGER,
    has_meta     INTEGER,
    has_booking  INTEGER,
    issues       TEXT,
    score        INTEGER,
    channel      TEXT,
    draft        TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',
    dedup_key    TEXT UNIQUE
);
"""


@dataclass
class Business:
    name: str
    website: str = ""
    phone: str = ""
    email: str = ""
    category: str = ""
    area: str = ""
    source: str = "csv"


@dataclass
class Audit:
    has_site: bool = False
    reachable: bool = False
    https: bool = False
    mobile: bool = False
    has_title: bool = False
    has_meta: bool = False
    has_booking: bool = False
    issues: list[str] = field(default_factory=list)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- #
# Website audit
# --------------------------------------------------------------------------- #

def _normalize_url(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def audit_website(url: str, *, do_network: bool = True) -> Audit:
    """Coarse, fast web-presence check. Never raises — failures => unreachable."""
    a = Audit()
    url = _normalize_url(url)
    if not url:
        a.issues.append("No website listed")
        return a

    a.has_site = True
    if not do_network:
        # Offline mode: we know a site exists but can't inspect it.
        a.reachable = True
        a.issues.append("Site not inspected (offline mode)")
        return a

    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            final_url = resp.geturl()
            raw = resp.read(200_000)
        html = raw.decode("utf-8", errors="ignore")
        a.reachable = True
        a.https = final_url.lower().startswith("https://")
        title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        a.has_title = bool(title_m and title_m.group(1).strip())
        a.has_meta = bool(re.search(r'<meta[^>]+name=["\']description["\']', html, re.I))
        a.mobile = bool(re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I))
        a.has_booking = bool(
            re.search(
                r"\b(book|booking|appointment|schedule|reserve|calendly|acuity|squareup)\b",
                html,
                re.I,
            )
            or "tel:" in html.lower()
        )
    except Exception as exc:  # noqa: BLE001 - any failure means we couldn't reach it
        a.reachable = False
        a.issues.append(f"Website didn't load ({type(exc).__name__})")
        return a

    if not a.https:
        a.issues.append("No HTTPS (insecure)")
    if not a.mobile:
        a.issues.append("Not mobile-friendly (no viewport tag)")
    if not a.has_title:
        a.issues.append("Missing page title")
    if not a.has_meta:
        a.issues.append("Missing meta description (weak SEO)")
    if not a.has_booking:
        a.issues.append("No obvious booking / contact path")
    if not a.issues:
        a.issues.append("Site is decent — lower priority, nurture only")
    return a


def score_lead(a: Audit) -> tuple[int, str]:
    """Return (opportunity_score 0-99, suggested_channel)."""
    if not a.has_site:
        return 95, "call"
    if not a.reachable:
        return 88, "call"
    score = 30
    if not a.https:
        score += 12
    if not a.mobile:
        score += 18
    if not a.has_title:
        score += 12
    if not a.has_meta:
        score += 10
    if not a.has_booking:
        score += 12
    score = max(8, min(99, score))
    return score, "email"


# --------------------------------------------------------------------------- #
# Draft generation
# --------------------------------------------------------------------------- #

def _offer_line(issues: list[str]) -> str:
    real = [i for i in issues if not i.startswith("Site is decent") and "offline" not in i]
    if not real:
        return "a few quick wins to turn more of your visitors into booked jobs"
    top = real[:2]
    return " and ".join(i.lower() for i in top)


def template_draft(b: Business, a: Audit, channel: str) -> str:
    """Deterministic, zero-dependency personalized draft. Works with no API key."""
    who = b.name
    cat = (b.category or "business").lower()
    fix = _offer_line(a.issues)
    site_bit = f" ({SENDER_SITE})" if SENDER_SITE else ""

    if not a.has_site:
        body = (
            f"Hi {who} team — I came across your {cat} and noticed there's no website yet. "
            f"I build clean, fast sites with booking and an AI assistant baked in for local "
            f"shops like yours. Happy to send {SCAN_OFFER} and a quick mockup, no pressure."
        )
    else:
        body = (
            f"Hi {who} team — I had a look at your site and spotted {fix}. "
            f"I help local {cat} shops fix that and turn more visitors into booked jobs "
            f"(sites, booking, and an AI assistant that answers and qualifies leads 24/7). "
            f"Want me to send over {SCAN_OFFER}?"
        )

    signoff = f"\n\n— {SENDER_NAME}, {SENDER_BRAND}{site_bit}\n{SENDER_CONTACT}"
    optout = "\n\nNot a fit? Reply 'no thanks' and I won't follow up."
    return body + signoff + optout


def llm_draft(b: Business, a: Audit, channel: str) -> str:
    """Use Claude for a more natural draft. Falls back to template on any error."""
    try:
        import anthropic  # lazy import; only needed with --llm
    except ImportError:
        print("  ! anthropic not installed (pip install anthropic) — using template", file=sys.stderr)
        return template_draft(b, a, channel)

    facts = {
        "business": b.name,
        "category": b.category,
        "area": b.area,
        "has_website": a.has_site,
        "website_reachable": a.reachable,
        "issues_found": a.issues,
        "channel": channel,
    }
    system = (
        f"You write short, friendly, non-pushy first-touch outreach for {SENDER_BRAND}, "
        f"a studio that builds websites, booking systems, and AI assistants for local "
        f"businesses. Voice: warm, concrete, peer-to-peer — never salesy or hypey. "
        f"Rules: reference ONLY the specific issues provided (never invent problems or "
        f"metrics); one clear call to action ({SCAN_OFFER}); under 90 words; plain text; "
        f"sign off as '{SENDER_NAME}, {SENDER_BRAND}' with {SENDER_CONTACT}; end with a "
        f"one-line opt-out. Output only the message."
    )
    prompt = "Write the outreach message for this prospect:\n" + json.dumps(facts, indent=2)

    try:
        client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY
        msg = client.messages.create(
            model=LLM_MODEL,
            max_tokens=600,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(
            getattr(blk, "text", "") for blk in msg.content if getattr(blk, "type", None) == "text"
        ).strip()
        return text or template_draft(b, a, channel)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! LLM draft failed ({type(exc).__name__}: {exc}) — using template", file=sys.stderr)
        return template_draft(b, a, channel)


# --------------------------------------------------------------------------- #
# Sources
# --------------------------------------------------------------------------- #

def source_csv(path: str) -> list[Business]:
    out: list[Business] = []
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
            name = row.get("name") or row.get("business") or ""
            if not name:
                continue
            out.append(
                Business(
                    name=name,
                    website=row.get("website", ""),
                    phone=row.get("phone", ""),
                    email=row.get("email", ""),
                    category=row.get("category", ""),
                    area=row.get("area", "") or row.get("city", ""),
                    source="csv",
                )
            )
    return out


def source_places(query: str, *, limit: int = 20) -> list[Business]:
    """Google Places Text Search. Requires PLACES_API_KEY.

    NOTE: Using the Places API is subject to Google's Terms of Service. Do not
    cache/store place data longer than allowed, and respect rate limits. This is
    a convenience source — the CSV source (you control the list) is the default.
    """
    key = env("PLACES_API_KEY")
    if not key:
        raise SystemExit("PLACES_API_KEY not set — cannot use --source places")
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json?" + urllib.parse.urlencode(
        {"query": query, "key": key}
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out: list[Business] = []
    for place in data.get("results", [])[:limit]:
        out.append(
            Business(
                name=place.get("name", ""),
                area=place.get("formatted_address", ""),
                category=", ".join(place.get("types", [])[:2]),
                source="places",
            )
        )
    return out


# --------------------------------------------------------------------------- #
# Telegram (optional notifications + approvals)
# --------------------------------------------------------------------------- #

def telegram_enabled() -> bool:
    return bool(env("TELEGRAM_BOT_TOKEN") and env("TELEGRAM_CHAT_ID"))


def telegram_send(text: str) -> None:
    token, chat = env("TELEGRAM_BOT_TOKEN"), env("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = urllib.parse.urlencode(
        {"chat_id": chat, "text": text[:4000], "disable_web_page_preview": "true"}
    ).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(url, data=payload), timeout=HTTP_TIMEOUT)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! Telegram send failed: {exc}", file=sys.stderr)


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

def dedup_key(b: Business) -> str:
    if b.website:
        host = urllib.parse.urlparse(_normalize_url(b.website)).netloc.lower()
        host = host[4:] if host.startswith("www.") else host
        if host:
            return "site:" + host
    return "name:" + re.sub(r"[^a-z0-9]+", "", (b.name + b.area).lower())


def cmd_init(_args) -> None:
    conn = db()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    os.makedirs(OUTBOX, exist_ok=True)
    print(f"Initialized {DB_PATH} and {OUTBOX}/")


def cmd_ingest(args) -> None:
    if args.source == "csv":
        if not args.file:
            raise SystemExit("--file is required for --source csv")
        businesses = source_csv(args.file)
    elif args.source == "places":
        if not args.query:
            raise SystemExit("--query is required for --source places")
        businesses = source_places(args.query, limit=args.limit or 20)
    else:
        raise SystemExit(f"unknown source {args.source}")

    if args.limit:
        businesses = businesses[: args.limit]

    conn = db()
    conn.executescript(SCHEMA)
    added, skipped = 0, 0
    do_network = not args.no_audit
    for b in businesses:
        key = dedup_key(b)
        if conn.execute("SELECT 1 FROM leads WHERE dedup_key=?", (key,)).fetchone():
            skipped += 1
            continue
        a = audit_website(b.website, do_network=do_network)
        score, channel = score_lead(a)
        draft = (llm_draft if args.llm else template_draft)(b, a, channel)
        conn.execute(
            """INSERT INTO leads
               (created_at,name,website,phone,email,category,area,source,
                has_site,reachable,https,mobile,has_title,has_meta,has_booking,
                issues,score,channel,draft,status,dedup_key)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                now_iso(), b.name, b.website, b.phone, b.email, b.category, b.area, b.source,
                int(a.has_site), int(a.reachable), int(a.https), int(a.mobile),
                int(a.has_title), int(a.has_meta), int(a.has_booking),
                json.dumps(a.issues), score, channel, draft, "pending", key,
            ),
        )
        added += 1
        print(f"  + [{score:2d}] {b.name}  ({channel})")
    conn.commit()
    conn.close()
    print(f"\nIngested {added} new lead(s), skipped {skipped} duplicate(s).")


def _fmt_lead_line(row: sqlite3.Row) -> str:
    issues = json.loads(row["issues"] or "[]")
    top = issues[0] if issues else ""
    return f"#{row['id']:>3} [{row['score']:>2}] {row['name']:<28.28} {row['channel']:<6} {top}"


def cmd_report(args) -> None:
    conn = db()
    rows = conn.execute(
        "SELECT * FROM leads WHERE status=? ORDER BY score DESC, id ASC LIMIT ?",
        (args.status, args.limit),
    ).fetchall()
    conn.close()
    if not rows:
        print(f"No leads with status '{args.status}'.")
        return
    header = f"Top {len(rows)} '{args.status}' leads (by opportunity score)"
    lines = [header, "=" * len(header)]
    lines += [_fmt_lead_line(r) for r in rows]
    lines.append("\nApprove with:  python3 leadengine.py approve <id>")
    out = "\n".join(lines)
    print(out)
    if args.telegram:
        telegram_send(out)
        print("\n(sent to Telegram)")


def cmd_show(args) -> None:
    conn = db()
    row = conn.execute("SELECT * FROM leads WHERE id=?", (args.id,)).fetchone()
    conn.close()
    if not row:
        raise SystemExit(f"no lead #{args.id}")
    issues = json.loads(row["issues"] or "[]")
    print(f"#{row['id']}  {row['name']}   [score {row['score']} · {row['status']}]")
    print(f"  category : {row['category'] or KIT_NA}")
    print(f"  area     : {row['area'] or KIT_NA}")
    print(f"  website  : {row['website'] or KIT_NA}")
    print(f"  phone    : {row['phone'] or KIT_NA}")
    print(f"  channel  : {row['channel']}")
    print(f"  issues   : " + ("; ".join(issues) or KIT_NA))
    print("  ---- draft ----")
    print(row["draft"])


def _write_outbox(row: sqlite3.Row) -> str:
    os.makedirs(OUTBOX, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9]+", "-", row["name"]).strip("-").lower() or "lead"
    path = os.path.join(OUTBOX, f"lead-{row['id']:04d}-{safe}.txt")
    contact = row["email"] or row["phone"] or row["website"] or "(no contact on file)"
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"To: {row['name']}  <{contact}>\n")
        fh.write(f"Channel: {row['channel']}\n")
        fh.write(f"Score: {row['score']}\n")
        fh.write("-" * 40 + "\n")
        fh.write(row["draft"] + "\n")
    return path


def cmd_approve(args) -> None:
    conn = db()
    row = conn.execute("SELECT * FROM leads WHERE id=?", (args.id,)).fetchone()
    if not row:
        conn.close()
        raise SystemExit(f"no lead #{args.id}")
    conn.execute("UPDATE leads SET status='approved' WHERE id=?", (args.id,))
    conn.commit()
    path = _write_outbox(row)
    conn.close()
    print(f"Approved #{args.id}. Ready-to-send message written to:\n  {path}")
    print("  (Review it, then send it yourself — the engine never auto-sends.)")


def cmd_reject(args) -> None:
    conn = db()
    n = conn.execute("UPDATE leads SET status='rejected' WHERE id=?", (args.id,)).rowcount
    conn.commit()
    conn.close()
    print(f"Rejected #{args.id}." if n else f"no lead #{args.id}")


def cmd_stats(_args) -> None:
    conn = db()
    rows = conn.execute("SELECT status, COUNT(*) c FROM leads GROUP BY status").fetchall()
    total = conn.execute("SELECT COUNT(*) c FROM leads").fetchone()["c"]
    conn.close()
    print(f"Total leads: {total}")
    for r in rows:
        print(f"  {r['status']:<10} {r['c']}")


def cmd_run(args) -> None:
    """Convenience for the systemd timer: ingest the configured seed, then report."""
    seed = env("LEADENGINE_SEED_CSV")
    if seed and os.path.exists(seed):
        cmd_ingest(argparse.Namespace(
            source="csv", file=seed, query=None, limit=args.limit,
            llm=args.llm, no_audit=False,
        ))
    cmd_report(argparse.Namespace(status="pending", limit=15, telegram=telegram_enabled()))


def cmd_telegram_poll(args) -> None:
    """Long-poll Telegram for /report, /approve N, /reject N, /show N commands.

    This makes 'approve from your phone' real. Run it under systemd or ad hoc.
    """
    token = env("TELEGRAM_BOT_TOKEN")
    chat = env("TELEGRAM_CHAT_ID")
    if not (token and chat):
        raise SystemExit("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set")
    base = f"https://api.telegram.org/bot{token}"
    offset = 0
    print("Polling Telegram for commands (Ctrl-C to stop)...")
    while True:
        try:
            url = f"{base}/getUpdates?timeout=50&offset={offset}"
            with urllib.request.urlopen(url, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"  ! poll error: {exc}", file=sys.stderr)
            time.sleep(5)
            continue
        for upd in data.get("result", []):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or {}
            if str(msg.get("chat", {}).get("id")) != str(chat):
                continue  # only obey the configured chat
            text = (msg.get("text") or "").strip()
            _handle_tg_command(text)
        if args.once:
            return


def _handle_tg_command(text: str) -> None:
    parts = text.split()
    if not parts:
        return
    cmd = parts[0].lstrip("/").lower()
    try:
        if cmd == "report":
            cmd_report(argparse.Namespace(status="pending", limit=15, telegram=True))
        elif cmd in ("approve", "reject", "show") and len(parts) > 1 and parts[1].isdigit():
            ns = argparse.Namespace(id=int(parts[1]))
            if cmd == "approve":
                cmd_approve(ns)
                telegram_send(f"✅ Approved #{parts[1]} — message written to outbox.")
            elif cmd == "reject":
                cmd_reject(ns)
                telegram_send(f"🗑️ Rejected #{parts[1]}.")
            else:
                conn = db()
                row = conn.execute("SELECT * FROM leads WHERE id=?", (int(parts[1]),)).fetchone()
                conn.close()
                if row:
                    telegram_send(f"#{row['id']} {row['name']} [{row['score']}]\n\n{row['draft']}")
        elif cmd in ("help", "start"):
            telegram_send("Commands: /report, /approve N, /reject N, /show N")
    except SystemExit as exc:
        telegram_send(str(exc))


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Symbio AI Outbound Lead Engine")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init", help="create the database + outbox").set_defaults(func=cmd_init)

    ing = sub.add_parser("ingest", help="ingest + audit + score + draft")
    ing.add_argument("--source", choices=["csv", "places"], default="csv")
    ing.add_argument("--file", help="CSV path (for --source csv)")
    ing.add_argument("--query", help="search query (for --source places)")
    ing.add_argument("--limit", type=int, default=0, help="cap number ingested")
    ing.add_argument("--llm", action="store_true", help="use Claude for drafts")
    ing.add_argument("--no-audit", action="store_true", help="skip the network site audit")
    ing.set_defaults(func=cmd_ingest)

    rep = sub.add_parser("report", help="print the ranked queue")
    rep.add_argument("--status", default="pending")
    rep.add_argument("--limit", type=int, default=15)
    rep.add_argument("--telegram", action="store_true", help="also push to Telegram")
    rep.set_defaults(func=cmd_report)

    show = sub.add_parser("show", help="show one lead + its draft")
    show.add_argument("id", type=int)
    show.set_defaults(func=cmd_show)

    ap = sub.add_parser("approve", help="approve a lead -> writes outbox message")
    ap.add_argument("id", type=int)
    ap.set_defaults(func=cmd_approve)

    rj = sub.add_parser("reject", help="reject a lead")
    rj.add_argument("id", type=int)
    rj.set_defaults(func=cmd_reject)

    sub.add_parser("stats", help="counts by status").set_defaults(func=cmd_stats)

    run = sub.add_parser("run", help="timer entrypoint: ingest seed + report")
    run.add_argument("--limit", type=int, default=0)
    run.add_argument("--llm", action="store_true")
    run.set_defaults(func=cmd_run)

    tg = sub.add_parser("telegram-poll", help="poll Telegram for /approve etc.")
    tg.add_argument("--once", action="store_true", help="process one batch then exit")
    tg.set_defaults(func=cmd_telegram_poll)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
