# Run #6 vs Run #7 vs Run #8

| run | critical_precision | resolved_coverage | safe_unresolved | incorrect_FOUND | identity_incorrect | programme_status_incorrect | FOUND | NEEDS_REVIEW | CONFLICTING_SOURCES | ACCESS_BLOCKED | SOURCE_NOT_FOUND | EXTRACTION_FAILED | safety |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | 22/22 = 100.00% | 22/122 = 18.03% | 86/124 = 69.35% | 1 | 0 | 1 | 23 | 155 | 4 | 49 | 7 | 14 | 1,0,0,0,0,0,0 |
| 7 | 22/22 = 100.00% | 22/122 = 18.03% | 87/124 = 70.16% | 0 | 0 | 0 | 22 | 161 | 5 | 49 | 7 | 8 | 0,0,0,0,0,0,0 |
| 8 | 21/21 = 100.00% | 21/122 = 17.21% | 82/124 = 66.13% | 0 | 0 | 0 | 21 | 153 | 1 | 56 | 7 | 14 | 0,0,0,0,0,0,0 |

Run #6 had one false-current safety failure. Runs #7 and #8 preserved the closed correctness and safety gates.
