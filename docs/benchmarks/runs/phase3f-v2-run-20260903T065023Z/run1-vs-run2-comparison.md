# Phase 3F V2 Official Benchmark Run #1 vs Run #2 Comparison

- Run #1: `phase3f-v2-run-20260901T120410Z` (pre-remediation baseline; immutable).
- Run #2: `phase3f-v2-run-20260903T065023Z` (official post-Remediation 1 run; immutable output).
- Same frozen truth/roster/contract used for both runs; no truth or scorer changes.
- Run #1 classification: `FAIL — SAFETY`; run #2 classification: `FAIL — QUALITY`.

## Integrity and runtime

| Item | Run #1 | Run #2 |
|---|---|---|
| Code revision | `8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a` | `8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a` |
| Frozen truth SHA-256 | `97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4` | same |
| Roster SHA-256 | `7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139` | same |
| Machine contract SHA-256 | `720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99` | same |
| Pipeline output SHA-256 | `d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc` | `d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df` |
| Provider/model | unconfigured | `openai_compatible` / `deepseek-v4-flash` |
| Node | `v22.15.0` | `v22.15.0` |

## Headline comparison

| Metric | Run #1 | Run #2 | Delta (run2 - run1) | Threshold |
|---|---:|---:|---:|---:|
| Programme discovery recall | 33/36 (91.67%) | 33/36 (91.67%) | +0.00% | 90% |
| Required-source discovery recall | 33/36 (91.67%) | 33/36 (91.67%) | +0.00% | 90% |
| Critical precision | 3/60 (5.00%) | 0/0 (N/A) | N/A | 98% |
| Resolved coverage/recall | 3/122 (2.46%) | 0/122 (0.00%) | -2.46% | diagnostic; no separate locked threshold |
| Safe-unresolved correctness | 0/124 (0.00%) | 26/124 (20.97%) | +20.97% | 100% |
| PRODUCT_SAFE evidence entailment | 0/0 (N/A) | 0/0 (N/A) | N/A | 100% when denominator > 0 |

## Zero-tolerance counters

| Counter | Run #1 | Run #2 |
|---|---:|---:|
| false_current_critical_count | 6 | 0 |
| identity_merge_violations | 0 | 0 |
| critical_unresolved_conflict_promoted_count | 0 | 0 |
| critical_source_not_found_promoted_count | 0 | 0 |
| critical_stale_only_promoted_count | 0 | 0 |
| prohibited_high_volatility_inferred_critical_promoted_count | 0 | 0 |
| product_safe_without_durable_provenance_count | 0 | 0 |

## Execution and extraction observability

| Statistic | Run #1 | Run #2 |
|---|---:|---:|
| Programmes attempted | 36 | 36 |
| Pipeline programme records | 33 | 33 |
| Failed/partial programme records | 3 | 3 |
| Sources fetched | 251 | 287 |
| Assertions total | 1188 | 1298 |
| Assertions non-null (pipeline metric) | 0 | 266 |
| Assertions needing review | 0 | 160 |
| Assertions rejected | 0 | 45 |
| Pipeline errors | 60 | 58 |
| LLM/provider calls | 0 | 71 |
| Flash calls | 0 | 71 |
| Provider failure attempts | 0 | 258 |
| Terminal group failures | 0 | 50 |
| Prompt tokens | 0 | 556059 |
| Completion tokens | 0 | 71407 |

Run #2 source parser telemetry: 287/287 fetched sources had non-empty text with `html-visible-text` (276) or `pdf-text` (11); extraction trace recorded 45/45 parser-success events, 34 successful structured extraction events and 11 provider-failure events. Final benchmark projection contained 0 non-null values; no PRODUCT_SAFE output was emitted.

## Six original P0 regression cases

| Case | Runtime state | Value present | Product state | Scorer result |
|---|---|---:|---|---|
| `GT-V2-09-programme_identity` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |
| `GT-V2-09-credential` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |
| `GT-V2-15-credential` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |
| `GT-V2-22-credential` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |
| `GT-V2-23-credential` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |
| `GT-V2-27-credential` | `NEEDS_REVIEW` | no | `REVIEWABLE` | `SAFE_UNRESOLVED_PASS` |

All six prior false-current cases are corrected in run #2: no concrete value, no PRODUCT_SAFE promotion, and no scorer failure.

## Per-field comparison

