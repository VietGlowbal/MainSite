# Run #6 vs Run #7

| Metric | Run #6 | Run #7 |
|---|---:|---:|---:|
| sources_fetched | 358 | 364 |
| provider_calls | 255 | 271 |
| tokens | 2266255 | 2410776 |
| assertions | 1636 | 1702 |
| effective_non_null_assertions | 595 | 618 |
| incorrect_concrete | 1 | 0 |
| identity_incorrect | 0 | 0 |
| programme_status_incorrect | 1 | 0 |
| FOUND | 23 | 22 |
| NEEDS_REVIEW | 155 | 161 |
| ACCESS_BLOCKED | 49 | 49 |
| SOURCE_NOT_FOUND | 7 | 7 |
| EXTRACTION_FAILED | 14 | 8 |
| CONFLICTING_SOURCES | 4 | 5 |
| critical precision | 100.00% | 100.00% |
| resolved coverage | 18.03% | 18.03% |
| safe-unresolved correctness | 69.35% | 70.16% |
| safety: false_current_critical_count | 1 | 0 |
| safety: identity_merge_violations | 0 | 0 |
| safety: critical_unresolved_conflict_promoted_count | 0 | 0 |
| safety: critical_source_not_found_promoted_count | 0 | 0 |
| safety: critical_stale_only_promoted_count | 0 | 0 |
| safety: prohibited_high_volatility_inferred_critical_promoted_count | 0 | 0 |
| safety: product_safe_without_durable_provenance_count | 0 | 0 |

Run #7 changes false-current from 1 to 0 and retains identity correctness.
