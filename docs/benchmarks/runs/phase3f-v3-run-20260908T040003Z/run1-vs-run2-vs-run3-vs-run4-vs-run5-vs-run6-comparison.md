# Phase 3F Run #1–Run #6 comparison

Runs #1–#3 use historical V2 methodology; Run #4 has a V3 offline rescore; Runs #5 and #6 are official V3. V2 precision is historical context and is not directly comparable with official V3 precision.

| Run | Methodology | Sources fetched | Provider calls | Tokens | Assertions | Effective non-null assertions | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | EXTRACTION_FAILED | Precision | Resolved coverage | Safe-unresolved | Incorrect FOUND | Identity incorrect FOUND | Safety counters |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Run 1 | historical V2 methodology | 251 | 0 | None | 1188 | 0 | 66 | 0 | 0 | 0 | 3/60 (5.00%) | 3/122 (2.46%) | 0/124 (0.00%) | 63 | 33 | 6,0,0,0,0,0,0 |
| Run 2 | historical V2 methodology | 287 | 71 | 627466 | 1298 | 266 | 0 | 113 | 0 | 0 | n/a | 0/122 (0.00%) | 26/124 (20.97%) | 0 | 0 | 0,0,0,0,0,0,0 |
| Run 3 | historical V2 methodology | 368 | 252 | 2181411 | 1648 | 602 | 0 | 187 | 12 | 1 | n/a | 0/122 (0.00%) | 85/124 (68.55%) | 0 | 0 | 0,0,0,0,0,0,0 |
| Run 4 | V3 offline rescore available | 362 | 281 | 2539102 | 1756 | 671 | 31 | 158 | 49 | 9 | 0/31 (0.00%) | 0/122 (0.00%) | 88/124 (70.97%) | 31 | 28 | 0,0,0,0,0,0,0 |
| Run 5 | official V3 | 360 | 271 | 2419983 | 1697 | 618 | 25 | 161 | 49 | 11 | 20/25 (80.00%) | 20/122 (16.39%) | 88/124 (70.97%) | 5 | 5 | 0,0,0,0,0,0,0 |
| Run 6 | official V3 | 358 | 255 | 2266255 | 1636 | 595 | 23 | 155 | 49 | 14 | 22/22 (100.00%) | 22/122 (18.03%) | 86/124 (69.35%) | 1 | 0 | 1,0,0,0,0,0,0 |

Safety counter order: false_current_critical, identity_merge, unresolved_conflict, source_not_found, stale_only, inferred_high_volatility, PRODUCT_SAFE_without_durable_provenance. Run #6 is FAIL — SAFETY; Slice F remains NO-GO.
