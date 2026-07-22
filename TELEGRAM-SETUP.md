# Telegram lead alerts — setup guide

Get a phone buzz the moment someone does a **free scan**, **chats** with the widget, runs an
**instant teardown**, or **replies** to outreach. Free. ~10 minutes. Steps are for the Telegram
**iOS** app, but Android/desktop are the same.

> What this connects: the site fires every lead event at the Cloudflare Worker
> (`infra/worker/`), which sends a Telegram message. So you need (1) a bot, (2) the Worker
> deployed with the bot's secrets, and (3) `scanApi` set in `src/_data/site.js` to the Worker URL.

---

## 1. Create the bot (BotFather)

1. Open Telegram → tap the **search bar** → type **`BotFather`** → open the one with the **blue ✓**.
2. Tap **Start**, then send **`/newbot`**.
3. Send a **name** (display name, e.g. `Symbio AI Leads`).
4. Send a **username** ending in `bot` (e.g. `SymbioAILeadsBot`).
5. BotFather replies with a **token** like `7712345678:AAH...`. **Copy it — that's `TELEGRAM_BOT_TOKEN`.** Treat it like a password.

**Deleted the BotFather chat?** No problem — your bots aren't deleted. Re-open BotFather (search
`@BotFather` → Start), send **`/mybots`**, tap your bot → **API Token** to see the token again.
(Never created one yet? Just send `/newbot`.)

---

## 2. Deploy the Worker with the bot secrets

```bash
cd infra/worker
npx wrangler login            # one time
npx wrangler deploy           # prints https://symbio-scan.<you>.workers.dev

npx wrangler secret put TELEGRAM_BOT_TOKEN       # paste the token from step 1
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET  # any random string you make up
npx wrangler deploy
```

Then point Telegram's webhook at the Worker (use the SAME secret string):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://symbio-scan.<you>.workers.dev/api/telegram&secret_token=<the-same-secret>"
```

You should see `{"ok":true,...,"description":"Webhook was set"}`.

---

## 3. Pick where alerts land, and grab the chat ID

**Recommended — a group (so both founders get pinged):**
1. Chats → top-right ✏️ → **New Group** → name it (e.g. "Symbio Leads"), add Mohammed.
2. Open the group → tap the **group name** → **Add Members** → search your bot's **@username** → add it. (An "can't read old messages" warning is fine.)
3. In the group, send **`/start@SymbioAILeadsBot`** → the bot replies with the **chat ID** (a negative number like `-1001234567890`).

**Or just your phone (DM):** open the bot (search its @username) → **Start** → send **`/start`** → it replies with your chat ID.

Then set it:
```bash
cd infra/worker
npx wrangler secret put TELEGRAM_CHAT_ID    # paste the chat ID from /start
npx wrangler deploy
```

**Deleted that chat later?** The chat ID dies with it — just redo step 3 (new chat → add bot →
`/start`) and update `TELEGRAM_CHAT_ID`.

---

## 4. Tell the site where the Worker is

In `src/_data/site.js`, set:
```js
scanApi: "https://symbio-scan.<you>.workers.dev",
```
…then `npm run build` and redeploy the site. (Empty `scanApi` = notifications are a safe no-op.)

---

## You're live

Now you'll get Telegram pings like:

```
🔔 Free scan — Doe Dental
👤 Jane Doe
✉️ jane@doe.test
🧩 Website
📍 https://symbioai.dev/scan.html
```

on every **free scan**, **chat lead**, and **instant teardown**.

### Reply alerts (optional)
`POST /api/reply` sends `💬 Reply from …`. Either:
- point your cold-email tool's (Smartlead/Instantly) **reply webhook** at
  `https://symbio-scan.<you>.workers.dev/api/reply`, or
- just use **`npm run hermes -- log --email x@biz.com --replied`** — it pings Telegram
  automatically (when `scanApi` is set) and records the reply for the learning loop.

---

## Troubleshooting

- **`/start` doesn't reply** → the webhook isn't set (step 2 `setWebhook`), or the
  `TELEGRAM_WEBHOOK_SECRET` you set doesn't match the one in the `setWebhook` URL.
- **No lead pings** → `TELEGRAM_CHAT_ID` not set/redeployed, or `scanApi` not set in `site.js`,
  or the Worker isn't deployed.
- **Check the webhook**: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.
- **Token leaked?** BotFather → `/mybots` → your bot → **Revoke current token**, then
  `npx wrangler secret put TELEGRAM_BOT_TOKEN` → `npx wrangler deploy` → re-run `setWebhook`.
- Secrets live only on the Worker (Cloudflare) — never commit the token to the repo.
