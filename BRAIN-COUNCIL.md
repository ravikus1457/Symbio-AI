# 🧠 Symbio Brain Council

A multi-model "council" that asks several top AI models the **same prompt at once**,
optionally lets them **debate** (each critiques the others and refines its answer),
then has a **synthesizer** merge the strongest parts into **one final answer** —
the **Brain Council answer**.

There are two ways to use it, plus a working protocol for Claude Code:

| Surface      | File                                                             | Use it for                                                                            |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Web chat** | [`src/council.html`](src/council.html) → ships as `council.html` | Day-to-day: a chat UI where you prompt every brain at once and get one merged answer. |
| **CLI**      | [`scripts/council.mjs`](scripts/council.mjs)                     | Terminal / scripts / CI, and for Claude Code to consult while it works.               |
| **Protocol** | [`CLAUDE.md`](CLAUDE.md)                                         | Tells Claude Code _when_ and _how_ to convene the council on hard tasks.              |

Everything talks to [OpenRouter](https://openrouter.ai), so a single API key reaches
all the models. **Nothing runs on Symbio's servers** — the web page calls OpenRouter
directly from your browser, and the CLI from your machine.

---

## The council (the brains)

| Brain                   | Default OpenRouter slug                | Role                                          |
| ----------------------- | -------------------------------------- | --------------------------------------------- |
| **Claude**              | `anthropic/claude-opus-4.1`            | All-round reasoning + writing                 |
| **GLM**                 | `z-ai/glm-4.6`                         | Strong reasoning / generalist                 |
| **Qwen Coder**          | `qwen/qwen3-coder`                     | Code & technical tasks                        |
| **DeepSeek**            | `deepseek/deepseek-chat`               | Reasoning / cost-effective depth              |
| **Hermes**              | `nousresearch/hermes-3-llama-3.1-405b` | Independent, less-aligned perspective         |
| **Synthesizer (Chair)** | `anthropic/claude-opus-4.1`            | Reads every brain and writes the final answer |

> **Model slugs drift.** You asked for the _best_ GLM (e.g. "GLM 5.2") and Qwen Coder —
> the slugs above are sensible defaults, but the truly current best may have a newer
> slug. **Both the web page and the CLI can list the live models your account can use**,
> so you can pick the exact latest one:
>
> - Web: open **Settings → Load models**, then start typing `glm`, `qwen`, `deepseek`,
>   `hermes` in each brain's box to autocomplete the real slug.
> - CLI: `node scripts/council.mjs --models` prints every available slug.
>
> Update the slug in Settings (web) or with `--brains` / by editing
> `DEFAULT_BRAINS` (CLI) whenever a better model ships.

---

## 1) Web chat — `council.html`

1. Build or run the site, then open **`/council.html`** (it's also linked in the
   footer under **Work → Brain Council**). For local dev:
   ```bash
   npm run dev        # then visit http://localhost:8080/council.html
   ```
2. Open **Settings**, paste your OpenRouter key (from
   <https://openrouter.ai/keys>). It's stored **only in your browser's
   localStorage** and is sent **only** to OpenRouter.
3. (Optional) Click **Load models** and fine-tune each brain's slug; toggle brains
   on/off; pick **Debate** or **Quick** mode; set the synthesizer.
4. Type a prompt and hit **Enter**. You'll see:
   - each brain's answer stream in live (and, in Debate mode, a second "after
     debate" pass),
   - then the **🧠 Brain Council answer** at the top, synthesized from all of them.
5. Follow-up questions keep the conversation context (the prior council answers).
   **＋ New** starts fresh.

**Modes**

- **Debate** (default): Round 1 — every brain answers. Round 2 — each brain sees the
  others' answers, critiques them, and refines. Then synthesis. Slower, sharper.
- **Quick**: every brain answers once, then synthesis. Faster.

---

## 2) CLI — `scripts/council.mjs`

Node 18+ (uses built-in `fetch`, **no dependencies**).

```bash
export OPENROUTER_API_KEY=sk-or-v1-...

# Basic — prints the synthesized Brain Council answer (streams to your terminal)
node scripts/council.mjs "How should I shard a 2 TB orders table?"

# or via npm
npm run council -- "How should I shard a 2 TB orders table?"

# Pipe a longer prompt in
cat design-notes.md | node scripts/council.mjs --all

# Quick mode (skip the debate round)
node scripts/council.mjs --quick "Gut-check this approach: ..."

# Custom roster + synthesizer
node scripts/council.mjs --brains "z-ai/glm-4.6,qwen/qwen3-coder,deepseek/deepseek-chat" \
                         --synth "anthropic/claude-opus-4.1" "..."

# Machine-readable (every brain + the final answer)
node scripts/council.mjs --json "..." > council.json

# List the model slugs your account can use
node scripts/council.mjs --models
```

Progress prints to **stderr**; the final answer prints to **stdout**, so you can
redirect cleanly (`node scripts/council.mjs "..." > answer.md`).

| Flag                   | Meaning                                                |
| ---------------------- | ------------------------------------------------------ |
| `--quick` / `--debate` | One round, or critique-and-refine (default `--debate`) |
| `--brains a,b,c`       | Roster of OpenRouter slugs                             |
| `--synth <slug>`       | Model that writes the final answer                     |
| `--all`                | Also print each brain's individual answer              |
| `--json`               | Emit JSON (implies `--no-stream`)                      |
| `--no-stream`          | Don't stream the final answer                          |
| `--models`             | Print available slugs and exit                         |
| `-h`, `--help`         | Help                                                   |

---

## 3) Letting **Claude Code** consult the council

When Claude Code hits a genuinely hard or high-stakes problem, the goal is for it to
produce a **Brain Council answer** — its own reasoning, pressure-tested against GLM,
Qwen, DeepSeek and Hermes — rather than a solo answer. The protocol lives in
[`CLAUDE.md`](CLAUDE.md). For Claude Code to call the council **live**, two things
must be true in the environment it runs in:

1. **An API key is available:** `OPENROUTER_API_KEY` is set.
2. **The network policy allows OpenRouter:** outbound HTTPS to `openrouter.ai` is
   permitted.

### Running locally / in your own terminal

Both are easy: `export OPENROUTER_API_KEY=...` and you already have normal internet.
Claude Code can then run `node scripts/council.mjs "..."` directly.

### Running in Claude Code **on the web** (the sandbox)

The managed web sandbox uses a **network policy** chosen when the environment was
created. In this repo's current environment, `openrouter.ai` is **blocked** (outbound
CONNECT is denied) and `OPENROUTER_API_KEY` is **not set** — so Claude Code cannot
reach the council live there. To enable it:

- Use (or create) an environment whose **network policy allows `openrouter.ai`** —
  see the docs on environments & network policies:
  <https://code.claude.com/docs/en/claude-code-on-the-web>.
- Provide **`OPENROUTER_API_KEY`** to that environment (as an environment
  variable / secret).

Until both are in place, the council still works perfectly **in your browser**
(`council.html`) and **on your own machine** (the CLI) — those use _your_ network and
key, not the sandbox's.

---

## Privacy & cost

- **Your key, your browser/machine.** The web page stores the key in `localStorage`
  and sends it only to `openrouter.ai`. The CLI reads it from your shell env. It is
  never committed, logged, or sent to Symbio.
- **Every prompt is sent to multiple paid models**, and Debate mode roughly doubles
  the calls, plus one synthesis call. Watch your OpenRouter usage. Use **Quick** mode
  or toggle off brains to save tokens.
- OpenRouter's own data/training settings apply to your account — manage them at
  <https://openrouter.ai/settings/privacy>.

---

## How it works (the prompts)

1. **Round 1 — independent answers.** Each brain gets the user prompt with a system
   message: _"You are one of several elite AI brains convened as a council… give your
   strongest, most correct and complete answer."_ All run in parallel.
2. **Round 2 — debate (optional).** Each brain is shown the others' Round-1 answers
   and asked to _"critically evaluate them… acknowledge where another brain is clearly
   better… then give your improved final answer."_
3. **Synthesis — the Chair.** The synthesizer gets every brain's final answer and is
   asked to _"produce ONE definitive Brain Council answer that takes the best, most
   correct parts from each, resolves contradictions… and is directly usable,"_ noting
   any important dissent at the end.

The web page and the CLI use the **same prompts** so the two surfaces behave the same.