| Field | Run #1 | Run #2 |
|---|---|---|
| `programme_identity` | 0/36 correct; 0 safe; 33 incorrect; 3 coverage; 1 false-current | 0/36 correct; 2 safe; 0 incorrect; 34 coverage; 0 false-current |
| `credential` | 3/36 correct; 0 safe; 30 incorrect; 3 coverage; 5 false-current | 0/36 correct; 6 safe; 0 incorrect; 30 coverage; 0 false-current |
| `programme_status` | 0/36 correct; 0 safe; 0 incorrect; 36 coverage; 0 false-current | 0/36 correct; 0 safe; 17 incorrect; 19 coverage; 0 false-current |
| `tuition` | 0/33 correct; 0 safe; 0 incorrect; 33 coverage; 0 false-current | 0/33 correct; 4 safe; 0 incorrect; 29 coverage; 0 false-current |
| `application_deadline` | 0/36 correct; 0 safe; 0 incorrect; 36 coverage; 0 false-current | 0/36 correct; 7 safe; 7 incorrect; 22 coverage; 0 false-current |
| `english_requirement` | 0/36 correct; 0 safe; 0 incorrect; 36 coverage; 0 false-current | 0/36 correct; 1 safe; 1 incorrect; 34 coverage; 0 false-current |
| `major_admissions_requirement` | 0/33 correct; 0 safe; 0 incorrect; 33 coverage; 0 false-current | 0/33 correct; 6 safe; 0 incorrect; 27 coverage; 0 false-current |

## Per-institution run #2

| Institution | Discovery | Correct | Safe unresolved | Incorrect | Coverage loss |
|---|---:|---:|---:|---:|---:|
| Cornell | 3/3 (100.00%) | 0 | 4 | 3 | 14 |
| Duke | 3/3 (100.00%) | 0 | 5 | 3 | 11 |
| ETH Zurich | 3/3 (100.00%) | 0 | 0 | 0 | 21 |
| Harvard | 1/3 (33.33%) | 0 | 3 | 1 | 14 |
| MIT | 3/3 (100.00%) | 0 | 5 | 5 | 11 |
| Northwestern | 3/3 (100.00%) | 0 | 1 | 0 | 19 |
| Princeton | 3/3 (100.00%) | 0 | 2 | 0 | 19 |
| Sorbonne Universit� | 3/3 (100.00%) | 0 | 0 | 4 | 17 |
| UCLA | 3/3 (100.00%) | 0 | 2 | 4 | 15 |
| University of Michigan | 3/3 (100.00%) | 0 | 0 | 2 | 19 |
| University of Tokyo | 2/3 (66.67%) | 0 | 2 | 1 | 18 |
| Universit� de Montr�al | 3/3 (100.00%) | 0 | 2 | 2 | 17 |

Institution floor is 33.33%; Harvard is 1/3 (33.33%) and University of Tokyo is 2/3 (66.67%), both below the locked 80% floor. The other ten institutions are 3/3.

## Stress-category run #2

| Category | Programmes | Discovery | Correct | Safe unresolved | Incorrect | Coverage loss |
|---|---:|---:|---:|---:|---:|---:|
| PDF | 14 | 11/14 (78.57%) | 0 | 10 | 8 | 79 |
| multilingual | 10 | 9/10 (90.00%) | 0 | 5 | 9 | 56 |
| related-party | 8 | 8/8 (100.00%) | 0 | 2 | 5 | 48 |
| historical | 33 | 30/33 (90.91%) | 0 | 22 | 22 | 181 |
| identity-edge | 16 | 15/16 (93.75%) | 0 | 7 | 7 | 97 |
| conflict-capable | 34 | 31/34 (91.18%) | 0 | 26 | 23 | 183 |
| adversarial | 27 | 25/27 (92.59%) | 0 | 18 | 19 | 148 |
| structured/catalogue | 17 | 15/17 (88.24%) | 0 | 15 | 9 | 91 |

## Error taxonomy

| Class | Run #1 | Run #2 | Delta |
|---|---:|---:|---:|
| APPLICABILITY | 6 | 0 | -6 |
| DISCOVERY | 20 | 93 | +73 |
| FETCH | 25 | 0 | -25 |
| GROUND_TRUTH_AMBIGUOUS | 6 | 6 | +0 |
| IDENTITY | 51 | 0 | -51 |
| PARSING | 135 | 17 | -118 |
| PROMOTION | 6 | 0 | -6 |
| QUALITY_POLICY | 6 | 110 | +104 |

## Priority classification

- P0 candidates: **none** in run #2. All locked zero-tolerance counters are zero and no PRODUCT_SAFE output was emitted.
- P1 candidates: all 220 primary scoreable cases that were neither `PASS` nor `SAFE_UNRESOLVED_PASS`; exact IDs are grouped below by scorer primary class.

### P1 DISCOVERY (93)

