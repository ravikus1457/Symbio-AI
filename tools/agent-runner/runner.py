#!/usr/bin/env python3
"""
Symbio AI — Agent Runner (the chassis)
=====================================

The always-on brain for your Raspberry Pi. Everything else plugs into it:

  * scheduler  — runs your jobs on a cron/interval (lead engine, free scan, backups…)
  * telegram   — status, run-on-demand, and approvals from your phone
  * heartbeat  — proves the Pi is alive (and pings an uptime monitor if you set one)
  * webhook    — an optional HTTP endpoint so external events can trigger jobs
  * backups    — copies your SQLite state somewhere safe, with pruning

Jobs are declared in jobs.json — a job is just a command to run on a schedule.
The runner records every run, captures output, and notifies you per the job's
policy. State lives in one SQLite file. No third-party packages required.

    python3 runner.py init
    python3 runner.py jobs                 # list registered jobs
    python3 runner.py run backup           # run one job now
    python3 runner.py serve                # the long-running daemon (systemd runs this)
    python3 runner.py status               # health summary

Telegram (optional): set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. Then from your
phone: /status, /jobs, /run <job>, /enable <job>, /disable <job>, plus any
routes you define in jobs.json (e.g. /approve, /report, /scan) — which is how
lead-engine approvals reach your phone.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #

def _load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file(os.path.join(HERE, "config.env"))


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


DB_PATH = env("RUNNER_DB", os.path.join(HERE, "runner.db"))
JOBS_PATH = env("RUNNER_JOBS", os.path.join(HERE, "jobs.json"))
TICK_SEC = int(env("RUNNER_TICK_SEC", "30"))
HEARTBEAT_SEC = int(env("RUNNER_HEARTBEAT_SEC", "900"))
HEALTHCHECK_URL = env("RUNNER_HEALTHCHECK_URL", "")  # e.g. healthchecks.io ping URL
WEBHOOK_PORT = int(env("RUNNER_WEBHOOK_PORT", "0"))  # 0 = disabled
WEBHOOK_SECRET = env("RUNNER_WEBHOOK_SECRET", "")
TG_TOKEN = env("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = env("TELEGRAM_CHAT_ID", "")
BACKUP_DIR = env("RUNNER_BACKUP_DIR", os.path.join(HERE, "backups"))
BACKUP_PATHS = [p for p in env("RUNNER_BACKUP_PATHS", DB_PATH).split(",") if p.strip()]
BACKUP_KEEP = int(env("RUNNER_BACKUP_KEEP", "14"))
OUTPUT_TAIL = 1500

STOP = threading.Event()
_RUNNING: set[str] = set()
_RUNNING_LOCK = threading.Lock()
_DB_LOCK = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job TEXT NOT NULL, started_at TEXT, finished_at TEXT,
    exit_code INTEGER, status TEXT, trigger TEXT, output TEXT
);
CREATE TABLE IF NOT EXISTS job_state (
    job TEXT PRIMARY KEY, last_run_ts REAL DEFAULT 0,
    last_cron_key TEXT DEFAULT '', enabled INTEGER
);
CREATE TABLE IF NOT EXISTS heartbeat (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, note TEXT);
"""


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# --------------------------------------------------------------------------- #
# Schedule parsing  (cron: m h dom mon dow  |  interval: "every 30m")
# --------------------------------------------------------------------------- #

_UNIT = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_schedule(s: str) -> tuple[str, object]:
    s = (s or "").strip()
    if s.lower().startswith("cron:"):
        return "cron", s.split(":", 1)[1].strip()
    m = re.fullmatch(r"every\s+(\d+)\s*([smhd])", s, re.I)
    if m:
        return "interval", int(m.group(1)) * _UNIT[m.group(2).lower()]
    raise ValueError(f"bad schedule: {s!r} (use 'every 30m' or 'cron: 0 9 * * 1-5')")


def _field_match(field: str, value: int, lo: int, hi: int) -> bool:
    if field == "*":
        return True
    for part in field.split(","):
        step = 1
        rng = part
        if "/" in part:
            rng, step_s = part.split("/", 1)
            step = int(step_s)
        if rng == "*":
            start, end = lo, hi
        elif "-" in rng:
            a, b = rng.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(rng)
        if start <= value <= end and (value - start) % step == 0:
            return True
    return False


