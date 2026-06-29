# Symbio AI — Outbound Lead Engine

A small, dependency-light agent for your Raspberry Pi (or any always-on box). It
finds local businesses with a weak web presence, scores the opportunity, drafts a
personalized first-touch message, and queues everything **for you to approve before
anything is sent**. Approve-before-send is the whole design — the engine never
contacts anyone on its own.

```
CSV / Places ──▶ audit web presence ──▶ score + draft ──▶ queue (SQLite)
                                                              │
                              you review (terminal or Telegram)
                                                              │
                                        approve ──▶ ./outbox/lead-XXXX.txt  (you send)
```

Core runs on the **Python standard library alone** — no `pip install` needed to
start. Two optional upgrades: Claude-written drafts (`--llm`) and a Google Places
source (`--source places`).

## Quick start

```bash
cd tools/lead-engine
python3 leadengine.py init
python3 leadengine.py ingest --file seeds/businesses.sample.csv
python3 leadengine.py report
python3 leadengine.py show 1
python3 leadengine.py approve 1        # writes ./outbox/lead-0001-*.txt
python3 leadengine.py stats
```

Then copy `config.env.sample` → `config.env` and set at least your sender identity
(`SYMBIO_SENDER_NAME`, `SYMBIO_CONTACT`).

## How it works

1. **Ingest** — `--source csv` reads a list you control (no scraping). `--source
   places` pulls from the Google Places API (needs `PLACES_API_KEY`).
2. **Audit** — for each business it fetches the site and checks: reachable? HTTPS?
   mobile-friendly (viewport)? has a title + meta description? any booking/contact
   path? No website at all = the hottest lead.
3. **Score** — 0–99 opportunity score. No site (95) and dead site (88) rank highest;
   live-but-weak sites score by how many issues they have.
4. **Draft** — a personalized message that references the *specific* issues found.
   Template by default (zero deps); `--llm` uses Claude (`claude-opus-4-8`) for a
   more natural version, falling back to the template if the API is unavailable.
5. **Queue & approve** — everything lands in SQLite as `pending`. You `report`,
   `approve`/`reject`. Approving writes a ready-to-send file to `./outbox/`.

## Commands

| Command | What it does |
| --- | --- |
| `init` | Create the database and `outbox/`. |
| `ingest --file X.csv [--llm] [--limit N] [--no-audit]` | Ingest, audit, score, draft. |
| `ingest --source places --query "auto detailing in Concord CA"` | Pull from Google Places. |
| `report [--status pending] [--limit N] [--telegram]` | Print the ranked queue. |
| `show <id>` | Show one lead and its full draft. |
| `approve <id>` / `reject <id>` | Approve (writes outbox file) or reject. |
| `stats` | Counts by status. |
| `run` | Timer entrypoint: ingest `LEADENGINE_SEED_CSV`, then report (to Telegram if configured). |
| `telegram-poll` | Long-poll Telegram for `/report`, `/approve N`, `/reject N`, `/show N`. |

CSV columns (header row required): `name, website, phone, email, category, area`.
Only `name` is required.

## Approve from your phone (Telegram)

1. Create a bot with [@BotFather](https://t.me/BotFather), grab the token.
2. Message your bot once, then get your chat id (e.g. via `getUpdates`).
3. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `config.env`.
4. `report --telegram` pushes the queue; run `telegram-poll` (a second service) to
   accept `/approve 3` etc. from your phone. The poller only obeys your chat id.

## Schedule it (systemd)

```bash
# edit User= and paths in systemd/leadengine.service first
sudo cp systemd/leadengine.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now leadengine.timer
systemctl list-timers leadengine.timer      # confirm next run
```

The timer runs `leadengine.py run`, which ingests `LEADENGINE_SEED_CSV` and reports.
To accept approvals from your phone around the clock, also run `telegram-poll` as a
long-running `simple` service.

## ⚖️ Compliance — read this before you send

The engine drafts and queues; **you** send, and the legal duty is yours:

- **Cold email → CAN-SPAM:** identify yourself, use a real reply-to, include a
  physical mailing address, and honor opt-outs promptly. The drafts include your
  identity + an opt-out line; add your address in your mail client/footer.
- **SMS → TCPA + A2P 10DLC:** texting businesses you have no relationship with
  carries real restrictions. **Register your number/brand for A2P 10DLC** before
  sending at any volume — unregistered traffic gets blocked or fined.
- **Scraping → ToS:** the CSV source does no scraping. The Places source is
  subject to Google's Terms of Service (respect caching/retention limits and rate
  limits). Don't point this at sources that forbid automated collection.
- **Keep it honest:** drafts reference only the issues actually found. Don't add
  invented metrics or fake urgency.

## Extending it

- **More sources:** add a `source_*()` function returning `list[Business]` and wire
  it into `cmd_ingest`. Yelp Fusion, a CRM export, or a partner referral list are
  natural next ones.
- **Real sending:** wire `approve` to your email/SMS provider once you've handled
  compliance — keep the human approval step in front of it.
- **Better audits:** swap the regex checks for Lighthouse/PageSpeed if you want
  performance scores (heavier; consider running it off-Pi).

## Files

```
leadengine.py            # the whole engine (stdlib + optional anthropic)
seeds/businesses.sample.csv
config.env.sample        # copy to config.env
systemd/leadengine.{service,timer}
```

Built by Symbio AI.
