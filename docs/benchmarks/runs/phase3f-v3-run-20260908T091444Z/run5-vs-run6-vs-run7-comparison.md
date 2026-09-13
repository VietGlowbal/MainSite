# Run #5 vs Run #6 vs Run #7

| Metric | Run #5 | Run #6 | Run #7 |
|---|---:|---:|---:|
| sources_fetched | 360 | 358 | 364 |
| provider_calls | 271 | 255 | 271 |
| tokens | 2419983 | 2266255 | 2410776 |
| assertions | 1697 | 1636 | 1702 |
| effective_non_null_assertions | 618 | 595 | 618 |
| incorrect_concrete | 5 | 1 | 0 |
| identity_incorrect | 5 | 0 | 0 |
| programme_status_incorrect | 0 | 1 | 0 |
| FOUND | 25 | 23 | 22 |
| NEEDS_REVIEW | 161 | 155 | 161 |
| ACCESS_BLOCKED | 49 | 49 | 49 |
| SOURCE_NOT_FOUND | 0 | 7 | 7 |
| EXTRACTION_FAILED | 11 | 14 | 8 |
| CONFLICTING_SOURCES | 6 | 4 | 5 |
| critical precision | 80.00% | 100.00% | 100.00% |
| resolved coverage | 16.39% | 18.03% | 18.03% |
| safe-unresolved correctness | 70.97% | 69.35% | 70.16% |
| safety: false_current_critical_count | 0 | 1 | 0 |
| safety: identity_merge_violations | 0 | 0 | 0 |
| safety: critical_unresolved_conflict_promoted_count | 0 | 0 | 0 |
| safety: critical_source_not_found_promoted_count | 0 | 0 | 0 |
| safety: critical_stale_only_promoted_count | 0 | 0 | 0 |
| safety: prohibited_high_volatility_inferred_critical_promoted_count | 0 | 0 | 0 |
| safety: product_safe_without_durable_provenance_count | 0 | 0 | 0 |

Run #5 failed identity quality; Run #6 fixed identity but failed safety; Run #7 closes correctness and safety while safe-unresolved quality remains below its frozen gate.