def cron_match(expr: str, dt: datetime) -> bool:
    fields = expr.split()
    if len(fields) != 5:
        raise ValueError(f"cron needs 5 fields: {expr!r}")
    mn, hr, dom, mon, dow = fields
    py_dow = dt.weekday()           # Mon=0..Sun=6
    cron_dow = (py_dow + 1) % 7     # Sun=0..Sat=6
    return (
        _field_match(mn, dt.minute, 0, 59)
        and _field_match(hr, dt.hour, 0, 23)
        and _field_match(dom, dt.day, 1, 31)
        and _field_match(mon, dt.month, 1, 12)
        and (_field_match(dow, cron_dow, 0, 6) or _field_match(dow, 7 if cron_dow == 0 else cron_dow, 0, 7))
    )


# --------------------------------------------------------------------------- #
# Jobs
# --------------------------------------------------------------------------- #

def load_jobs() -> list[dict]:
    if not os.path.exists(JOBS_PATH):
        return []
    with open(JOBS_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("jobs", []) if isinstance(data, dict) else data


def load_routes() -> dict:
    if not os.path.exists(JOBS_PATH):
        return {}
    with open(JOBS_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("telegram_routes", {}) if isinstance(data, dict) else {}


def job_by_name(name: str) -> dict | None:
    for j in load_jobs():
        if j.get("name") == name:
            return j
    return None


def effective_enabled(job: dict) -> bool:
    with _DB_LOCK, db() as conn:
        row = conn.execute("SELECT enabled FROM job_state WHERE job=?", (job["name"],)).fetchone()
    if row is not None and row["enabled"] is not None:
        return bool(row["enabled"])
    return bool(job.get("enabled", True))


def set_enabled(name: str, on: bool) -> None:
    with _DB_LOCK, db() as conn:
        conn.execute(
            "INSERT INTO job_state(job, enabled) VALUES(?,?) "
            "ON CONFLICT(job) DO UPDATE SET enabled=excluded.enabled",
            (name, int(on)),
        )
        conn.commit()


def _state(name: str) -> sqlite3.Row | None:
    with _DB_LOCK, db() as conn:
        return conn.execute("SELECT * FROM job_state WHERE job=?", (name,)).fetchone()


def _save_state(name: str, *, last_run_ts: float | None = None, last_cron_key: str | None = None) -> None:
    with _DB_LOCK, db() as conn:
        conn.execute("INSERT OR IGNORE INTO job_state(job) VALUES(?)", (name,))
        if last_run_ts is not None:
            conn.execute("UPDATE job_state SET last_run_ts=? WHERE job=?", (last_run_ts, name))
        if last_cron_key is not None:
            conn.execute("UPDATE job_state SET last_cron_key=? WHERE job=?", (last_cron_key, name))
        conn.commit()


def dispatch(job: dict, trigger: str = "schedule") -> None:
    """Run a job's command, record the run, notify per policy. Thread-safe."""
    name = job["name"]
    with _RUNNING_LOCK:
        if name in _RUNNING:
            log(f"skip {name}: already running")
            return
        _RUNNING.add(name)
    started = now_iso()
    cmd = job["cmd"]
    argv = cmd if isinstance(cmd, list) else shlex.split(cmd)
    cwd = job.get("cwd") or HERE
    cwd = cwd if os.path.isabs(cwd) else os.path.join(HERE, cwd)
    timeout = int(job.get("timeout", 600))
    log(f"run {name}: {' '.join(argv)}  (trigger={trigger})")
    try:
        proc = subprocess.run(
            argv, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=os.environ.copy()
        )
        out = ((proc.stdout or "") + (proc.stderr or "")).strip()[-OUTPUT_TAIL:]
        code, status = proc.returncode, ("ok" if proc.returncode == 0 else "failed")
    except subprocess.TimeoutExpired:
        out, code, status = f"timed out after {timeout}s", 124, "timeout"
    except Exception as exc:  # noqa: BLE001
        out, code, status = f"{type(exc).__name__}: {exc}", 1, "error"
    finished = now_iso()

    with _DB_LOCK, db() as conn:
        conn.execute(
            "INSERT INTO runs(job,started_at,finished_at,exit_code,status,trigger,output) "
            "VALUES(?,?,?,?,?,?,?)",
            (name, started, finished, code, status, trigger, out),
        )
        conn.commit()
    _save_state(name, last_run_ts=time.time())
    with _RUNNING_LOCK:
        _RUNNING.discard(name)

    policy = job.get("notify_on", "failure")
    if policy == "always" or (policy == "failure" and status != "ok"):
        emoji = "✅" if status == "ok" else "⚠️"
        tg_send(f"{emoji} {name} — {status} (exit {code})\n{out[-1200:]}")
    log(f"done {name}: {status} (exit {code})")


# --------------------------------------------------------------------------- #
# Telegram
# --------------------------------------------------------------------------- #

def tg_enabled() -> bool:
    return bool(TG_TOKEN and TG_CHAT)


def tg_send(text: str) -> None:
    if not tg_enabled():
        return
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    data = urllib.parse.urlencode(
        {"chat_id": TG_CHAT, "text": text[:4000], "disable_web_page_preview": "true"}
    ).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=15)
    except Exception as exc:  # noqa: BLE001
        log(f"tg send failed: {exc}")


def _tg_get(url: str, timeout: int = 60) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def tg_loop() -> None:
    base = f"https://api.telegram.org/bot{TG_TOKEN}"
    # Skip backlog: start after the latest pending update.
    offset = 0
    try:
        seed = _tg_get(f"{base}/getUpdates?offset=-1&timeout=0", timeout=15)
        res = seed.get("result", [])
        if res:
            offset = res[-1]["update_id"] + 1
    except Exception as exc:  # noqa: BLE001
        log(f"tg seed failed: {exc}")
    tg_send("🤖 Agent runner online. Send /help.")
    while not STOP.is_set():
        try:
            data = _tg_get(f"{base}/getUpdates?timeout=30&offset={offset}", timeout=40)
        except Exception as exc:  # noqa: BLE001
            log(f"tg poll error: {exc}")
            STOP.wait(5)
            continue
        for upd in data.get("result", []):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or {}
            if str(msg.get("chat", {}).get("id")) != str(TG_CHAT):
                continue
            handle_tg(msg.get("text", "") or "")


def handle_tg(text: str) -> None:
    parts = text.split()
    if not parts:
        return
    cmd = parts[0].lstrip("/").lower()
    args = parts[1:]
    try:
        if cmd in ("help", "start"):
            routes = ", ".join("/" + k for k in load_routes())
            tg_send("Commands: /status /jobs /run <job> /enable <job> /disable <job>"
                    + (f"\nRoutes: {routes}" if routes else ""))
        elif cmd == "status":
            tg_send(status_text())
        elif cmd == "jobs":
            tg_send(jobs_text())
        elif cmd == "run" and args:
            j = job_by_name(args[0])
            if not j:
                tg_send(f"no job '{args[0]}'")
            else:
                tg_send(f"▶️ running {args[0]}…")
                threading.Thread(target=dispatch, args=(j, "telegram"), daemon=True).start()
        elif cmd in ("enable", "disable") and args:
            set_enabled(args[0], cmd == "enable")
            tg_send(f"{args[0]} {cmd}d")
        else:
            _run_route(cmd, args)
    except Exception as exc:  # noqa: BLE001
        tg_send(f"error: {exc}")


def _run_route(cmd: str, args: list[str]) -> None:
    routes = load_routes()
    route = routes.get(cmd)
    if not route:
        tg_send(f"unknown command '{cmd}'. /help")
        return
    base = route["cmd"] if isinstance(route["cmd"], list) else shlex.split(route["cmd"])
    cwd = route.get("cwd") or HERE
    cwd = cwd if os.path.isabs(cwd) else os.path.join(HERE, cwd)
    try:
        proc = subprocess.run(base + args, cwd=cwd, capture_output=True, text=True,
                              timeout=int(route.get("timeout", 120)), env=os.environ.copy())
        out = ((proc.stdout or "") + (proc.stderr or "")).strip()[-3500:]
        tg_send(out or f"(no output, exit {proc.returncode})")
    except Exception as exc:  # noqa: BLE001
        tg_send(f"route '{cmd}' failed: {exc}")


# --------------------------------------------------------------------------- #
# Heartbeat + backups
# --------------------------------------------------------------------------- #

def heartbeat_loop() -> None:
    while not STOP.is_set():
        with _DB_LOCK, db() as conn:
            conn.execute("INSERT INTO heartbeat(ts, note) VALUES(?, ?)", (now_iso(), "alive"))
            conn.execute("DELETE FROM heartbeat WHERE id NOT IN "
                         "(SELECT id FROM heartbeat ORDER BY id DESC LIMIT 500)")
            conn.commit()
        if HEALTHCHECK_URL:
            try:
                urllib.request.urlopen(HEALTHCHECK_URL, timeout=10)
            except Exception as exc:  # noqa: BLE001
                log(f"healthcheck ping failed: {exc}")
        STOP.wait(HEARTBEAT_SEC)


def do_backup() -> str:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    copied = []
    for path in BACKUP_PATHS:
        path = path.strip()
        if not path or not os.path.exists(path):
            continue
        dst = os.path.join(BACKUP_DIR, f"{os.path.basename(path)}.{stamp}.bak")
        # For SQLite, use the backup API for a consistent copy; else plain copy.
        if path.endswith(".db"):
            try:
                src = sqlite3.connect(path)
                out = sqlite3.connect(dst)
                with out:
                    src.backup(out)
                src.close()
                out.close()
            except Exception:  # noqa: BLE001
                shutil.copy2(path, dst)
        else:
            shutil.copy2(path, dst)
        copied.append(os.path.basename(dst))
    # prune
    files = sorted(
        (f for f in os.listdir(BACKUP_DIR) if f.endswith(".bak")),
        key=lambda f: os.path.getmtime(os.path.join(BACKUP_DIR, f)),
        reverse=True,
    )
    for old in files[BACKUP_KEEP * max(1, len(BACKUP_PATHS)):]:
        try:
            os.remove(os.path.join(BACKUP_DIR, old))
        except OSError:
            pass
    return f"backed up {len(copied)} file(s) to {BACKUP_DIR}: {', '.join(copied) or 'nothing'}"


# --------------------------------------------------------------------------- #
# Webhook server (optional)
# --------------------------------------------------------------------------- #

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silence default logging
        pass

    def _send(self, code: int, body: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):  # noqa: N802
        if self.path.split("?")[0] == "/health":
            with _DB_LOCK, db() as conn:
                row = conn.execute("SELECT ts FROM heartbeat ORDER BY id DESC LIMIT 1").fetchone()
            self._send(200, f"ok last_heartbeat={row['ts'] if row else 'none'}")
        else:
            self._send(404, "not found")

    def do_POST(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        m = re.fullmatch(r"/hook/([A-Za-z0-9_-]+)", parsed.path)
        if not m:
            return self._send(404, "not found")
        token = urllib.parse.parse_qs(parsed.query).get("token", [""])[0] or self.headers.get("X-Token", "")
        if not WEBHOOK_SECRET or token != WEBHOOK_SECRET:
            return self._send(403, "forbidden")
        name = m.group(1)
        job = job_by_name(name)
        if not job:
            return self._send(404, f"no job {name}")
        threading.Thread(target=dispatch, args=(job, "webhook"), daemon=True).start()
        self._send(200, f"triggered {name}")


def webhook_serve(httpd: ThreadingHTTPServer) -> None:
    log(f"webhook listening on :{WEBHOOK_PORT}  (POST /hook/<job>?token=…, GET /health)")
    httpd.serve_forever(poll_interval=1)


# --------------------------------------------------------------------------- #
# Scheduler
# --------------------------------------------------------------------------- #

def scheduler_tick(jobs: list[dict], *, block: bool = False) -> list[str]:
    fired = []
    now = datetime.now()
    cron_key = now.strftime("%Y-%m-%d %H:%M")
    for job in jobs:
        if not effective_enabled(job):
            continue
        try:
            kind, val = parse_schedule(job.get("schedule", ""))
        except ValueError as exc:
            log(f"bad schedule for {job.get('name')}: {exc}")
            continue
        st = _state(job["name"])
        due = False
        if kind == "cron":
            if cron_match(val, now) and (not st or st["last_cron_key"] != cron_key):
                due = True
                _save_state(job["name"], last_cron_key=cron_key)
        else:  # interval
            last = st["last_run_ts"] if st else 0
            if time.time() - (last or 0) >= val:
                due = True
        if due:
            fired.append(job["name"])
            if block:
                dispatch(job, "schedule")
            else:
                threading.Thread(target=dispatch, args=(job, "schedule"), daemon=True).start()
    return fired


def scheduler_loop() -> None:
    while not STOP.is_set():
        try:
            scheduler_tick(load_jobs())
        except Exception as exc:  # noqa: BLE001
            log(f"scheduler error: {exc}")
        STOP.wait(TICK_SEC)


# --------------------------------------------------------------------------- #
# Reporting helpers
# --------------------------------------------------------------------------- #

def jobs_text() -> str:
    jobs = load_jobs()
    if not jobs:
        return "No jobs defined (jobs.json)."
    lines = []
    for j in jobs:
        st = _state(j["name"])
        last = st["last_run_ts"] if st else 0
        when = datetime.fromtimestamp(last).strftime("%m-%d %H:%M") if last else "never"
        on = "on " if effective_enabled(j) else "OFF"
        lines.append(f"[{on}] {j['name']:<16} {j.get('schedule',''):<18} last:{when}")
    return "Jobs:\n" + "\n".join(lines)


def status_text() -> str:
    with _DB_LOCK, db() as conn:
        hb = conn.execute("SELECT ts FROM heartbeat ORDER BY id DESC LIMIT 1").fetchone()
        recent = conn.execute(
            "SELECT job,status,exit_code,finished_at FROM runs ORDER BY id DESC LIMIT 6"
        ).fetchall()
        fails = conn.execute(
            "SELECT COUNT(*) c FROM runs WHERE status!='ok' AND finished_at >= ?",
            (datetime.now().strftime("%Y-%m-%d 00:00:00"),),
        ).fetchone()["c"]
    lines = [f"Runner status @ {now_iso()}",
             f"  last heartbeat: {hb['ts'] if hb else 'none'}",
             f"  failures today: {fails}",
             "  recent runs:"]
    for r in recent:
        lines.append(f"    {r['finished_at']}  {r['job']}  {r['status']} ({r['exit_code']})")
    if not recent:
        lines.append("    (none yet)")
    return "\n".join(lines)


def log(msg: str) -> None:
    print(f"[{now_iso()}] {msg}", flush=True)


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

def cmd_init(_a):
    with db() as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    os.makedirs(BACKUP_DIR, exist_ok=True)
    print(f"Initialized {DB_PATH}")
    print(f"Jobs file:   {JOBS_PATH}  ({'found' if os.path.exists(JOBS_PATH) else 'MISSING — copy jobs.sample.json'})")


def cmd_jobs(_a):
    print(jobs_text())


def cmd_status(_a):
    print(status_text())


def cmd_run(a):
    j = job_by_name(a.job)
    if not j:
        raise SystemExit(f"no job '{a.job}'")
    dispatch(j, "manual")


def cmd_enable(a):
    set_enabled(a.job, True)
    print(f"{a.job} enabled")


def cmd_disable(a):
    set_enabled(a.job, False)
    print(f"{a.job} disabled")


def cmd_backup(_a):
    print(do_backup())


def cmd_log(a):
    with _DB_LOCK, db() as conn:
        q = "SELECT * FROM runs"
        params: tuple = ()
        if a.job:
            q += " WHERE job=?"
            params = (a.job,)
        q += " ORDER BY id DESC LIMIT ?"
        rows = conn.execute(q, params + (a.limit,)).fetchall()
    for r in reversed(rows):
        print(f"#{r['id']} {r['finished_at']} {r['job']} [{r['status']} {r['exit_code']}] ({r['trigger']})")
        if a.verbose and r["output"]:
            print("    " + r["output"].replace("\n", "\n    "))


def cmd_serve(a):
    with db() as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    if a.once:
        fired = scheduler_tick(load_jobs(), block=True)
        print(f"tick fired: {fired or 'nothing due'}")
        return

    def _stop(*_):
        log("shutting down…")
        STOP.set()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    threads = [threading.Thread(target=scheduler_loop, daemon=True, name="scheduler"),
               threading.Thread(target=heartbeat_loop, daemon=True, name="heartbeat")]
    if tg_enabled():
        threads.append(threading.Thread(target=tg_loop, daemon=True, name="telegram"))
    else:
        log("telegram disabled (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)")

    httpd = None
    if WEBHOOK_PORT:
        httpd = ThreadingHTTPServer(("0.0.0.0", WEBHOOK_PORT), Handler)
        threads.append(threading.Thread(target=webhook_serve, args=(httpd,), daemon=True, name="webhook"))

    for t in threads:
        t.start()
    log(f"agent runner up — {len(load_jobs())} job(s), tick {TICK_SEC}s")
    try:
        while not STOP.is_set():
            STOP.wait(1)
    finally:
        if httpd:
            httpd.shutdown()
    log("stopped")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Symbio AI agent runner")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(func=cmd_init)
    sub.add_parser("jobs").set_defaults(func=cmd_jobs)
    sub.add_parser("status").set_defaults(func=cmd_status)
    sub.add_parser("backup").set_defaults(func=cmd_backup)
    r = sub.add_parser("run"); r.add_argument("job"); r.set_defaults(func=cmd_run)
    en = sub.add_parser("enable"); en.add_argument("job"); en.set_defaults(func=cmd_enable)
    di = sub.add_parser("disable"); di.add_argument("job"); di.set_defaults(func=cmd_disable)
    lg = sub.add_parser("log")
    lg.add_argument("job", nargs="?"); lg.add_argument("--limit", type=int, default=15)
    lg.add_argument("--verbose", "-v", action="store_true"); lg.set_defaults(func=cmd_log)
    sv = sub.add_parser("serve")
    sv.add_argument("--once", action="store_true", help="run one scheduler tick and exit")
    sv.set_defaults(func=cmd_serve)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
