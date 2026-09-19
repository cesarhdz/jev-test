# Jev Test

Experiments comparing structured decision models with frontier LLMs.

## Experiment 01: Resume sensitivity

The same synthetic candidate is evaluated with a frozen rubric while one signal is changed at a time.

Cases: `baseline`, `no-payments`, `no-ai`, `no-hands-on`, `pm-titles`.

We measure **sensitivity**, **invariance**, **stability**, and **performance** (latency, tokens, cost).

## Setup

```sh
cp .env.example .env
```

Keep API keys local. Fixtures and rubrics are provider-neutral so the same experiment can run against Jev and frontier models.
