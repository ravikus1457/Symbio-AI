#!/usr/bin/env node
/**
 * Hermes — Symbio AI's autonomous growth engine.
 * =============================================================================
 * The messenger god, turned growth loop. Hermes ties the pieces of
 * GROWTH_PLAYBOOK.md together and gets BETTER over time:
 *
 *   hermes outreach --in <csv>   Scan prospects + write personalized emails,
 *                                assigning each an A/B variant via a bandit that
 *                                favours subject lines/CTAs that actually reply.
 *   hermes log --email <e> ...   Record an outcome (--replied / --booked / --unsub).
 *   hermes learn                 Re-tally the ledger -> update variant win-rates.
 *   hermes report                Print + write the funnel dashboard (REPORT.md).
 *   hermes run --in <csv>        outreach -> report in one go.
 *
 * "Ever-improving" is real here: the bandit reads outcomes you log and shifts
 * sends toward the winners (epsilon-greedy with Laplace smoothing). It is honest
 * about its limits — it learns only from outcomes you actually record, and it
 * generates emails; sending stays in your warmed cold-email tool.
 *
 * Pure Node, zero deps (Node 18+). Reuses tools/lib/outreach-core.mjs.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { argv, exit } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConfig, loadProspects, processProspect, runPool, toCsv, businessOf, DEFAULT_UA,
} from "../lib/outreach-core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VARIANTS_PATH = path.join(HERE, "variants.json");
const LEDGER_PATH = path.join(HERE, "ledger.json");
const REPORT_PATH = path.join(HERE, "REPORT.md");
const OUT_DIR = path.join(HERE, "out");
const CONFIG_PATH = "tools/outreach.config.json";

/* ---- args ------------------------------------------------------------ */
function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(a);
  }
  return { cmd: positional[0], flags };
}

/* ---- json io --------------------------------------------------------- */
async function readJson(p, fallback) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}
const writeJson = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");

const DEFAULT_VARIANTS = {
  epsilon: 0.2,
  variants: [
    { id: "wins", subjectTemplate: "{biz}: {n} quick wins on your site", cta: 'Want the full one-page teardown (free, no obligation)? Just reply "send it".' },
    { id: "noticed", subjectTemplate: "noticed something on {biz}'s site", cta: "Reply 'yes' and I'll send the 3 fixes — free, takes me five minutes." },
    { id: "question", subjectTemplate: "quick question about {biz}", cta: "Worth a 10-minute look? Reply and I'll send a short teardown." },
    { id: "niche", subjectTemplate: "{niche} sites that book more work", cta: "Want me to point out the top 3 fixes on your site? Just reply." },
  ],
};

async function loadVariants() {
  const v = await readJson(VARIANTS_PATH, null);
  return v && Array.isArray(v.variants) ? v : DEFAULT_VARIANTS;
}

/* ---- the bandit ------------------------------------------------------ */
// Laplace-smoothed reply rate so untried variants start optimistic (~0.5) and
// get explored; epsilon-greedy adds forced exploration.
function variantScore(stats) {
  const sends = stats.sends || 0;
  const replies = stats.replies || 0;
  return (replies + 1) / (sends + 2);
}

function statsFromLedger(ledger, variantId) {
  const rows = ledger.filter((r) => r.variantId === variantId);
  return {
    sends: rows.length,
    replies: rows.filter((r) => r.replied).length,
    booked: rows.filter((r) => r.booked).length,
  };
}

function chooseVariant(variants, ledger, epsilon) {
  const scored = variants.map((v) => {
    const stats = statsFromLedger(ledger, v.id);
    return { v, stats, score: variantScore(stats) };
  });
  // Explore with probability epsilon.
  if (Math.random() < epsilon) return scored[Math.floor(Math.random() * scored.length)];
  // Exploit: best score, ties broken toward the LESS-sent variant (spread).
  scored.sort((a, b) => b.score - a.score || a.stats.sends - b.stats.sends);
  return scored[0];
}

