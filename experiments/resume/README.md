# Resume sensitivity experiment

Freeze `rubric.json` during the first experiment.

Run every fixture repeatedly against the same rubric. Start with 10 runs per model.

| Case | Expected directional change |
| --- | --- |
| baseline | Reference |
| no-payments | `payments_depth` collapses |
| no-ai | `ai_product_engineering` collapses |
| no-hands-on | `hands_on_engineering` and `product_engineer_fit` fall |
| pm-titles | Engineering evidence and PE fit remain close to baseline |

Do not tune the rubric after seeing individual outputs. Version the rubric if we intentionally change it.
