# CLAUDE.md — working notes for Claude Code

## Project

Symbio AI marketing site — a **static Eleventy + Nunjucks** build.

- Source in `src/`, built output in `dist/` (`npm run build`); dev server `npm run dev`.
- `.njk` files are templates; raw `.html` files (`chatbot-demo.html`, `council.html`)
  are passthrough-copied verbatim and must stay **self-contained** (inline CSS/JS).
- Global content lives in `src/_data/site.js`; shared chrome in `src/_includes/`.
- No backend, no database. Deploys to GitHub Pages on push to `main`.
- Quality: `npm run lint` (CSS/JS/HTML), `npm run format`.

## 🧠 Brain Council protocol (consult other models on hard problems)

For tasks that are **difficult, high-stakes, ambiguous, or easy to get subtly wrong**
(architecture/design decisions, tricky algorithms, security-sensitive code, debugging
a stubborn issue, anything irreversible), don't answer solo. Convene the **Brain
Council**: get independent answers from other top models, let them debate, then give a
**synthesized "Brain Council answer."** See [`BRAIN-COUNCIL.md`](BRAIN-COUNCIL.md).

**Council:** Claude (you) + GLM + Qwen Coder + DeepSeek + Hermes, via OpenRouter.

### How to convene it

Prefer the CLI — it does the fan-out, debate, and synthesis in one shot:

```bash
node scripts/council.mjs --all "<the concrete question, with enough context>"
# --all also prints each brain individually so you can weigh them yourself.
# --json for structured output you can parse.
```

Then form your **Brain Council answer**: reconcile the council's output with your own
reasoning and what you can verify in the codebase — don't just echo it. Tell the user
it's a Brain Council answer and note any genuine disagreement among the brains.

### Preconditions (check before relying on it)

The council needs **both** to work live:

1. `OPENROUTER_API_KEY` is set in the environment, and
2. the network policy allows outbound HTTPS to **`openrouter.ai`**.

Quick check:

```bash
test -n "$OPENROUTER_API_KEY" && \
  curl -sS -o /dev/null -w '%{http_code}\n' https://openrouter.ai/api/v1/models \
       -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

If the key is missing or `openrouter.ai` is blocked (e.g. the default web sandbox
blocks it and sets no key), **say so plainly**: give your best solo answer, label it as
not council-verified, and point the user to `BRAIN-COUNCIL.md` for how to enable live
consultation (allow `openrouter.ai` in the env's network policy + set
`OPENROUTER_API_KEY`). The user can always run the council themselves in the browser
(`council.html`) or via the CLI on their own machine.

### Model slugs

Defaults are in `scripts/council.mjs` (`DEFAULT_BRAINS`) and `src/council.html`.
They drift — `node scripts/council.mjs --models` lists the live slugs the account can
use; prefer the newest GLM / Qwen-Coder / DeepSeek / Hermes when picking.
