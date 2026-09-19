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
