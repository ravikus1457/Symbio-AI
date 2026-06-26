# Brain Council — desktop-app setup prompt

This file exists so you can set up the Brain Council in **Claude Code (desktop app)**
in one shot. The web/cloud Claude can't reach your computer or OpenRouter — the setup
has to run in the desktop app, where your network and key are available.

## How to use

1. Open **Claude Code in the desktop app** (the coding agent that can run a terminal —
   not the plain chat app).
2. Start a session in any folder.
3. **Copy the whole prompt below**, replace the key, and paste it in.

> Requires Claude **Code** (runs terminal commands). If yours can't run commands, use
> `council.html` in a browser, or run the CLI yourself (see `BRAIN-COUNCIL.md`).

---

## The prompt (copy everything in the box)

```text
You are my Brain Council orchestrator. Set this up, then use it from now on.

GOAL: I (Claude, running natively in this desktop app — free) act as the CHAIR.
My OpenRouter key is used ONLY for the non-Claude "foreign" brains: GLM, Qwen
Coder, DeepSeek, and Hermes. You call those brains via OpenRouter, then YOU
synthesize the final answer yourself — so OpenRouter is never billed for a
Claude call.

MY OPENROUTER KEY: sk-or-v1-REPLACE_WITH_MY_KEY

DO THIS NOW:
1. If this folder is not already the Symbio-AI repo on branch
   claude/multi-model-brain-council-s2hic8, get it:
     git clone https://github.com/ravikus1457/Symbio-AI.git
     cd Symbio-AI
     git checkout claude/multi-model-brain-council-s2hic8
2. Run: npm install
3. Create a file named .env in the repo root containing exactly:
     OPENROUTER_API_KEY=sk-or-v1-REPLACE_WITH_MY_KEY
   (.env is gitignored, so my key is never committed.)
4. Verify the key + network work by running:
     node scripts/council.mjs --models
   If it prints a list of model slugs, we're good. From that list, pick the
   BEST CURRENT slugs for: GLM, Qwen Coder, DeepSeek, and Hermes (prefer the
   newest versions available on my account). Tell me which you picked.
5. Test the council — foreign brains via OpenRouter, no synthesizer (you
   synthesize). Use the four slugs you picked:
     node scripts/council.mjs --no-synth --all --brains "<glm>,<qwen>,<deepseek>,<hermes>" "In one sentence, introduce yourself."
   Read their answers, then write a single synthesized "Brain Council answer."
6. Show me each brain's answer plus your synthesis, and confirm it worked.

THE PROTOCOL (use from now on, automatically):
Whenever I ask something hard, high-stakes, ambiguous, or easy to get subtly
wrong, convene the council without me having to ask:
  - Run: node scripts/council.mjs --no-synth --all --brains "<the 4 slugs>" "<my question, with full context>"
    (add --debate for the toughest ones so the brains critique each other)
  - Then reconcile their answers with your own reasoning and anything you can
    verify, and give me ONE "Brain Council answer," noting any genuine
    disagreement among the brains.
Use my OpenRouter key ONLY for those foreign brains. Never route a Claude call
through OpenRouter.
```

---

## Notes

- **Replace `sk-or-v1-REPLACE_WITH_MY_KEY` in both spots** with your real key from
  <https://openrouter.ai/keys>. It goes into a gitignored `.env`, so it's never
  committed — but it will appear in your desktop chat history. To keep it out of chat,
  delete the `MY OPENROUTER KEY` line and instead create `.env` yourself when asked.
- **Hermes is US-based (Nous Research)**, not Chinese. It's included because it was in
  your original council. For Chinese-only, drop it and use just GLM + Qwen + DeepSeek.
- Full reference: [`BRAIN-COUNCIL.md`](BRAIN-COUNCIL.md).
