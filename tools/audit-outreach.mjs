#!/usr/bin/env node
/**
 * Symbio AI — audit-first outreach generator (Engine 1 of GROWTH_PLAYBOOK.md)
 * =============================================================================
 * Reads a list of prospect businesses, runs a lightweight "scan" of each site,
 * picks the 3 most useful talking points, writes a personalized, CAN-SPAM-
 * compliant cold email, and exports a CSV (+ JSON) ready to import into a cold-
 * email tool (Smartlead, Instantly, Saleshandy, …) and map as variables.
 *
 * Pure Node — ZERO dependencies. Needs Node 18+ (global fetch / AbortController).
 *
 *   node tools/audit-outreach.mjs --in tools/prospects.sample.csv
 *   node tools/audit-outreach.mjs --in leads.csv --out out/run1.csv --limit 200
 *
 * Flags:
 *   --in <path>          input CSV or JSON   (default: tools/prospects.sample.csv)
 *   --out <path>         output CSV          (default: tools/out/outreach.csv)
 *   --config <path>      sender identity     (default: tools/outreach.config.json)
 *   --limit <n>          only process first n rows
 *   --concurrency <n>    parallel fetches    (default: 4 — stay polite)
 *   --timeout <ms>       per-site timeout    (default: 12000)
 *   --delay <ms>         pause between fetches per worker (default: 250)
 *
 * Input columns (CSV header or JSON keys, case-insensitive):
 *   business, website, email, first_name, city, niche
 * Only `email` is strictly required to be sendable; everything else sharpens
 * the personalization.
 *
 * IMPORTANT (deliverability + law): send from a SEPARATE, warmed domain — never
 * your main one. US B2B cold email is allowed under CAN-SPAM with a real
 * physical address, a working opt-out, and honest subject/from lines. Fill those
 * in tools/outreach.config.json. See tools/README.md.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { argv, exit } from "node:process";
import path from "node:path";

/* ---- CLI args -------------------------------------------------------- */
function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    }
  }
  return out;
}

const args = parseArgs(argv.slice(2));
const IN = args.in || "tools/prospects.sample.csv";
const OUT = args.out || "tools/out/outreach.csv";
const CONFIG = args.config || "tools/outreach.config.json";
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const CONCURRENCY = Math.max(1, parseInt(args.concurrency || "4", 10));
const TIMEOUT = parseInt(args.timeout || "12000", 10);
const DELAY = parseInt(args.delay || "250", 10);

const UA =
  "SymbioAuditBot/1.0 (+https://symbioai.dev; site audit for outreach — contact via the site)";

const DEFAULT_CONFIG = {
  fromName: "Ravi",
  company: "Symbio AI",
  serviceLine:
    "I build fast websites, booking systems, and AI assistants for local businesses.",
  websiteUrl: "https://symbioai.dev",
  // CAN-SPAM REQUIRES a real postal address in every commercial email:
  physicalAddress: "Symbio AI — <add your mailing address>, <City, ST ZIP>",
  unsubscribeLine: "Not relevant? Reply 'unsubscribe' and you won't hear from me again.",
  cta: 'Want the full one-page teardown (free, no obligation)? Just reply "send it".',
};

/* ---- tiny helpers ---------------------------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function firstNameOf(row) {
  if (row.first_name) return row.first_name.trim();
  return "there";
}

function businessOf(row) {
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

function normalizeUrl(raw) {
  const t = (raw || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return "https://" + t.replace(/^\/+/, "");
}

/* ---- minimal CSV parse / serialize ----------------------------------- */
// Handles quoted fields, escaped quotes ("") and commas/newlines inside quotes.
function parseCsv(text) {
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
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      // skip fully blank lines
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
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

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(objects, columns) {
  const lines = [columns.join(",")];
  for (const o of objects) lines.push(columns.map((c) => csvCell(o[c])).join(","));
  return lines.join("\n") + "\n";
}

/* ---- the scan -------------------------------------------------------- */
async function fetchSite(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    const html = (await res.text()).slice(0, 600_000);
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      ms: Date.now() - started,
      bytes: html.length,
      html,
    };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, ms: Date.now() - started, error: String(err && err.message) };
  } finally {
    clearTimeout(timer);
  }
}

const has = (html, re) => re.test(html);