/* ---- commands -------------------------------------------------------- */
async function cmdOutreach(flags) {
  const inPath = flags.in || "tools/prospects.sample.csv";
  const limit = flags.limit ? parseInt(flags.limit, 10) : Infinity;
  const concurrency = Math.max(1, parseInt(flags.concurrency || "4", 10));
  const timeout = parseInt(flags.timeout || "12000", 10);
  const delay = parseInt(flags.delay || "250", 10);
  const epsilon = flags.epsilon != null ? parseFloat(flags.epsilon) : null;

  const cfg = await loadConfig(CONFIG_PATH);
  const variantsCfg = await loadVariants();
  const eps = epsilon != null ? epsilon : variantsCfg.epsilon;
  const ledger = await readJson(LEDGER_PATH, []);
  const prospects = await loadProspects(inPath, limit);
  if (!prospects.length) {
    console.error(`Hermes: no prospects in ${inPath} (columns: business, website, email, first_name, city, niche)`);
    exit(1);
  }

  console.log(`Hermes outreach — ${prospects.length} prospect(s), ε=${eps}, ${variantsCfg.variants.length} variants…\n`);
  const byVariant = {};

  const records = await runPool(
    prospects,
    async (row) => {
      const pick = chooseVariant(variantsCfg.variants, ledger, eps);
      const rec = await processProspect(row, cfg, { timeout, ua: DEFAULT_UA, variant: pick.v });
      rec.variant_id = pick.v.id;
      byVariant[pick.v.id] = (byVariant[pick.v.id] || 0) + 1;

      // Upsert a ledger entry (assignment == a queued send we learn from).
      if (rec.email) {
        const existing = ledger.find((r) => r.email === rec.email);
        const entry = existing || { email: rec.email };
        entry.company = rec.company;
        entry.niche = rec.niche;
        entry.city = rec.city;
        entry.variantId = pick.v.id;
        entry.queuedAt = new Date().toISOString();
        if (entry.replied == null) entry.replied = false;
        if (entry.booked == null) entry.booked = false;
        if (entry.unsub == null) entry.unsub = false;
        if (!existing) ledger.push(entry);
      }
      console.log(`  [${rec.status.padEnd(11)}] ${businessOf(row).padEnd(28)} → variant:${pick.v.id}`);
      return rec;
    },
    { concurrency, delay }
  );

  await mkdir(OUT_DIR, { recursive: true });
  const outCsv = path.join(OUT_DIR, "outreach.csv");
  const cols = ["email", "first_name", "company", "website", "city", "niche", "finding_1", "finding_2", "finding_3", "subject", "email_body", "variant_id", "status"];
  await writeFile(outCsv, toCsv(records, cols), "utf8");
  await writeFile(path.join(OUT_DIR, "outreach.json"), JSON.stringify(records, null, 2), "utf8");
  await writeJson(LEDGER_PATH, ledger);

  console.log("\n────────────────────────────────────────────");
  console.log("variant assignment:", Object.entries(byVariant).map(([k, n]) => `${k}=${n}`).join("  "));
  console.log(`CSV: ${outCsv}  (column variant_id tracks which A/B test each got)`);
  console.log(`Ledger updated: ${LEDGER_PATH}`);
  console.log(`\nNext: send from a warmed domain, then record replies:`);
  console.log(`  node tools/hermes/hermes.mjs log --email someone@biz.com --replied`);
}

async function cmdLog(flags) {
  if (!flags.email || flags.email === true) {
    console.error("Hermes log: --email <address> is required (plus --replied / --booked / --unsub)");
    exit(1);
  }
  const ledger = await readJson(LEDGER_PATH, []);
  let entry = ledger.find((r) => r.email === flags.email);
  if (!entry) {
    entry = { email: flags.email, company: flags.company || "", niche: flags.niche || "", variantId: flags.variant || "", queuedAt: new Date().toISOString(), replied: false, booked: false, unsub: false };
    ledger.push(entry);
  }
  if (flags.replied) entry.replied = true;
  if (flags.booked) {
    entry.booked = true;
    entry.replied = true; // a booking implies a reply
  }
  if (flags.unsub) entry.unsub = true;
  entry.updatedAt = new Date().toISOString();
  await writeJson(LEDGER_PATH, ledger);
  console.log(`Logged ${flags.email}: replied=${entry.replied} booked=${entry.booked} unsub=${entry.unsub} (variant:${entry.variantId || "?"})`);
}

async function cmdLearn() {
  const variantsCfg = await loadVariants();
  const ledger = await readJson(LEDGER_PATH, []);
  const board = variantsCfg.variants
    .map((v) => ({ id: v.id, ...statsFromLedger(ledger, v.id) }))
    .map((s) => ({ ...s, rate: s.sends ? s.replies / s.sends : 0, score: variantScore(s) }))
    .sort((a, b) => b.score - a.score);

  // Persist the latest tallies back into variants.json for transparency.
  variantsCfg.variants = variantsCfg.variants.map((v) => {
    const s = board.find((b) => b.id === v.id);
    return { ...v, sends: s.sends, replies: s.replies, booked: s.booked };
  });
  await writeJson(VARIANTS_PATH, variantsCfg);

  console.log("Hermes learn — variant leaderboard (by smoothed score):\n");
  console.log("  rank  variant      sends  replies  booked  reply-rate  score");
  board.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padEnd(4)}  ${s.id.padEnd(11)}  ${String(s.sends).padEnd(5)}  ${String(s.replies).padEnd(7)}  ${String(s.booked).padEnd(6)}  ${(s.rate * 100).toFixed(0).padStart(8)}%  ${s.score.toFixed(3)}`)
  );
  const total = board.reduce((a, b) => a + b.sends, 0);
  console.log(`\n${total} sends recorded. The next \`hermes outreach\` will favour the top variant (ε=${variantsCfg.epsilon} still explores).`);
  if (total < 30) console.log("Note: <30 sends — rankings are still noisy. Keep logging outcomes before trusting them.");
  return board;
}

