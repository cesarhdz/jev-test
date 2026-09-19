# Experiment 01 — Resume decisions

Compare structured decisions from multiple models over a small, deliberately adversarial synthetic resume dataset.

## Dataset

`fixtures/manifest.json` selects 8 synthetic resumes from the fixture library. The active set emphasizes contrasting role shapes: backend specialist, AI product engineer, senior PM, technical PM, forward deployed engineer, ambiguous product/engineering hybrid, AI PM, and founder-builder.

The Markdown file is the actual model input and human-readable source of truth.

## Decisions

Every resume uses the same frozen `rubric.json`:

- `technical_depth` — Score 0–5
- `primary_profile` — Choice
- `production_ai_ownership` — Noul
- `recent_hands_on_engineering` — Noul

The benchmark compares three different decision architectures:

- TypeSafe Jev evaluates all four typed decisions in one System One request and exposes native uncertainty.
- OpenAI Luna evaluates the full contract in one generative structured-output request.
- Qwen3 Reranker 8B uses OpenRouter's rerank endpoint. Each decision is one rerank request: the resume + decision contract is the query and the valid answers are the documents. The four decision calls run in parallel. Relevance scores are preserved as model-native metadata and must not be interpreted as probabilities.

The normalized final decisions remain comparable even though the underlying inference architecture differs.

## Human expected results

`expected.json` contains a draft human-reviewed answer key. Expected values are sets of acceptable outcomes rather than a single forced answer. It must be reviewed/frozen before it is used to score future runs.

## Runs

Runs are persisted in browser localStorage and can be exported as JSON from the History drawer. Exported raw runs can be committed under `results/` for reproducible analysis.
