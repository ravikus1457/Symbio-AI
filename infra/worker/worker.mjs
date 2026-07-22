/**
 * Symbio AI — instant teardown Worker (Cloudflare).
 *
 * Two endpoints, both CORS-enabled, zero dependencies (reuses the shared, pure
 * scan engine in tools/lib/scan-core.mjs — same logic as the CLI tools):
 *
 *   POST /api/scan  { "url": "example.com" }
 *     → { ok, reachable, score, findings: [{title, fix}, ...] }
 *       Powers the live on-page teardown (teardown.html). No email needed.
 *
 *   POST /api/lead  { "name", "email", "business", "need" }
 *     → sends an instant auto-reply to the lead (speed-to-lead) IF the
 *       RESEND_API_KEY + LEAD_FROM secrets are set; always returns { ok }.
 *
 * Deploy: see infra/worker/README.md. Set the deployed URL in site.js `scanApi`.
 */

import { normalizeUrl, fetchSite, findings } from "../../tools/lib/scan-core.mjs";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// 0–100 friendliness score from the findings' severities.
function scoreFrom(found) {
  const penalty = found.reduce((a, f) => a + f.sev * 9, 0);
  return Math.max(5, Math.min(100, 100 - penalty));
}

async function handleScan(req, env) {
  const { url } = await readJson(req);
  const norm = normalizeUrl(url);
  if (!norm) return json({ ok: false, error: "Please include a website URL." }, 400, env);

  const scan = await fetchSite(norm, { timeout: 8000 });
  const found = findings(scan, { website: norm });
  const top = found.slice(0, 3).map((f) => ({ title: f.title, fix: f.fix }));
  return json(
    { ok: true, url: norm, reachable: !!scan.ok, score: scoreFrom(found), findings: top },
    200,
    env
  );
}

// Low-level Telegram send to a specific chat.
async function tgSend(env, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Instant team notification to Telegram (free). Set TELEGRAM_BOT_TOKEN +
// TELEGRAM_CHAT_ID to enable. Fires on every scan / chat lead / teardown.
async function sendTelegram(env, lead) {
  const c = (s) => (s == null ? "" : String(s).trim());
  const link = c(lead.link) || c(lead.website) || c(lead.url);
  const lines = [
    `🔔 ${c(lead.type) || "New lead"} — ${c(lead.business) || c(lead.name) || "someone"}`,
    c(lead.name) && `👤 ${c(lead.name)}`,
    c(lead.business) && `🏢 ${c(lead.business)}`,
    c(lead.email) && `✉️ ${c(lead.email)}`,
    c(lead.phone) && `📞 ${c(lead.phone)}`,
    c(lead.need) && `🧩 ${c(lead.need)}`,
    link && `🔗 ${link}`,
    (c(lead.problem) || c(lead.detail)) && `📝 ${c(lead.problem) || c(lead.detail)}`,
    c(lead.sourceUrl) && `📍 ${c(lead.sourceUrl)}`,
  ].filter(Boolean);
  return tgSend(env, env.TELEGRAM_CHAT_ID, lines.join("\n"));
}

// Telegram webhook — replies to /start with the chat id (so setup is one tap)
// and acknowledges any message. Point Telegram's webhook at /api/telegram.
async function handleTelegram(req, env) {
  if (env.TELEGRAM_WEBHOOK_SECRET && req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false }, 401, env);
  }
  const update = await readJson(req);
  const msg = update.message || update.edited_message || update.channel_post;
  const chatId = msg && msg.chat && msg.chat.id;
  const text = ((msg && msg.text) || "").trim();
  if (env.TELEGRAM_BOT_TOKEN && chatId != null) {
    const reply = text.startsWith("/start")
      ? `✅ Symbio AI bot connected!\n\nThis chat's ID is:  ${chatId}\n\nSet it as the TELEGRAM_CHAT_ID secret on your Worker and you'll get a ping here every time someone does a free scan, chats, or runs a teardown.`
      : `👍 Got it. Lead alerts will arrive in this chat.\n(Chat ID: ${chatId})`;
    await tgSend(env, chatId, reply);
  }
  return json({ ok: true }, 200, env); // Telegram expects a 200
}

// Reply notification — point your cold-email tool's reply webhook here, or
// Hermes `log --replied` pings it, so prospect replies hit your Telegram too.
async function handleReply(req, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json({ ok: true, telegram: false }, 200, env);
  const r = await readJson(req);
  const c = (s) => (s == null ? "" : String(s).trim());
  const who = c(r.company) || c(r.from) || c(r.name) || c(r.email) || "a prospect";
  const lines = [
    `💬 ${c(r.kind) || "Reply"} from ${who}`,
    c(r.email) && `✉️ ${c(r.email)}`,
    c(r.subject) && `✏️ ${c(r.subject)}`,
    c(r.message) && `📝 ${c(r.message).slice(0, 400)}`,
    c(r.variant) && `🎯 variant: ${c(r.variant)}`,
  ].filter(Boolean);
  const ok = await tgSend(env, env.TELEGRAM_CHAT_ID, lines.join("\n"));
  return json({ ok: true, telegram: ok }, 200, env);
}

async function handleLead(req, env) {
  const lead = await readJson(req);
  const email = (lead.email || "").trim();
  const first = (lead.name || "there").trim().split(/\s+/)[0] || "there";
  const biz = (lead.business || "your business").trim();

  // 1) Instant Telegram ping to the team (independent of email/auto-reply).
  let telegram = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) telegram = await sendTelegram(env, lead);

  // 2) Speed-to-lead auto-reply to the lead, if a mail provider is configured.
  let sent = false;
  if (env.RESEND_API_KEY && env.LEAD_FROM && email) {
    const address = env.PHYSICAL_ADDRESS || "";
    const body =
      `Hi ${first},\n\nThanks for reaching out about ${biz} — got it. A real person will reply ` +
      `within one business day. In the meantime, reply here with anything you want us to look at first.\n\n` +
      `— Symbio AI\nhttps://symbioai.dev` + (address ? `\n\n${address}` : "");
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.LEAD_FROM,
          to: email,
          ...(env.LEAD_BCC ? { bcc: env.LEAD_BCC } : {}),
          subject: `Thanks ${first} — we got it`,
          text: body,
        }),
      });
      sent = res.ok;
    } catch {
      sent = false;
    }
  }

  return json({ ok: true, telegram, sent }, 200, env);
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(env) });
    if (req.method === "POST" && pathname === "/api/scan") return handleScan(req, env);
    if (req.method === "POST" && pathname === "/api/lead") return handleLead(req, env);
    if (req.method === "POST" && pathname === "/api/reply") return handleReply(req, env);
    if (req.method === "POST" && pathname === "/api/telegram") return handleTelegram(req, env);
    return json({ ok: false, error: "Not found. POST /api/scan, /api/lead, /api/reply, or /api/telegram." }, 404, env);
  },
};
