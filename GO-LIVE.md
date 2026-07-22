# Go-live — the one ordered checklist

Everything in this repo is **built, tested, and automated.** What's left is flipping the handful
of switches that need *your* real-world accounts (a domain, Stripe, Cloudflare, Telegram, a postal
address). This page is the **single ordered runbook** — do the steps top to bottom. Each one links
to the deep-dive doc if you want detail.

**Total hands-on time: ~90 minutes.** One thing (the sending domain) has a 2–3 week warm-up that
runs in the background — that's why it's **Step 0**: start the slow clock first, then do the fast,
revenue-producing flips while it warms.

> **Map of the docs:** this page (the sequence) → `LAUNCH.md` (the 3 paid switches in detail) →
> `TELEGRAM-SETUP.md` (lead alerts) → `infra/worker/README.md` (the alert Worker) →
> `HANDOFF.md` (run it locally / host it) → `GROWTH_PLAYBOOK.md` (the marketing engine) →
> `PROJECT_SUMMARY.md` (what was built, for sharing).

---

## Step 0 — Start the sending-domain warm-up *(5 min now, then it runs itself)*

This is first **only because it's slow.** Cold email from `symbioai.dev` would torch your real
domain, so outreach sends from a separate, warmed domain — and warm-up takes 2–3 weeks. Kick it
off today so it's ready by the time everything else is.

1. Buy a lookalike domain (`trysymbioai.com` / `getsymbioai.com`, ~$10/yr) and redirect it to
   `symbioai.dev`.
2. Create a mailbox (`ravi@trysymbioai.com`), set **SPF / DKIM / DMARC** (your host gives exact values).
3. Connect it to **Smartlead / Instantly / Saleshandy** and turn on **warm-up**. Walk away for 2–3 weeks.

→ Full detail: **`LAUNCH.md` § 3.** Then come back and do Steps 1–5 today.

---

## Step 1 — Get the code onto the live site *(foundation — everything else rides on this)*

`symbioai.dev` is served from **Mohammed's repo**, so changes only reach the public site once
they're merged there. This branch (`claude/automated-outreach-strategy-yzbxwx`) holds all the work.

- **If Mohammed runs the project locally:** he pulls this branch / applies the merged source zip,
  runs `npm install && npm run build`, and deploys `dist/` to his host. See **`HANDOFF.md`**.