async function countSeoPages() {
  try {
    const mod = await import("../../src/_data/landingPages.js");
    const pages = mod.default();
    return { total: pages.length, tierA: pages.filter((p) => p.tier === "A").length, tierB: pages.filter((p) => p.tier === "B").length };
  } catch {
    return { total: 0, tierA: 0, tierB: 0 };
  }
}

async function cmdReport() {
  const ledger = await readJson(LEDGER_PATH, []);
  const cfg = await loadConfig(CONFIG_PATH);
  const seo = await countSeoPages();
  const board = await cmdLearn();

  const queued = ledger.length;
  const replied = ledger.filter((r) => r.replied).length;
  const booked = ledger.filter((r) => r.booked).length;
  const unsub = ledger.filter((r) => r.unsub).length;
  const rate = queued ? ((replied / queued) * 100).toFixed(1) : "0.0";

  const byNiche = {};
  for (const r of ledger) {
    const k = r.niche || "(unspecified)";
    byNiche[k] = byNiche[k] || { queued: 0, replied: 0, booked: 0 };
    byNiche[k].queued += 1;
    if (r.replied) byNiche[k].replied += 1;
    if (r.booked) byNiche[k].booked += 1;
  }

  const addressSet = !/\<add your/i.test(cfg.physicalAddress || "");
  const md = [
    `# Hermes — Growth Report`,
    ``,
    `_Generated ${new Date().toISOString()}_`,
    ``,
    `## Inbound surface (programmatic SEO)`,
    `- Landing pages live: **${seo.total}** (${seo.tierA} service×niche, ${seo.tierB} city pages)`,
    `- Plus hub + 3 service hubs, sitemap.xml, robots.txt.`,
    ``,
    `## Outreach funnel`,
    `| metric | value |`,
    `| --- | --- |`,
    `| Prospects queued | ${queued} |`,
    `| Replies | ${replied} |`,
    `| Booked | ${booked} |`,
    `| Unsubscribed | ${unsub} |`,
    `| Reply rate | ${rate}% |`,
    ``,
    `## A/B variant leaderboard`,
    `| rank | variant | sends | replies | booked | reply-rate |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...board.map((s, i) => `| ${i + 1} | ${s.id} | ${s.sends} | ${s.replies} | ${s.booked} | ${(s.rate * 100).toFixed(0)}% |`),
    ``,
    `## Reply rate by niche`,
    `| niche | queued | replied | booked |`,
    `| --- | --- | --- | --- |`,
    ...Object.entries(byNiche).map(([k, v]) => `| ${k} | ${v.queued} | ${v.replied} | ${v.booked} |`),
    ``,
    `## Next actions (the human-only switches)`,
    `- [${addressSet ? "x" : " "}] Real mailing address + opt-out set in \`tools/outreach.config.json\` (CAN-SPAM).`,
    `- [ ] Stripe Payment Links pasted into \`src/_data/site.js\` packages (self-serve checkout).`,
    `- [ ] Separate, warmed sending domain connected in Smartlead/Instantly.`,
    `- [ ] After sending a batch, log outcomes: \`hermes log --email … --replied\`.`,
    ``,
  ].join("\n");

  await writeFile(REPORT_PATH, md, "utf8");
  console.log(`\n──────── REPORT ────────`);
  console.log(`SEO pages live: ${seo.total} | queued: ${queued} | replies: ${replied} (${rate}%) | booked: ${booked}`);
  console.log(`Report written: ${REPORT_PATH}`);
}

async function main() {
  const { cmd, flags } = parseArgs(argv.slice(2));
  switch (cmd) {
    case "outreach": return cmdOutreach(flags);
    case "log": return cmdLog(flags);
    case "learn": await cmdLearn(); return;
    case "report": return cmdReport();
    case "run":
      await cmdOutreach(flags);
      return cmdReport();
    default:
      console.log(`Hermes — Symbio AI growth engine

  node tools/hermes/hermes.mjs outreach --in leads.csv   Scan + write A/B emails (bandit-assigned)
  node tools/hermes/hermes.mjs log --email e@x.com --replied   Record an outcome
  node tools/hermes/hermes.mjs learn                     Update variant win-rates
  node tools/hermes/hermes.mjs report                    Write the funnel dashboard
  node tools/hermes/hermes.mjs run --in leads.csv        outreach -> report

Outcomes you log make the next run smarter. See tools/hermes/README.md.`);
  }
}

main().catch((err) => {
  console.error("Hermes failed:", err);
  exit(1);
});
