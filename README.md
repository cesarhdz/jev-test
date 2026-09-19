# Jev Lab

Small experiments comparing structured decision models with general-purpose LLMs.

## Run locally

No bundler or build step is required.

```sh
cp .env.example .env
pnpm start
```

API keys remain server-side in `.env`.

## Repository

```text
experiments/
  resume/
    README.md
    rubric.json
    fixtures/
      manifest.json
      01-backend-specialist.md
      ...
      12-operations-pm.md
src/
  app.js
  style.css
server.js
```

Experiment 01 uses 12 synthetic Markdown resumes and three typed decisions. See `experiments/resume/README.md`.

## Live runs

`Run dataset` sends every selected resume to every selected provider through the local Node server. Provider keys never reach the browser. Results, uncertainty metadata, latency, and token usage are normalized and stored with the run snapshot in browser `localStorage`.

- TypeSafe uses the native System One API and preserves Jev's native probabilities/confidence.
- OpenAI and OpenRouter use strict structured output. Their displayed probabilities/confidence are self-assessed model outputs and are labeled separately from Jev's calibrated uncertainty.
- A failed evaluation is stored and displayed without discarding successful evaluations from the same run.

For reproducible OpenRouter comparisons, prefer a pinned model such as the default `qwen/qwen3.8-27b:free` instead of the rotating `openrouter/free` router.
