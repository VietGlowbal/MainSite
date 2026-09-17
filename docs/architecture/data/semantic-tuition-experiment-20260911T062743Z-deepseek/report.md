# DeepSeek semantic tuition experiment

- Run: semantic-tuition-deepseek-20260911T062743Z
- Frozen sample: 10 institutions / 20 targets / 4 countries / cycle 2025-26
- DeepSeek calls: 20 attempted, 20 successful, 0 failed; HTTP 401/402/429: 0
- Semantic outcomes: 0 native OBSERVED assertions; 20 target-level abstentions; 0 schema failures; 0 unsupported or hallucinated fact rejections.
- Reason: retained topology sources did not explicitly publish tuition; the provider returned no tuition facts.
- H1-H4 evaluation: ran unchanged with an empty observed tuition assertion pool; direct coverage 0%, H1/H2/H3/H4 activation 0, 20/20 hierarchical abstentions.
- Accuracy/calibration: not measurable without held-out truth and accepted assertions.

OpenCode independently reconciled the 20 result rows, provider statistics,
sample manifest, hierarchy decisions, and retained-source inventory. It found
no accepted assertion to cross-check for value/currency/scope because the
provider emitted no facts. A reportability caveat remains: zero-fact outcomes
carry provider warnings rather than structured fact-level abstention reasons;
the run-level abstention count is therefore 20 while fact-level abstentions are
0. One excluded oversized Stanford retained object has a recorded-hash
mismatch, but it was not supplied to the provider and did not affect results.

The raw source inventory and original retained evidence remain unchanged. No canonical, promotion, estimator, or acquisition operation was run.