// Produce findings sorted by severity (3 = most compelling to fix).
function findings(scan, row) {
  // No website on file at all → the strongest pitch of them all.
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

  if (!/^https:/i.test(scan.finalUrl)) {
    list.push({ sev: 3, title: "Your site isn't secure (no HTTPS)", fix: "an SSL cert + redirect — browsers flag you as 'Not secure' without it" });
  }
  if (!has(html, /<meta[^>]+name=["']?viewport/i)) {
    list.push({ sev: 3, title: "It isn't mobile-friendly (no viewport tag)", fix: "a responsive layout — most local searches are on phones" });
  }
  if (!has(html, /<title[^>]*>\s*\S/i)) {
    list.push({ sev: 2, title: "Missing a page title", fix: "a clear title so Google and tabs show your name" });
  }
  if (!has(html, /<meta[^>]+name=["']?description/i)) {
    list.push({ sev: 2, title: "No meta description", fix: "a one-line pitch so Google shows your words, not a guess" });
  }
  if (!has(html, /book|appointment|calendly|acuity|schedul|reserve|booking/i)) {
    list.push({ sev: 3, title: "No way to book online", fix: "a booking widget wired to your calendar, with reminders" });
  }
  if (!has(html, /intercom|drift|tawk|crisp|messenger|hubspot|livechat|chat-widget|type=["']?email/i)) {
    list.push({ sev: 2, title: "No instant lead capture (visitors leave silently)", fix: "an AI chat that answers and grabs the lead in seconds" });
  }
  if (scan.ms > 2500) {
    list.push({ sev: 2, title: `Slow to load (~${(scan.ms / 1000).toFixed(1)}s)`, fix: "speed + image cleanup — every second costs conversions" });
  }
  if (scan.bytes > 350_000) {
    list.push({ sev: 1, title: "Heavy page (lots of code/markup)", fix: "trim the bloat so it flies on phones" });
  }

  // Healthy site? Lead with the upgrades most local sites still lack.
  if (!list.length) {
    list.push(
      { sev: 2, title: "No AI assistant capturing leads 24/7", fix: "an always-on assistant that answers and books" },
      { sev: 1, title: "Booking/follow-ups likely still manual", fix: "automation that cuts no-shows and busywork" },
      { sev: 1, title: "Room to convert more of the traffic you have", fix: "a conversion pass on your key pages" }
    );
  }

  return list.sort((a, b) => b.sev - a.sev);
}

/* ---- the email ------------------------------------------------------- */
function buildEmail(cfg, row, top3) {
  const first = firstNameOf(row);
  const biz = businessOf(row);
  const niche = (row.niche || "").trim();
  const site = row.website ? normalizeUrl(row.website) : "";

  const subject = row.website
    ? `${biz}: ${top3.length} quick wins on your site`
    : `A quick idea for ${biz}'s online presence`;

  const audience = niche ? `${niche}s and other local businesses` : "local businesses";
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
    cfg.cta,
    "",
    `— ${cfg.fromName}, ${cfg.company}`,
    cfg.websiteUrl,
    "",
    cfg.physicalAddress,
    cfg.unsubscribeLine,
  ].join("\n");

  return { subject, body, audience };
}

/* ---- pooled runner --------------------------------------------------- */
async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await worker(items[i], i);
      if (DELAY) await sleep(DELAY);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane));
  return results;
}

/* ---- main ------------------------------------------------------------ */
async function loadConfig() {
  try {
    const raw = await readFile(CONFIG, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    console.warn(`! No ${CONFIG} found — using defaults. Add your physical address before sending (CAN-SPAM).`);
    return DEFAULT_CONFIG;
  }
}

async function loadProspects() {
  const raw = await readFile(IN, "utf8");
  let rows;
  if (IN.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(raw);
    rows = (Array.isArray(data) ? data : data.prospects || []).map((o) => {
      const lower = {};
      for (const k of Object.keys(o)) lower[k.toLowerCase()] = o[k];
      return lower;
    });
  } else {
    rows = rowsToObjects(parseCsv(raw));
  }
  return rows.filter((r) => r.business || r.website || r.email).slice(0, LIMIT);
}

async function main() {
  const cfg = await loadConfig();
  const prospects = await loadProspects();
  if (!prospects.length) {
    console.error(`No prospects found in ${IN}. Expected columns: business, website, email, first_name, city, niche`);
    exit(1);
  }

  console.log(`Scanning ${prospects.length} prospect(s) — concurrency ${CONCURRENCY}, timeout ${TIMEOUT}ms…\n`);

  let reachable = 0;
  let missingEmail = 0;

  const records = await runPool(prospects, async (row) => {
    const url = normalizeUrl(row.website);
    const scan = url ? await fetchSite(url) : { ok: false, status: 0, ms: 0, bytes: 0 };
    if (scan.ok) reachable += 1;
    if (!row.email) missingEmail += 1;

    const found = findings(scan, row);
    const top3 = found.slice(0, 3);
    const { subject, body } = buildEmail(cfg, row, top3);

    const flag = !row.email ? "NO-EMAIL" : url ? (scan.ok ? "ok" : "unreachable") : "no-site";
    console.log(`  [${flag.padEnd(11)}] ${businessOf(row)}  —  ${top3.length} finding(s)`);

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
      status: flag,
    };
  });

  const columns = [
    "email",
    "first_name",
    "company",
    "website",
    "city",
    "niche",
    "finding_1",
    "finding_2",
    "finding_3",
    "subject",
    "email_body",
    "status",
  ];

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, toCsv(records, columns), "utf8");
  const jsonOut = OUT.replace(/\.csv$/i, "") + ".json";
  await writeFile(jsonOut, JSON.stringify(records, null, 2), "utf8");

  const sendable = records.filter((r) => r.email).length;
  console.log("\n────────────────────────────────────────────");
  console.log(`Done. ${records.length} processed · ${reachable} site(s) reachable · ${sendable} sendable · ${missingEmail} missing email.`);
  console.log(`CSV : ${OUT}`);
  console.log(`JSON: ${jsonOut}`);
  console.log("\nNext: import the CSV into Smartlead/Instantly, map {{subject}} + {{email_body}}");
  console.log("(or the finding_* columns into your own template), and send from a SEPARATE,");
  console.log("WARMED domain. Confirm your physical address + opt-out are set in", CONFIG + ".");
}

main().catch((err) => {
  console.error("Failed:", err);
  exit(1);
});
