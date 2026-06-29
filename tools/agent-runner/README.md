# Symbio AI — Agent Runner (the chassis)

The always-on brain for your Pi. Everything else plugs into it:

- **scheduler** — runs your jobs on a cron/interval (lead engine, free scan, backups…)
- **telegram** — `/status`, `/run`, and approvals from your phone
- **heartbeat** — proves the Pi is alive (and pings an uptime monitor if set)
- **webhook** — optional HTTP endpoint so external events can trigger jobs
- **backups** — copies your SQLite state somewhere safe, with pruning

A job is just **a command on a schedule**. State lives in one SQLite file. No
third-party packages — pure standard library.

```
            ┌──────────────── agent-runner (systemd) ────────────────┐
 cron/every │ scheduler ─▶ runs jobs ─▶ records + notifies           │
   Telegram │ poller    ─▶ /status /run /approve /report /scan        │
   webhook  │ POST /hook/<job> ─▶ trigger a job (Stripe, form, CI…)   │
  heartbeat │ alive + healthcheck ping + nightly backups              │
            └─────────────────────────────────────────────────────────┘
 jobs: lead-engine · free-scan · backup · (anything you add)
```

## Setup

```bash
cd tools/agent-runner
cp config.env.sample config.env      # set Telegram + paths
cp jobs.sample.json  jobs.json       # define your jobs
python3 runner.py init
python3 runner.py jobs               # list registered jobs
python3 runner.py run backup         # run one now
python3 runner.py serve              # start the daemon (Ctrl-C to stop)
```

Run it for real under systemd:

```bash
sudo cp systemd/agent-runner.service /etc/systemd/system/   # edit User=/paths first
sudo systemctl daemon-reload && sudo systemctl enable --now agent-runner
journalctl -u agent-runner -f
```

## jobs.json

```json
{
  "jobs": [
    { "name": "lead-engine", "schedule": "cron: 0 8 * * 1-5",
      "cmd": "python3 leadengine.py run", "cwd": "../lead-engine",
      "notify_on": "always", "timeout": 900 }
  ],
  "telegram_routes": {
    "approve": { "cmd": "python3 leadengine.py approve", "cwd": "../lead-engine" }
  }
}
```

- **schedule:** `every 30m` / `every 2h` / `every 1d`, or `cron: m h dom mon dow`
  (supports `*`, lists `1,3`, ranges `1-5`, steps `*/15`).
- **cmd:** string (split safely, no shell) or a list. **cwd** is relative to the
  runner dir, so jobs find their own `config.env`.
- **notify_on:** `always` | `failure` | `never`.
- **telegram_routes:** map a chat keyword to a command. `/approve 3` runs the
  lead engine's approve in `../lead-engine` and sends the output back — that's how
  lead-engine approvals reach your phone.

## Commands

| Command | Does |
| --- | --- |
| `init` | Create the DB + backups dir. |
| `serve [--once]` | Run the daemon (`--once` = a single scheduler tick, for testing). |
| `jobs` / `status` / `log [job] [-v]` | Inspect registry, health, run history. |
| `run <job>` | Run a job now. |
| `enable <job>` / `disable <job>` | Toggle a job without editing jobs.json. |
| `backup` | Back up `RUNNER_BACKUP_PATHS` now. |

## Telegram

Set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. The poller only obeys your chat id.
Built-ins: `/status`, `/jobs`, `/run <job>`, `/enable <job>`, `/disable <job>`,
`/help`. Anything in `telegram_routes` becomes a command too (`/report`,
`/approve 3`, `/scan https://site.com`). Job results are pushed per `notify_on`.

## Webhook (optional)

Set `RUNNER_WEBHOOK_PORT` + `RUNNER_WEBHOOK_SECRET`. Then:

- `POST /hook/<job>?token=SECRET` triggers that job (wire Stripe, a form, GitHub).
- `GET /health` returns the last heartbeat (point an uptime monitor at it).

To reach it from the internet without opening ports, run a Cloudflare Tunnel:
`cloudflared tunnel --url http://localhost:<port>`.

## Heartbeat & backups

Every `RUNNER_HEARTBEAT_SEC` the runner writes a heartbeat and, if
`RUNNER_HEALTHCHECK_URL` is set, pings it — so a dead Pi alerts you. Register the
`backup` job (in jobs.sample.json) to copy your SQLite DBs nightly; SQLite files
are copied with the consistent backup API and pruned to `RUNNER_BACKUP_KEEP`.

> SD cards die. Point `RUNNER_BACKUP_DIR` at an SSD or a synced folder, and keep a
> copy off the Pi.

## How the tools compose

```
agent-runner ──schedules──▶ lead-engine (finds + queues prospects)
            └─routes /scan─▶ free-scan  (generates the report you hand them)
            └─nightly──────▶ backup
   you ──/report, /approve 3, /scan url──▶ from your phone
```

Built by Symbio AI.
