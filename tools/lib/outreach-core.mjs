/**
 * outreach-core.mjs — shared engine for the audit/outreach tooling.
 *
 * Pure Node, ZERO dependencies (Node 18+ global fetch). Used by BOTH:
 *   - tools/audit-outreach.mjs  (the simple one-shot CLI)
 *   - tools/hermes/hermes.mjs   (the orchestrator + learning loop)
 *
 * Keeping the scan + finding + email logic here means there is one source of
 * truth for how a prospect becomes a personalized, CAN-SPAM-compliant email.
 */

export const DEFAULT_UA =
  "SymbioAuditBot/1.0 (+https://symbioai.dev; site audit for outreach — contact via the site)";

export const DEFAULT_CONFIG = {
  fromName: "Ravi",
  company: "Symbio AI",
  serviceLine: "I build fast websites, booking systems, and AI assistants for local businesses.",
  websiteUrl: "https://symbioai.dev",
  physicalAddress: "Symbio AI — <add your mailing address>, <City, ST ZIP>",
  unsubscribeLine: "Not relevant? Reply 'unsubscribe' and you won't hear from me again.",
  cta: 'Want the full one-page teardown (free, no obligation)? Just reply "send it".',
};

/* ---- small helpers --------------------------------------------------- */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CAN-SPAM: every commercial email needs a REAL postal address. Refuse to
// generate sendable bodies while the config still holds the placeholder.
export function addressIsPlaceholder(cfg) {
  return /<add your|<City, ST ZIP>/i.test(cfg.physicalAddress || "");
}

// SSRF guard: block loopback / private / link-local / cloud-metadata hosts so a
// hostile prospects list can't point the scanner at internal addresses.
export function hostIsPrivate(hostname) {
  const h = (hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "::1" || h.endsWith(".localhost")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  }
  return false;
}

export function firstNameOf(row) {
  return row.first_name ? row.first_name.trim() : "there";
}

export function normalizeUrl(raw) {
  const t = (raw || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "https://" + t.replace(/^\/+/, "");
}

export function businessOf(row) {
  if (row.business) return row.business.trim();
  if (row.website) {
    try {
      return new URL(normalizeUrl(row.website)).hostname.replace(/^www\./, "");
    } catch {
      return "your business";
    }
  }
  return "your business";
}

/* ---- minimal CSV ----------------------------------------------------- */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] || "").trim();
    });
    return obj;
  });
}

export function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(objects, columns) {
  const lines = [columns.join(",")];
  for (const o of objects) lines.push(columns.map((c) => csvCell(o[c])).join(","));
  return lines.join("\n") + "\n";
}

/* ---- the scan -------------------------------------------------------- */
export async function fetchSite(url, { timeout = 12000, ua = DEFAULT_UA } = {}) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, status: 0, finalUrl: url, ms: 0, error: "invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, status: 0, finalUrl: url, ms: 0, error: "unsupported scheme" };
  if (hostIsPrivate(u.hostname))
    return { ok: false, status: 0, finalUrl: url, ms: 0, error: "blocked host (private/loopback)" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": ua, Accept: "text/html,*/*" },
    });
    const html = (await res.text()).slice(0, 600_000);
    return { ok: res.ok, status: res.status, finalUrl: res.url || url, ms: Date.now() - started, bytes: html.length, html };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, ms: Date.now() - started, error: String(err && err.message) };
  } finally {
    clearTimeout(timer);
  }
}

const has = (html, re) => re.test(html);

// Findings sorted by severity (3 = most compelling).
export function findings(scan, row) {
  if (!row.website) {
    return [
      { sev: 3, title: "You don't have a website yet", fix: "a fast, modern one that earns trust and books leads" },
      { sev: 2, title: "Customers can't find or vet you online", fix: "a simple site that shows up on Google" },
      { sev: 2, title: "No way to capture after-hours enquiries", fix: "a chat + booking flow that works 24/7" },
    ];
  }
  if (!scan.ok) {
    return [
      { sev: 3, title: "Your site didn't load when I checked", fix: "get it back up, fast, and keep it that way" },
      { sev: 2, title: "Downtime quietly loses you customers", fix: "a reliable host + monitoring so it never disappears" },
      { sev: 2, title: "A fresh, fast rebuild may cost less than fixing", fix: "a clean modern site in days" },
    ];
  }
  const html = scan.html || "";
  const list = [];
  if (!/^https:/i.test(scan.finalUrl))
    list.push({ sev: 3, title: "Your site isn't secure (no HTTPS)", fix: "an SSL cert + redirect — browsers flag you as 'Not secure' without it" });
  if (!has(html, /<meta[^>]+name=["']?viewport/i))
    list.push({ sev: 3, title: "It isn't mobile-friendly (no viewport tag)", fix: "a responsive layout — most local searches are on phones" });
  if (!has(html, /<title[^>]*>\s*\S/i))
    list.push({ sev: 2, title: "Missing a page title", fix: "a clear title so Google and tabs show your name" });
  if (!has(html, /<meta[^>]+name=["']?description/i))
    list.push({ sev: 2, title: "No meta description", fix: "a one-line pitch so Google shows your words, not a guess" });
  if (!has(html, /book|appointment|calendly|acuity|schedul|reserve|booking/i))
    list.push({ sev: 3, title: "No way to book online", fix: "a booking widget wired to your calendar, with reminders" });
  if (!has(html, /intercom|drift|tawk|crisp|messenger|hubspot|livechat|chat-widget|type=["']?email/i))
    list.push({ sev: 2, title: "No instant lead capture (visitors leave silently)", fix: "an AI chat that answers and grabs the lead in seconds" });
  if (scan.ms > 2500)
    list.push({ sev: 2, title: `Slow to load (~${(scan.ms / 1000).toFixed(1)}s)`, fix: "speed + image cleanup — every second costs conversions" });
  if (scan.bytes > 350_000)
    list.push({ sev: 1, title: "Heavy page (lots of code/markup)", fix: "trim the bloat so it flies on phones" });
  if (!list.length) {
    list.push(
      { sev: 2, title: "No AI assistant capturing leads 24/7", fix: "an always-on assistant that answers and books" },
      { sev: 1, title: "Booking/follow-ups likely still manual", fix: "automation that cuts no-shows and busywork" },
      { sev: 1, title: "Room to convert more of the traffic you have", fix: "a conversion pass on your key pages" }
    );
  }
  return list.sort((a, b) => b.sev - a.sev);
}

/* ---- the email (variant-aware) --------------------------------------- */
// A variant is { id, subjectTemplate, cta }. Placeholders in subjectTemplate:
// {biz} {first} {n} {niche}. When no variant is passed, the config defaults win.
export function renderTemplate(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ""));
}

