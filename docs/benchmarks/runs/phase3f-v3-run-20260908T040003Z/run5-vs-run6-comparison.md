# Official Run #5 vs Run #6 comparison

| Metric | Run #5 | Run #6 |
|---|---|---|
| sources fetched | 360 | 358 |
| provider calls | 271 | 255 |
| logical requests | 276 | 262 |
| request attempts | 276 | 262 |
| prompt tokens | 2156714 | 2009742 |
| completion tokens | 263269 | 256513 |
| total tokens | 2419983 | 2266255 |
| assertions | 1697 | 1636 |
| effective non-null assertions | 618 | 595 |
| FOUND | 25 | 23 |
| NEEDS_REVIEW | 161 | 155 |
| ACCESS_BLOCKED | 49 | 49 |
| EXTRACTION_FAILED | 11 | 14 |
| incorrect FOUND | 5 | 1 |
| identity incorrect FOUND | 5 | 0 |
| critical precision | 20/25 (80.00%) | 22/22 (100.00%) |
| resolved coverage | 20/122 (16.39%) | 22/122 (18.03%) |
| safe-unresolved correctness | 88/124 (70.97%) | 86/124 (69.35%) |
| false_current_critical_count | 0 | 1 |
| identity_merge_violations | 0 | 0 |
| critical_unresolved_conflict_promoted_count | 0 | 0 |
| critical_source_not_found_promoted_count | 0 | 0 |
| critical_stale_only_promoted_count | 0 | 0 |
| prohibited_high_volatility_inferred_critical_promoted_count | 0 | 0 |
| product_safe_without_durable_provenance_count | 0 | 0 |

Identity incorrect FOUND fell from 5 to 0. Critical precision rose from 20/25 (80.00%) to 22/22 (100.00%). Resolved coverage rose from 20/122 (16.39%) to 22/122 (18.03%). Safe-unresolved correctness moved from 88/124 (70.97%) to 86/124 (69.35%). Discovery remained 36/36 and institution floor remained 100%. Run #6 has zero incorrect concrete FOUND values but one unsafe current-status promotion, so classification is FAIL — SAFETY. No post-score normalization was applied.
