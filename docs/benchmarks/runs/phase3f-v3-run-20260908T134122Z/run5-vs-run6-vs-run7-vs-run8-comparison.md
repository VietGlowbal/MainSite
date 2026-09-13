# Run #5 vs Run #6 vs Run #7 vs Run #8

| run | methodology | sources_fetched | provider_calls | tokens | assertions | effective_non_null | FOUND | NEEDS_REVIEW | ACCESS_BLOCKED | SOURCE_NOT_FOUND | EXTRACTION_FAILED | CONFLICTING_SOURCES | incorrect_FOUND | identity_incorrect | critical_precision | resolved_coverage | safe_unresolved | safety |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | official V3 | 360 | 271 | 2419983 | 1697 | 618 | 25 | 161 | 49 | 0 | 11 | 6 | 5 | 5 | 20/25 = 80.00% | 20/122 = 16.39% | 88/124 = 70.97% | 0,0,0,0,0,0,0 |
| 6 | official V3 | 358 | 255 | 2266255 | 1636 | 595 | 23 | 155 | 49 | 7 | 14 | 4 | 1 | 0 | 22/22 = 100.00% | 22/122 = 18.03% | 86/124 = 69.35% | 1,0,0,0,0,0,0 |
| 7 | official V3 | 364 | 271 | 2410776 | 1702 | 618 | 22 | 161 | 49 | 7 | 8 | 5 | 0 | 0 | 22/22 = 100.00% | 22/122 = 18.03% | 87/124 = 70.16% | 0,0,0,0,0,0,0 |
| 8 | official V3 | 356 | NOT PERSISTED; precheck=1 | NOT PERSISTED | 1645 | 576 | 21 | 153 | 56 | 7 | 14 | 1 | 0 | 0 | 21/21 = 100.00% | 21/122 = 17.21% | 82/124 = 66.13% | 0,0,0,0,0,0,0 |

Run #8 full-run provider request and token counters were not persisted; the separate connectivity precheck was one HTTP 200 request.
