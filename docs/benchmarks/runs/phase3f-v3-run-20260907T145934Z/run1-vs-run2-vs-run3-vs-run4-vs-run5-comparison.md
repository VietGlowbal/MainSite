# Phase 3F Official Runs #1-#5 Comparison

Run #5 is the first full execution against frozen Benchmark V3. Runs #1-#3
used the V2 truth/scorer methodology; Run #4 was an offline V3 rescore of its
sealed V2 runtime output; Run #5 is a fresh V3 pipeline execution. Historical
outputs remain immutable.

| Metric | Run #1 | Run #2 | Run #3 | Run #4 / V3 offline | Run #5 / V3 |
|---|---:|---:|---:|---:|---:|
| Programme discovery | 33/36 (91.67%) | 33/36 (91.67%) | 36/36 (100%) | 36/36 (100%) | 36/36 (100%) |
| Required-source discovery | 33/36 (91.67%) | 33/36 (91.67%) | 36/36 (100%) | 36/36 (100%) | 36/36 (100%) |
| Critical precision | 3/60 (5.00%) | 0/0 (N/A) | 0/0 (N/A) | 24/30 (80.00%) | 20/25 (80.00%) |
| Resolved coverage | 3/122 (2.46%) | 0/122 (0%) | 0/122 (0%) | 24/122 (19.67%) | 20/122 (16.39%) |
| Safe-unresolved correctness | 0/124 (0%) | 26/124 (20.97%) | 85/124 (68.55%) | 88/124 (70.97%) | 88/124 (70.97%) |
| False-current critical | 6 | 0 | 0 | 0 | 0 |
| Effective non-null assertions | 0 | 262 | 596 | 665 | 618 |
| Projected FOUND | 3* | 0 | 0 | 31 | 25 |

Run #5 versus Run #4 / V3: discovery and required-source recall are unchanged
at 100%; critical precision is unchanged at 80%; resolved coverage is -3.28
percentage points; safe-unresolved correctness is unchanged; effective
non-null assertions are -47; and projected FOUND is -6. Run #5 remains clean
on every zero-tolerance safety counter.

\* Run #1's historical comparison records 3 projected values under its
baseline accounting; it is not a V3 execution and is not directly comparable
to the V3 state schema.

Classification for Run #5: **FAIL - QUALITY**. The locked 98% precision gate
is not met. The dominant remaining issue is mixed: 70 QUALITY_POLICY error
records suppress coverage, 48 FETCH records produce access-blocked losses, and
5 identity FOUND records are incorrect under the frozen V3 comparison.
