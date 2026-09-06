# Run #4 — Benchmark V3 Offline Rescore

Status: **OFFICIAL EVALUATION UNDER BENCHMARK V3 OF A PREVIOUSLY SEALED OUTPUT**
Pipeline run: `phase3f-v2-run-20260905T161914Z`
Sealed pipeline SHA-256: `8dc5d04d36d1fd8cdaadcf9a44fdb34263091bc56c0db2ad088634ea9b904b9d`
DeepSeek calls: **0**; recrawl/refetch/re-extraction: **none**.

## Classification

**FAIL — QUALITY**. Safety remains clean, but critical precision is
**24/30 = 80.00%**, below the locked 98% target.

## Overall V3 metrics

| Metric | V3 result |
|---|---:|
| Programme discovery recall | 36/36 = 100.00% |
| Required-source discovery recall | 36/36 = 100.00% |
| Critical precision | 24/30 = 80.00% |
| Resolved coverage | 24/122 = 19.67% |
| Safe-unresolved correctness | 88/124 = 70.97% |
| PRODUCT_SAFE evidence entailment | unavailable (0 PRODUCT_SAFE records) |

## Identity rescore

Among the 28 Run-4 `programme_identity` FOUND values:

- canonical/credential/alias-equivalent: **24**
- exact-equivalent: **0**
- wrong granularity: **3**
- ambiguous: **1**
- factually wrong: **0**
- concrete identity precision: **24/30**

The 24 recoveries are due to justified canonicalization, credential
separation, official alias handling, or structured identity comparison. The
three remaining identity failures are GT-V2-19 (pre-major/major), GT-V2-25
(department/degree scope), and GT-V2-32 (parent/MIND track). The ambiguous
identity is GT-V2-21. This is an audit-only methodology rescore, not a new
pipeline execution and not a change to the official V2 score.

## Remaining true quality failures

The three concrete remaining wrong predictions are the three identity
granularity cases above plus two tuition cases and one major-admissions case.
The two tuition and one major-admissions failures are intentionally outside
this identity-contract task and remain next quality targets.

## Safety

All seven zero-tolerance counters remain **0**: false-current, fuzzy-only
merge, unresolved conflict promoted, SOURCE_NOT_FOUND promoted, STALE_ONLY
promoted, prohibited inferred high-volatility critical promotion, and
PRODUCT_SAFE without durable provenance.

## Freeze boundary

Contract v2, GT v3, scorer v2, and the V3 freeze manifest were sealed before
this rescore. No post-rescore methodology change was made.