export function buildEmail(cfg, row, top3, variant = null) {
  const first = firstNameOf(row);
  const biz = businessOf(row);
  const niche = (row.niche || "").trim();
  const site = row.website ? normalizeUrl(row.website) : "";
  const ctx = { biz, first, n: top3.length, niche: niche || "local business" };

  const subject = variant
    ? renderTemplate(variant.subjectTemplate, ctx)
    : row.website
      ? `${biz}: ${top3.length} quick wins on your site`
      : `A quick idea for ${biz}'s online presence`;

  const cta = (variant && variant.cta) || cfg.cta;

  const lookedAt = site
    ? `I took a quick look at ${site} and spotted a few quick wins:`
    : `I noticed ${biz} doesn't have much of a website yet — here's where I'd start:`;
  const bullets = top3.map((f) => `  • ${f.title} → ${f.fix}`).join("\n");

  const body = [
    `Hi ${first},`,
    "",
    `I'm ${cfg.fromName} from ${cfg.company}. ${cfg.serviceLine}`,
    "",
    lookedAt,
    bullets,
    "",
    cta,
    "",
    `— ${cfg.fromName}, ${cfg.company}`,
    cfg.websiteUrl,
    "",
    cfg.physicalAddress,
    cfg.unsubscribeLine,
  ].join("\n");

  return { subject, body };
}

/* ---- pooled runner --------------------------------------------------- */
export async function runPool(items, worker, { concurrency = 4, delay = 250 } = {}) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await worker(items[i], i);
      if (delay) await sleep(delay);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

/* ---- IO helpers ------------------------------------------------------ */
import { readFile } from "node:fs/promises";

export async function loadConfig(path) {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(path, "utf8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function loadProspects(path, limit = Infinity) {
  const raw = await readFile(path, "utf8");
  let rows;
  if (path.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(raw);
    rows = (Array.isArray(data) ? data : data.prospects || []).map((o) => {
      const lower = {};
      for (const k of Object.keys(o)) lower[k.toLowerCase()] = o[k];
      return lower;
    });
  } else {
    rows = rowsToObjects(parseCsv(raw));
  }
  return rows.filter((r) => r.business || r.website || r.email).slice(0, limit);
}

// One prospect -> a complete outreach record (scan + findings + email).
// blockSend short-circuits with a non-sendable record when the config still has
// a placeholder physical address (CAN-SPAM) — no scan, no email body.
export async function processProspect(row, cfg, { timeout, ua, variant, blockSend = false } = {}) {
  if (blockSend) {
    return {
      email: row.email || "",
      first_name: firstNameOf(row) === "there" ? "" : firstNameOf(row),
      company: businessOf(row),
      website: normalizeUrl(row.website),
      city: row.city || "",
      niche: row.niche || "",
      finding_1: "", finding_2: "", finding_3: "",
      subject: "",
      email_body: "[BLOCKED] Set a real physical address in tools/outreach.config.json before generating emails — CAN-SPAM requires a valid postal address in every message.",
      status: "blocked-no-address",
    };
  }
  const url = normalizeUrl(row.website);
  const scan = url ? await fetchSite(url, { timeout, ua }) : { ok: false, status: 0, ms: 0, bytes: 0 };
  const found = findings(scan, row);
  const top3 = found.slice(0, 3);
  const { subject, body } = buildEmail(cfg, row, top3, variant);
  const status = !row.email ? "no-email" : url ? (scan.ok ? "ok" : "unreachable") : "no-site";
  return {
    email: row.email || "",
    first_name: firstNameOf(row) === "there" ? "" : firstNameOf(row),
    company: businessOf(row),
    website: url,
    city: row.city || "",
    niche: row.niche || "",
    finding_1: top3[0] ? `${top3[0].title} → ${top3[0].fix}` : "",
    finding_2: top3[1] ? `${top3[1].title} → ${top3[1].fix}` : "",
    finding_3: top3[2] ? `${top3[2].title} → ${top3[2].fix}` : "",
    subject,
    email_body: body,
    status,
  };
}