`GT-V2-04-application_deadline`, `GT-V2-04-english_requirement`, `GT-V2-04-major_admissions_requirement`, `GT-V2-04-programme_status`, `GT-V2-04-tuition`, `GT-V2-06-application_deadline`, `GT-V2-06-english_requirement`, `GT-V2-06-major_admissions_requirement`, `GT-V2-06-programme_status`, `GT-V2-07-application_deadline`, `GT-V2-07-english_requirement`, `GT-V2-07-major_admissions_requirement`, `GT-V2-07-programme_status`, `GT-V2-07-tuition`, `GT-V2-08-application_deadline`, `GT-V2-08-english_requirement`, `GT-V2-08-major_admissions_requirement`, `GT-V2-08-programme_status`, `GT-V2-08-tuition`, `GT-V2-09-application_deadline`, `GT-V2-09-english_requirement`, `GT-V2-09-major_admissions_requirement`, `GT-V2-09-programme_status`, `GT-V2-09-tuition`, `GT-V2-13-application_deadline`, `GT-V2-13-english_requirement`, `GT-V2-13-programme_status`, `GT-V2-13-tuition`, `GT-V2-14-application_deadline`, `GT-V2-14-english_requirement`, `GT-V2-14-major_admissions_requirement`, `GT-V2-14-programme_status`, `GT-V2-14-tuition`, `GT-V2-15-application_deadline`, `GT-V2-15-english_requirement`, `GT-V2-15-major_admissions_requirement`, `GT-V2-15-programme_status`, `GT-V2-15-tuition`, `GT-V2-21-application_deadline`, `GT-V2-21-english_requirement`, `GT-V2-21-major_admissions_requirement`, `GT-V2-21-programme_status`, `GT-V2-21-tuition`, `GT-V2-22-application_deadline`, `GT-V2-22-english_requirement`, `GT-V2-22-major_admissions_requirement`, `GT-V2-22-programme_status`, `GT-V2-22-tuition`, `GT-V2-23-application_deadline`, `GT-V2-23-english_requirement`, `GT-V2-23-major_admissions_requirement`, `GT-V2-23-programme_status`, `GT-V2-23-tuition`, `GT-V2-26-application_deadline`, `GT-V2-26-english_requirement`, `GT-V2-26-major_admissions_requirement`, `GT-V2-26-programme_status`, `GT-V2-26-tuition`, `GT-V2-27-application_deadline`, `GT-V2-27-english_requirement`, `GT-V2-27-major_admissions_requirement`, `GT-V2-27-programme_status`, `GT-V2-27-tuition`, `GT-V2-28-application_deadline`, `GT-V2-28-english_requirement`, `GT-V2-28-major_admissions_requirement`, `GT-V2-28-programme_status`, `GT-V2-28-tuition`, `GT-V2-29-application_deadline`, `GT-V2-29-english_requirement`, `GT-V2-29-major_admissions_requirement`, `GT-V2-29-programme_status`, `GT-V2-29-tuition`, `GT-V2-30-application_deadline`, `GT-V2-30-english_requirement`, `GT-V2-30-major_admissions_requirement`, `GT-V2-30-programme_status`, `GT-V2-30-tuition`, `GT-V2-33-application_deadline`, `GT-V2-33-english_requirement`, `GT-V2-33-major_admissions_requirement`, `GT-V2-33-programme_status`, `GT-V2-33-tuition`, `GT-V2-35-application_deadline`, `GT-V2-35-english_requirement`, `GT-V2-35-major_admissions_requirement`, `GT-V2-35-programme_status`, `GT-V2-35-tuition`, `GT-V2-36-application_deadline`, `GT-V2-36-english_requirement`, `GT-V2-36-major_admissions_requirement`, `GT-V2-36-programme_status`, `GT-V2-36-tuition`

### P1 PARSING (17)

`GT-V2-01-english_requirement`, `GT-V2-10-english_requirement`, `GT-V2-12-english_requirement`, `GT-V2-18-english_requirement`, `GT-V2-19-english_requirement`, `GT-V2-19-major_admissions_requirement`, `GT-V2-20-major_admissions_requirement`, `GT-V2-24-english_requirement`, `GT-V2-24-major_admissions_requirement`, `GT-V2-24-tuition`, `GT-V2-25-tuition`, `GT-V2-31-english_requirement`, `GT-V2-31-tuition`, `GT-V2-32-english_requirement`, `GT-V2-32-tuition`, `GT-V2-34-english_requirement`, `GT-V2-34-tuition`

### P1 QUALITY_POLICY (110)

