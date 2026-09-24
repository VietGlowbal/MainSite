# Run #4 V2 vs V3 Score Comparison

| Metric | Benchmark V2 | Benchmark V3 offline rescore | Delta |
|---|---:|---:|---:|
| Programme discovery recall | 36/36 = 100.00% | 36/36 = 100.00% | 0 |
| Required-source discovery recall | 36/36 = 100.00% | 36/36 = 100.00% | 0 |
| Critical precision | 0/31 = 0.00% | 24/30 = 80.00% | +80.00 pp |
| Resolved coverage | 0/122 = 0.00% | 24/122 = 19.67% | +19.67 pp |
| Safe-unresolved correctness | 88/124 = 70.97% | 88/124 = 70.97% | 0 |
| False-current | 0 | 0 | 0 |
| FOUND values | 31 | 31 runtime FOUND; 24 identity comparisons pass | methodology only |

The V3 change is a representation/equivalence correction, not a pipeline
rerun. The 24 recovered identity comparisons are supported by the sealed
source-backed adjudication and structured contract. One identity case is
ambiguous and excluded from concrete precision; three remain wrong-granularity
failures. Tuition and major-admissions errors are unchanged.
