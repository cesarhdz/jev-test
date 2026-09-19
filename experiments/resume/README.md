# Experiment 01 — Resume decisions

Compare structured decisions from multiple models over a small, varied synthetic resume dataset.

## Dataset

`fixtures/` contains 14 synthetic resumes as Markdown. They vary by seniority, role shape, engineering depth, product ownership, customer exposure, and practical LLM experience. The dataset also includes Spanish and German resumes to test whether the same English evaluation contract remains stable across input languages.

`manifest.json` contains display metadata for the UI. The Markdown file is the actual model input and human-readable source of truth.

## Decisions

Every resume uses the same frozen `rubric.json`:

- `technical_depth` — Score 0–5
- `primary_profile` — Choice
- `llm_experience` — Noul

The same resume and rubric must be sent to every selected model. Runs are persisted locally by the browser so historical comparisons can be hydrated later.