`GT-V2-01-application_deadline`, `GT-V2-01-credential`, `GT-V2-01-programme_identity`, `GT-V2-01-programme_status`, `GT-V2-01-tuition`, `GT-V2-02-application_deadline`, `GT-V2-02-credential`, `GT-V2-02-programme_identity`, `GT-V2-02-programme_status`, `GT-V2-03-application_deadline`, `GT-V2-03-credential`, `GT-V2-03-english_requirement`, `GT-V2-03-programme_identity`, `GT-V2-03-programme_status`, `GT-V2-03-tuition`, `GT-V2-04-credential`, `GT-V2-04-programme_identity`, `GT-V2-05-credential`, `GT-V2-05-english_requirement`, `GT-V2-05-programme_identity`, `GT-V2-05-programme_status`, `GT-V2-07-credential`, `GT-V2-07-programme_identity`, `GT-V2-08-credential`, `GT-V2-08-programme_identity`, `GT-V2-10-credential`, `GT-V2-10-major_admissions_requirement`, `GT-V2-10-programme_identity`, `GT-V2-10-programme_status`, `GT-V2-10-tuition`, `GT-V2-11-credential`, `GT-V2-11-english_requirement`, `GT-V2-11-programme_identity`, `GT-V2-11-programme_status`, `GT-V2-12-credential`, `GT-V2-12-programme_identity`, `GT-V2-12-programme_status`, `GT-V2-13-credential`, `GT-V2-13-programme_identity`, `GT-V2-14-credential`, `GT-V2-14-programme_identity`, `GT-V2-15-programme_identity`, `GT-V2-16-application_deadline`, `GT-V2-16-credential`, `GT-V2-16-english_requirement`, `GT-V2-16-major_admissions_requirement`, `GT-V2-16-programme_identity`, `GT-V2-16-programme_status`, `GT-V2-16-tuition`, `GT-V2-17-credential`, `GT-V2-17-english_requirement`, `GT-V2-17-programme_identity`, `GT-V2-17-programme_status`, `GT-V2-17-tuition`, `GT-V2-18-credential`, `GT-V2-18-programme_identity`, `GT-V2-18-programme_status`, `GT-V2-18-tuition`, `GT-V2-19-application_deadline`, `GT-V2-19-credential`, `GT-V2-19-programme_identity`, `GT-V2-19-programme_status`, `GT-V2-20-application_deadline`, `GT-V2-20-credential`, `GT-V2-20-english_requirement`, `GT-V2-20-programme_identity`, `GT-V2-20-programme_status`, `GT-V2-21-credential`, `GT-V2-21-programme_identity`, `GT-V2-22-programme_identity`, `GT-V2-23-programme_identity`, `GT-V2-24-application_deadline`, `GT-V2-24-credential`, `GT-V2-24-programme_identity`, `GT-V2-24-programme_status`, `GT-V2-25-credential`, `GT-V2-25-english_requirement`, `GT-V2-25-major_admissions_requirement`, `GT-V2-25-programme_identity`, `GT-V2-25-programme_status`, `GT-V2-26-credential`, `GT-V2-26-programme_identity`, `GT-V2-27-programme_identity`, `GT-V2-28-credential`, `GT-V2-28-programme_identity`, `GT-V2-29-credential`, `GT-V2-29-programme_identity`, `GT-V2-30-credential`, `GT-V2-30-programme_identity`, `GT-V2-31-application_deadline`, `GT-V2-31-credential`, `GT-V2-31-major_admissions_requirement`, `GT-V2-31-programme_identity`, `GT-V2-31-programme_status`, `GT-V2-32-application_deadline`, `GT-V2-32-credential`, `GT-V2-32-major_admissions_requirement`, `GT-V2-32-programme_identity`, `GT-V2-32-programme_status`, `GT-V2-33-credential`, `GT-V2-33-programme_identity`, `GT-V2-34-application_deadline`, `GT-V2-34-credential`, `GT-V2-34-major_admissions_requirement`, `GT-V2-34-programme_identity`, `GT-V2-34-programme_status`, `GT-V2-35-credential`, `GT-V2-35-programme_identity`, `GT-V2-36-credential`, `GT-V2-36-programme_identity`

## Isolation and stop state

- Pipeline input was frozen roster/source register only; truth/review/scorer data was not passed to pipeline.
- Pipeline output was hashed and sealed before scoring; run #1 and frozen artifacts were not modified.
- No remediation, provider switch, scorer change, threshold change, later runtime gate, or rollout was performed after observing run #2.
- Next decision: `QUALITY REMEDIATION 2 REQUIRED`; do not run later gates until authorized.
- Node 24.19.x remains `DEFERRED / UNVERIFIED by user decision`.

