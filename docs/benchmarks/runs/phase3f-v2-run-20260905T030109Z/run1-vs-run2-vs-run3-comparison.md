# Phase 3F V2 Official Runs #1, #2, and #3 Comparison

The three runs use the same frozen truth, roster, and scorer contract. Runs #1
and #2 are immutable historical baselines. Run #3 is the newly sealed official
run and remains **FAIL — QUALITY**.

| Metric | Run #1 | Run #2 | Run #3 | Run #3 − Run #2 |
|---|---:|---:|---:|---:|
| Programme discovery | 33/36 = 91.67% | 33/36 = 91.67% | 36/36 = 100.00% | +8.33 pp |
| Required-source discovery | 33/36 = 91.67% | 33/36 = 91.67% | 36/36 = 100.00% | +8.33 pp |
| Critical precision | 3/60 = 5.00% | 0/0 N/A | 0/0 N/A | N/A |
| Resolved coverage | 3/122 = 2.46% | 0/122 = 0.00% | 0/122 = 0.00% | +0.00 pp |
| Safe-unresolved correctness | 0/124 = 0.00% | 26/124 = 20.97% | 85/124 = 68.55% | +47.58 pp |
| False-current critical | 6 | 0 | 0 | 0 |
| Effective non-null assertions | 0 | 262 | 596 | +334 |
| Final non-null projected values | 66 | 0 | 0 | +0 |
| Pipeline errors | 60 | 58 | 53 | -5 |

Run #3 improved discovery to 100% and safe-unresolved correctness, and kept
all safety counters at zero. It still fails quality because no runtime value
survived into the final projection and only 85/124 confirmed unresolved cases
were semantically correct.

Provider comparison: run #1 had no provider calls; run #2 had 71 B.AI
OpenAI-compatible calls; run #3 had 252 direct DeepSeek Flash calls (253
logical requests), 0 retries, and 0 HTTP 429 responses.

The machine-readable equivalent is
`run1-vs-run2-vs-run3-comparison.json`.

