# Phase 3F V2 — Four-run comparison

Run #4: `phase3f-v2-run-20260905T161914Z`

All runs use the frozen truth/roster and unchanged scorer contract. Run #4
used direct DeepSeek with `deepseek-v4-flash`, reasoning `none`.

| Metric | Run #1 | Run #2 | Run #3 | Run #4 |
|---|---:|---:|---:|---:|
| Programme discovery | 91.67% (33/36) | 91.67% (33/36) | 100% (36/36) | 100% (36/36) |
| Required-source discovery | 91.67% (33/36) | 91.67% (33/36) | 100% (36/36) | 100% (36/36) |
| Critical precision | 5.00% (3/60) | 0/0 unavailable | 0/0 unavailable | 0.00% (0/31) |
| Resolved coverage | 2.46% (3/122) | 0% (0/122) | 0% (0/122) | 0% (0/122) |
| Safe-unresolved correctness | 0% (0/124) | 20.97% (26/124) | 68.55% (85/124) | 70.97% (88/124) |
| False-current critical | 6 | 0 | 0 | 0 |
| Effective non-null assertions | 0 | 262 | 596 | 665 |
| Projected FOUND/value | 3* | 0 | 0 | 31 |

`*` Run #1 headline used the baseline assertion/projection accounting; its
reported critical precision was 3/60. Run #4's persisted effective assertion
collection contains 1,276 rows, of which 665 have non-null `value_json`.

## Run #4 deltas

- Discovery: +8.33 percentage points versus runs #1/#2; unchanged versus run #3.
- Required-source discovery: +8.33 points versus runs #1/#2; unchanged versus run #3.
- Safe-unresolved correctness: +70.97 points versus run #1, +50.00 versus run #2,
  and +2.42 versus run #3.
- False-current: reduced from 6 in run #1 to 0 and remained 0 in runs #3/#4.
- Effective non-null assertions: +69 versus run #3; projected FOUND changed from
  0 to 31, but those 31 were all scorer-incorrect under the locked contract.

## Run #4 state distribution

| State | Count |
|---|---:|
| FOUND | 31 |
| NEEDS_REVIEW | 158 |
| ACCESS_BLOCKED | 49 |
| CONFLICTING_SOURCES | 5 |
| EXTRACTION_FAILED | 9 |
| NOT_EVALUATED | 0 |
| PARSE_FAILED | 0 |

## Interpretation

Run #4 is `FAIL — QUALITY`: all safety counters are zero, but critical
precision and resolved coverage are zero. The 4 scorer `CONFLICT` cases
(`GT-V2-11-tuition`, `GT-V2-19-tuition`, `GT-V2-25-credential`,
`GT-V2-32-tuition`) were retained as unresolved `CONFLICTING_SOURCES`, not
promoted; therefore they are not P0 safety violations. Fresh P0 safety
candidates: none. Fresh P1 clusters are chiefly identity precision (28
incorrect `programme_identity` values), fetch/access loss (48 fetch-class
errors), quality-policy loss (66), and extraction failures (9).

Detailed per-field, institution, stress-slice, error, regression-case, and
artifact-hash results are in the run report in this directory.
