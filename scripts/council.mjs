#!/usr/bin/env node
/**
 * Symbio Brain Council — command-line edition.
 *
 * Fans a single prompt out to several top models on OpenRouter (Claude, GLM,
 * Qwen Coder, DeepSeek, Hermes), optionally lets them debate (each critiques the
 * others and refines), then a "chair" model synthesizes ONE final answer that
 * takes the best parts of each. That final answer is the "Brain Council answer".
 *
 * This is the same protocol as the in-browser page (src/council.html), but for
 * the terminal — handy in CI, scripts, or for Claude Code to consult while it
 * works on a hard problem.
 *
 * ── Setup ────────────────────────────────────────────────────────────────
 *   export OPENROUTER_API_KEY=sk-or-v1-...          # required
 *   # (Node 18+; uses the built-in global fetch — no dependencies.)
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   node scripts/council.mjs "How should I shard this table?"
 *   echo "Review this design: ..." | node scripts/council.mjs
 *   node scripts/council.mjs --quick "Quick gut-check on this approach"
 *   node scripts/council.mjs --json "..." > council.json
 *
 * ── Flags ────────────────────────────────────────────────────────────────
 *   --quick            Skip the debate round (one answer per brain, then merge).
 *   --debate           Force the debate round (this is the default).
 *   --brains a,b,c     Override the roster with explicit OpenRouter model slugs.
 *   --synth <slug>     Model that writes the final answer (default: Claude).
 *   --all              Also print every brain's individual answer, not just the final.
 *   --json             Emit a machine-readable JSON object instead of text.
 *   --no-stream        Don't stream the final answer token-by-token.
 *   -h, --help         Show help.
 *
 * The default roster mirrors the web page and can be edited below or via
 * --brains. Slugs drift over time — run `node scripts/council.mjs --models`
 * (with a key set) to print the live list your account can use.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OR_BASE = "https://openrouter.ai/api/v1";

const DEFAULT_BRAINS = [
  { name: "Claude", model: "anthropic/claude-opus-4.1" },
  { name: "GLM", model: "z-ai/glm-4.6" },
  { name: "Qwen Coder", model: "qwen/qwen3-coder" },
  { name: "DeepSeek", model: "deepseek/deepseek-chat" },
  { name: "Hermes", model: "nousresearch/hermes-3-llama-3.1-405b" },
];
const DEFAULT_SYNTH = "anthropic/claude-opus-4.1";

// ── ANSI helpers (skipped when not a TTY) ──────────────────────────────────
const TTY = process.stdout.isTTY;
const c = (code, s) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s);
const dim = (s) => c("2", s);
const cyan = (s) => c("36", s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const yellow = (s) => c("33", s);

function die(msg, code = 1) {
  process.stderr.write(red("✖ " + msg) + "\n");
  process.exit(code);
}

// ── .env loader (no dependency) ─────────────────────────────────────────────
// Loads KEY=value lines from a .env file in the repo root / current dir so you
// can paste your OpenRouter key once instead of exporting it every time.
// Real environment variables always win over the file.
function loadDotEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), ".env"),
    join(here, "..", ".env"), // repo root when run as scripts/council.mjs
  ];
  for (const file of candidates) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (k && !(k in process.env)) process.env[k] = v;
    }
  }
}

// ── Arg parsing ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    mode: "debate",
    brains: null,
    synth: DEFAULT_SYNTH,
    all: false,
    json: false,
    stream: true,
    models: false,
    help: false,
    prompt: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--quick") opts.mode = "quick";
    else if (a === "--debate") opts.mode = "debate";
    else if (a === "--all") opts.all = true;
    else if (a === "--json") {
      opts.json = true;
      opts.stream = false;
    } else if (a === "--no-stream") opts.stream = false;
    else if (a === "--models") opts.models = true;
    else if (a === "--synth") opts.synth = argv[++i];
    else if (a === "--brains") {
      opts.brains = String(argv[++i] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((slug) => ({ name: slug.split("/").pop(), model: slug }));
    } else opts.prompt.push(a);
  }
  return opts;
}

const HELP = `${bold("Symbio Brain Council")} — consult several AI models, debate, synthesize one answer.

${bold("Usage")}
  node scripts/council.mjs [flags] "your prompt"
  echo "your prompt" | node scripts/council.mjs [flags]

${bold("Flags")}
  --quick           One answer per brain, then merge (no debate round)
  --debate          Brains critique each other and refine (default)
  --brains a,b,c    Roster of OpenRouter model slugs to use
  --synth <slug>    Model that writes the final answer (default ${DEFAULT_SYNTH})
  --all             Also print each brain's individual answer
  --json            Emit JSON (implies --no-stream)
  --no-stream       Don't stream the final answer
  --models          Print the model slugs your account can use, then exit
  -h, --help        This help

${bold("Setup")}
  export OPENROUTER_API_KEY=sk-or-v1-...   (Node 18+)`;

// ── OpenRouter calls ───────────────────────────────────────────────────────
function headers(key) {
  return {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    "X-Title": "Symbio Brain Council (CLI)",
  };
}

async function chat(key, model, messages, { stream = false, onDelta } = {}) {
  const res = await fetch(OR_BASE + "/chat/completions", {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({ model, messages, stream }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message || "";
    } catch {}
    throw new Error(`HTTP ${res.status}${detail ? ": " + detail : ""}`);
  }
  if (!stream) {
    const j = await res.json();
    return j?.choices?.[0]?.message?.content || "";
  }
  // Stream SSE
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line || line.startsWith(":") || !line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return full;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          if (onDelta) onDelta(delta);
        }
      } catch {}
    }
  }
  return full;
}

async function listModels(key) {
  const res = await fetch(OR_BASE + "/models", { headers: headers(key) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  return (j.data || [])
    .map((m) => m.id)
    .filter(Boolean)
    .sort();
}

// ── Prompts ────────────────────────────────────────────────────────────────
const brainSystem = (name) =>
  `You are ${name}, one of several elite AI 'brains' convened as a council to answer the user as well as possible. ` +
  `Give your strongest, most correct and complete answer. Reason carefully. ` +
  `If it is a coding or technical task, provide working, idiomatic code and call out edge cases. ` +
  `Be direct and well-structured. Do not mention that you are part of a council unless it is relevant.`;

const debateSystem = (name) =>
  `You are ${name} on an AI brain council. You are shown the user's request and the other brains' first-round answers. ` +
  `Critically evaluate them: identify mistakes, missing cases, and weaker reasoning, and acknowledge where another brain is clearly better than yours. ` +
  `Then give your improved, final answer. Prefer being correct over agreeing. Keep it focused.`;

const SYNTH_SYSTEM =
  `You are the Chair of an AI Brain Council. Several expert brains have answered the user's request; their answers are provided. ` +
  `Produce ONE definitive 'Brain Council answer' that takes the best, most correct parts from each brain, resolves any contradictions ` +
  `(state which approach is right and briefly why), and is complete and directly usable. ` +
  `Write it as the final answer to the user — do not merely summarize what each brain said. ` +
  `If the brains genuinely disagree on something important, note the consensus and the key dissent in one short line at the end.`;

const othersBlock = (answers, exceptName) =>
  answers
    .filter((a) => a.name !== exceptName && a.text && !a.error)
    .map((a) => `### ${a.name}\n${a.text}`)
    .join("\n\n");

// ── stdin helper ───────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (data += d));
    process.stdin.on("end", () => resolve(data));
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP + "\n");
    return;
  }

  loadDotEnv();
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    die(
      "OPENROUTER_API_KEY is not set.\n" +
        "  Easiest: copy .env.example to .env and paste your key there, or\n" +
        "  export OPENROUTER_API_KEY=sk-or-v1-...   (get one at https://openrouter.ai/keys)"
    );
  }

  if (opts.models) {
    const ids = await listModels(key);
    process.stdout.write(ids.join("\n") + "\n");
    return;
  }

  let prompt = opts.prompt.join(" ").trim();
  if (!prompt) prompt = (await readStdin()).trim();
  if (!prompt)
    die("No prompt given. Pass it as an argument or pipe it via stdin. (--help for usage)");

  const brains = opts.brains || DEFAULT_BRAINS;
  const log = (s) => process.stderr.write(s + "\n"); // progress to stderr, result to stdout

  log(
    bold("🧠 Brain Council") +
      dim(`  ·  ${opts.mode}  ·  ${brains.length} brains  ·  synth: ${opts.synth}`)
  );

  // Round 1 — parallel
  log(dim(`\n→ Round 1: ${brains.map((b) => b.name).join(", ")} thinking…`));
  let answers = await Promise.all(
    brains.map(async (b) => {
      try {
        const text = await chat(key, b.model, [
          { role: "system", content: brainSystem(b.name) },
          { role: "user", content: prompt },
        ]);
        log(`  ${green("✓")} ${b.name} ${dim("(" + text.length + " chars)")}`);
        return { name: b.name, model: b.model, text, error: false };
      } catch (e) {
        log(`  ${red("✗")} ${b.name} ${dim("— " + e.message)}`);
        return { name: b.name, model: b.model, text: "", error: true, errorMsg: e.message };
      }
    })
  );

  const round1 = answers.map((a) => ({ ...a }));

  // Round 2 — debate
  if (opts.mode === "debate" && answers.filter((a) => !a.error).length >= 2) {
    log(dim("\n→ Round 2: debating & refining…"));
    answers = await Promise.all(
      answers.map(async (a) => {
        if (a.error) return a;
        const others = othersBlock(round1, a.name);
        try {
          const text = await chat(key, a.model, [
            { role: "system", content: debateSystem(a.name) },
            {
              role: "user",
              content:
                `User's request:\n${prompt}\n\nThe other brains' first-round answers:\n\n${others}` +
                `\n\nCritique them and give your improved final answer.`,
            },
          ]);
          log(`  ${green("✓")} ${a.name} refined`);
          return { ...a, text, round1: a.text };
        } catch (e) {
          log(`  ${yellow("•")} ${a.name} kept round 1 ${dim("(" + e.message + ")")}`);
          return a;
        }
      })
    );
  }

  const good = answers.filter((a) => !a.error && a.text);
  if (!good.length)
    die("Every brain failed — check OPENROUTER_API_KEY and the model slugs (--models to list).");

  // Optionally show individual answers
  if (opts.all && !opts.json) {
    for (const a of answers) {
      process.stdout.write("\n" + cyan(bold("── " + a.name + " (" + a.model + ") ──")) + "\n");
      process.stdout.write((a.error ? red(a.errorMsg) : a.text) + "\n");
    }
  }

  // Synthesis
  log(dim(`\n→ Synthesizing the Brain Council answer (${opts.synth})…`));
  const block = good.map((a) => `### ${a.name}\n${a.text}`).join("\n\n");
  const synthMessages = [
    { role: "system", content: SYNTH_SYSTEM },
    {
      role: "user",
      content:
        `User's request:\n${prompt}\n\nThe council brains answered:\n\n${block}` +
        `\n\nNow write the single best Brain Council answer.`,
    },
  ];

  if (opts.json) {
    const finalText = await chat(key, opts.synth, synthMessages);
    process.stdout.write(
      JSON.stringify(
        {
          prompt,
          mode: opts.mode,
          synth: opts.synth,
          brains: answers.map((a) => ({
            name: a.name,
            model: a.model,
            error: a.error,
            answer: a.text,
            round1: a.round1,
          })),
          councilAnswer: finalText,
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  process.stdout.write(
    "\n" +
      bold(green("══ Brain Council answer ")) +
      dim(`(${good.length}/${brains.length} brains)`) +
      "\n\n"
  );
  const finalText = await chat(key, opts.synth, synthMessages, {
    stream: opts.stream,
    onDelta: (d) => process.stdout.write(d),
  });
  if (!opts.stream) process.stdout.write(finalText);
  process.stdout.write("\n");
}

main().catch((e) => die(e?.message || String(e)));
