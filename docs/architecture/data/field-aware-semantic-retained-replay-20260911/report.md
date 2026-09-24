# Offline semantic tuition extraction experiment

Experiment run: `semantic-tuition-offline-20260911T090130Z`

This bounded run used retained topology evidence only. The extraction provider was deliberately disabled, so no LLM/provider call was made and no assertion was generated.

- Institutions: **10**
- Targets: **20**
- Countries: **CA, CH, FR, US**
- Semantic items attempted: **20**
- Valid native OBSERVED assertions: **0**
- LLM calls: **0**

## Outcome

- Provider-unavailable outcomes: **20**
- Schema failures: **0**
- Retained target-source coverage: **95.0%**
- Retained content-source coverage: **95.0%**
- Hierarchical activation: **not run** because no semantic assertions were available.
- Accuracy/calibration: **not measurable**; no model output or held-out evaluation was used.

## Safety

- Search snippets were not used as evidence.
- No archive/current-truth promotion occurred.
- No canonical/product truth or promotion data was changed.
- No network, LLM, estimator, or topology acquisition call was made.

Artifacts: `manifest.json`, `attempts.jsonl`, `results.jsonl`, `source-inventory.jsonl`, `source-selection.jsonl`, `evaluation.json`.
