# Phase 3F V2 Benchmark Report — phase3f-v2-run-20260905T030109Z

Benchmark gate classification: **FAIL — QUALITY**

This scorer summary was generated after the pipeline output was sealed. The
full authoritative audit, exact P1 case IDs, three-run comparison, per-field,
per-institution, stress-slice, and safety details are in
[run3-authoritative-audit.md](run3-authoritative-audit.md).

## Headline result

- Programmes: 36/36 attempted and terminal; 36/36 pipeline programme records.
- Sources fetched: 368.
- Assertions: 1,648 total; 602 pipeline non-null; 596 effective non-null.
- Final projected non-null values: 0.
- Programme discovery recall: 36/36 = 100.00%; every institution met the 80% floor.
- Required-source discovery recall: 36/36 = 100.00%.
- Critical precision: 0/0, unavailable because no resolved assertions were accepted.
- Resolved coverage: 0/122 = 0.00%.
- Safe-unresolved correctness: 85/124 = 68.55%.
- PRODUCT_SAFE: 0; evidence entailment is unavailable, not a pass.

## Zero-tolerance audit

All counters are zero:

- false-current critical
- fuzzy-only identity merge
- critical unresolved conflict promoted
- critical SOURCE_NOT_FOUND promoted
- critical STALE_ONLY promoted
- prohibited high-volatility inferred critical promoted
- PRODUCT_SAFE without durable provenance

## Integrity and isolation

- Frozen input checksum verification: PASS.
- Pipeline truth access: false.
- Scorer invoked before output seal: false.
- Node: v22.15.0; Node 24.19.x: DEFERRED / UNVERIFIED by user decision.
- Run #1 and run #2 sealed output hashes remain unchanged.

## Error taxonomy

QUALITY_POLICY: 99; CONFLICT: 47; FETCH: 12;
DISCOVERY: 2; EXTRACTION: 1; GROUND_TRUTH_AMBIGUOUS: 6.

P0 candidates: **none**. The 161 primary scoreable coverage-loss cases are
P1; their exact IDs and diagnostic grouping are in the authoritative audit and
errors.jsonl.

## Artifacts

- Pipeline output: pipeline-output.json
- Score result: score-result.json
- Errors: errors.jsonl
- Run manifest: run-manifest.json
- Authoritative audit: run3-authoritative-audit.md
- Three-run comparison: run1-vs-run2-vs-run3-comparison.md and .json

## Stop state

No remediation or later Slice F gate was run. Next action:
**QUALITY REMEDIATION REQUIRED**. Slice F remains **NO-GO**.

