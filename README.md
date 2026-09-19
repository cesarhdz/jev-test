# Jev Test

Experiments comparing structured decision models with frontier LLMs.

## Run locally

No bundler and no build step are required. Node serves the browser UI directly.

```sh
cp .env.example .env
# add TYPESAFE_API_KEY to .env
pnpm start
```

Open `http://localhost:3000`.

For auto-restart while editing:

```sh
pnpm dev
```

## Experiment 01: Resume sensitivity

The same synthetic candidate is evaluated with a frozen rubric while one signal is changed at a time.

Cases: `baseline`, `no-payments`, `no-ai`, `no-hands-on`, `pm-titles`.

We measure **sensitivity**, **invariance**, **stability**, and **performance** (latency, tokens, cost).

API keys remain server-side in `.env`. The fixtures and rubric are provider-neutral so the same experiment can later run against Jev and frontier models.
