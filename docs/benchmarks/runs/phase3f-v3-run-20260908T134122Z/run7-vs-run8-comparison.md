# Run #7 vs Run #8

| run | sources_fetched | provider_calls | tokens | assertions | effective_non_null | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | SOURCE_NOT_FOUND | EXTRACTION_FAILED | CONFLICTING_SOURCES | incorrect_FOUND | identity_incorrect | programme_status_incorrect | critical_precision | resolved_coverage | safe_unresolved | safety |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 7 | 364 | 271 | 2410776 | 1702 | 618 | 22 | 161 | 49 | 7 | 8 | 5 | 0 | 0 | 0 | 22/22 = 100.00% | 22/122 = 18.03% | 87/124 = 70.16% | 0,0,0,0,0,0,0 |
| 8 | 356 | NOT PERSISTED; precheck=1 | NOT PERSISTED | 1645 | 576 | 21 | 153 | 56 | 7 | 14 | 1 | 0 | 0 | 0 | 21/21 = 100.00% | 21/122 = 17.21% | 82/124 = 66.13% | 0,0,0,0,0,0,0 |

Run #7 safe-unresolved correctness was 87/124; the Remediation 12 offline replay was 90/124; Run #8 measured 82/124. The lower fresh value is operational execution loss, with no concrete correctness or safety regression.
