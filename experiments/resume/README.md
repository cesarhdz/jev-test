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

`expected.json` contains the human-reviewed answer key used for the PoC. Score decisions use a narrow acceptable range; Choice and Noul decisions use one expected value. Expected values and their rationale are kept outside the model instructions.

## Runs

Runs are persisted in browser localStorage and can be exported as JSON from the History drawer. Exported raw runs can be committed under `results/` for reproducible analysis.


## PoC history and observations

This experiment started as a way to compare Jev's typed decisions with a frontier/general-purpose model on the same resume evidence. A reranker was later added as a third inference architecture so the comparison was not limited to two generative-style approaches.

The dataset was intentionally kept small: 8 synthetic resumes spanning clearly technical profiles, product profiles, and ambiguous hybrids. This is a proof of concept for exploring the behavior of different decision primitives, not an exhaustive benchmark.

The first runs suggested that most of the separation appears in `technical_depth`, the 0–5 Score decision. The Choice and Noul decisions are comparatively easy for all three approaches and therefore act as useful controls. On the Score, Jev repeatedly stayed close to the human expected ranges, while Luna tended to score technical exposure more aggressively in some profiles and the reranker was less reliable as an ordinal scorer.

Repeated runs were used primarily as a stability check. The observed pattern remained broadly consistent: Jev's score outputs were stable and close to the expected ranges, while categorical decisions were mostly shared by all models. Luna had at least one categorical miss on the AI Product Manager fixture, selecting Technical Product Manager instead of the expected Product Manager in one run. The reranker also showed occasional provider/evaluation failures during full-dataset runs.

Latency was the clearest architectural difference in the PoC. Jev consistently behaved more like a fast software decision primitive than a conversational model call. The reranker requires four calls per resume in the current design, while Jev and Luna evaluate the four-decision contract in one call.

These observations should be treated as evidence from this small PoC, not as a general model ranking. The useful hypothesis coming out of Experiment 01 is narrower: specialized typed models may be especially interesting for repeated, bounded, graded judgments where the application needs a decision rather than generated text.

## Next experiment direction

A second experiment should move to a different domain rather than expanding the resume benchmark indefinitely. Invoice evaluation is the leading candidate because it turns typed judgments into operational software decisions.

Potential invoice decisions to explore later:

- a graded confidence that an invoice matches its purchase order;
- whether the invoice requires human review;
- a categorical issue type such as amount mismatch, duplicate, missing PO, tax issue, or none;
- a graded risk for automatic payment.

The invoice fixtures should be synthetic and the human expected decisions should be defined before running any model. Interesting cases include clean invoices, small amount discrepancies, unusual but valid taxes, missing purchase orders, possible duplicates, inconsistent totals, and changed payment details.

The conceptual progression is: Experiment 01 asks whether a specialized model can make nuanced structured judgments from messy evidence; Experiment 02 asks whether those judgments are useful enough to sit directly inside an operational workflow.