- **Fastest path:** open a **new Claude Code session connected to Mohammed's repo** and have it
  pull these commits in directly. (This session is scoped to `ravikus1457/symbio-ai`, so it can't
  push to his repo — that's a per-session setting, not something I can change mid-run.)

✅ **Done when:** a change you made (e.g. the new `grow.html` page or the `buy.html` packages) is
visible on the live `symbioai.dev`.

---

## Step 2 — Turn on lead alerts (Telegram) *(~20 min — do this before outreach so you never miss a reply)*

Three pieces: **(a)** the chat ID, **(b)** the Worker deployed with the bot secrets, **(c)** the
site pointed at the Worker. You already created the bot (**@symbioaibot / SymbioAILeadsBot**).

**(a) Get the chat ID — the easy way (no token, no `getUpdates`):**
- **Alerts to your phone:** open Telegram → search **`@userinfobot`** → **Start**. It instantly
  replies `Id: 123456789` — that number is your chat ID. (You already pressed Start on
  @symbioaibot, so it's allowed to message you.)
- **Alerts to a shared group** (recommended — both founders see every lead): make a group, add
  **@symbioaibot** and (briefly) **@RawDataBot**. RawDataBot posts the group's ID — a **negative**
  number like `-1001234567890`. That's your chat ID; remove RawDataBot afterward.

> Why not `getUpdates`? It returns `[]` once a webhook is set (they're mutually exclusive), and the
> bot's own `/start` reply can't hand you the ID until the Worker below is deployed. @userinfobot
> sidesteps the whole chicken-and-egg. Keep the ID handy for (c).

**(b) Deploy the Worker** (needs Node + a free Cloudflare account, on a computer):
```bash
cd infra/worker
npx wrangler login                               # one time
npx wrangler deploy                              # prints https://symbio-scan.<you>.workers.dev
npx wrangler secret put TELEGRAM_BOT_TOKEN       # paste the bot token from BotFather
npx wrangler secret put TELEGRAM_CHAT_ID         # paste the ID from (a)
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET  # any random string you make up
npx wrangler deploy
```
Then register the webhook (same secret string), so `/start` also works later:
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://symbio-scan.<you>.workers.dev/api/telegram&secret_token=<the-same-secret>"
# expect {"ok":true,...,"description":"Webhook was set"}
```

**(c) Point the site at the Worker:** in `src/_data/site.js` set
`scanApi: "https://symbio-scan.<you>.workers.dev"`, then `npm run build` and redeploy (Step 1).
*(Empty `scanApi` = alerts are a safe no-op, nothing breaks.)*

✅ **Done when:** doing a free scan on the site buzzes your Telegram. Full detail: **`TELEGRAM-SETUP.md`**.

---

## Step 3 — Stripe self-serve checkout *(~20 min — turns the site into a cash register)*

Create **Payment Links** in Stripe (Products → Payment Links), then paste them in with one command:
```bash
npm run set-stripe -- speed-fix=https://buy.stripe.com/xxx website-7-days=https://buy.stripe.com/xxx \
  booking-system=https://buy.stripe.com/xxx ai-assistant=https://buy.stripe.com/xxx \
  widget-starter=https://buy.stripe.com/xxx widget-growth=https://buy.stripe.com/xxx widget-pro=https://buy.stripe.com/xxx
npm run build      # then redeploy (Step 1)
```
Any link you skip keeps a graceful fallback to the free-scan form — no dead buttons. Full price
table: **`LAUNCH.md` § 2.**

---

## Step 4 — Set the physical address (unblocks outreach) *(~15 min)*

CAN-SPAM requires a real postal address in every cold email — Hermes **refuses to generate
outreach until you set one.** Get a virtual mailbox (~$10–30/mo) and set it in
`tools/outreach.config.json`:
```json
"physicalAddress": "Symbio AI, 1234 Telegraph Ave Ste 100, Oakland, CA 94612",
```
Verify: `npm run hermes -- report` (the address box flips to `[x]`). Full detail: **`LAUNCH.md` § 1.**

---

## Step 5 — Light the free-marketing flywheel *(~30 min to start, then automated)*

No ad spend required. In priority order:

1. **Google Business Profile** — claim/complete it; it's the single biggest free local-search lever.
2. **Reviews + referrals** — set `googleReviewUrl` in `src/_data/site.js`; Hermes drafts the asks:
   `npm run hermes -- review`.
3. **Organic social** — `npm run hermes -- social` drafts posts across your angles (including the
   community/faith-business angles you asked for).
4. **Local SEO pages** — the 18 programmatic `grow.html` pages are live; enrich the 12 city pages
   with a local case study, then flip `INDEX_TIER_B = true` in `src/_data/landingPages.js`.

Full engine + targeting (dentists, restaurants, trades, Hindu/Muslim businesses, temples, mosques):
**`GROWTH_PLAYBOOK.md`.**

---

## Then it runs itself — the loop

Once Steps 0–5 are flipped, the daily/weekly motion is just feeding Hermes outcomes so it keeps
favouring what works:
```bash
npm run hermes -- outreach --in leads.csv   # generate (send from the warmed domain)
npm run hermes -- log --email owner@biz.com --replied   # also buzzes Telegram
npm run hermes -- log --email chef@bistro.com --booked
npm run hermes -- learn      # update winning subject lines / CTAs / marketing angles
npm run hermes -- report     # funnel dashboard
```
A weekly GitHub Action keeps the site building/linting and refreshes the report, so nothing
silently breaks.

---

### Quick status box — flip as you go

```
[ ] Step 0  Sending domain bought + warm-up started   (slow clock — do first)
[ ] Step 1  Code merged into Mohammed's live repo
[ ] Step 2  Telegram chat ID → Worker deployed → scanApi set   (alerts fire)
[ ] Step 3  Stripe Payment Links pasted                (self-serve revenue)
[ ] Step 4  Physical address set                       (outreach unblocked)
[ ] Step 5  GBP + reviews + social + Local SEO          (free flywheel)
```
