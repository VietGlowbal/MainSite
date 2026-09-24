# Phase 3F V2 Official Benchmark Run #3 — Authoritative Audit

Run #3 is the third official frozen 36-programme benchmark after Remediations
1–5. This audit supplements the scorer-generated report in this run directory.
Its P0/P1 classification applies the locked zero-tolerance definitions: a
conservative `CONFLICTING_SOURCES` state is not a P0 unless it was promoted.

## Gate result

**FAIL — QUALITY**. Slice F remains **NO-GO**. No remediation, later Slice F
gate, or rollout was run.

## Run identity and integrity

- Run ID: `phase3f-v2-run-20260905T030109Z`
- Code revision: `8f616fe2c0fe9aeeaacdf7a12ecfd1df83292a5a`
- Dirty worktree: `true` (recorded at run start)
- Started: `2026-09-05T03:01:09+00:00`
- Finished: `2026-09-05T03:21:36+00:00`
- Python: `3.14.3`
- Node: `v22.15.0`; Node 24.19.x: `DEFERRED / UNVERIFIED by user decision`
- Frozen truth, roster, and scorer-contract checksum verification: **PASS**
- Pipeline truth access: `false`; scorer invoked before seal: `false`

Frozen input SHA-256 values:

| Artifact | SHA-256 |
|---|---|
| Frozen truth | `97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4` |
| Frozen roster | `7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139` |
| Contract Markdown | `47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91` |
| Machine contract | `720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99` |

Truth revalidation: 252 records, 252 unique IDs, 246 confirmed, 6 ambiguous,
0 unreviewed. Primary population is 118 `FOUND`, 124 confirmed
`NEEDS_REVIEW/null`, and 4 `NOT_REQUIRED`. The six ambiguous IDs remain in
the frozen truth and are excluded from primary denominators.

## Provider and execution

- Effective provider: `deepseek`
- Endpoint: `https://api.deepseek.com`
- Model: `deepseek-v4-flash`
- Reasoning: `none`
- DeepSeek API key: loaded locally; never emitted
- Direct connectivity preflight: **PASS**, HTTP 200, 606.8 ms, 63 prompt
  tokens, 11 completion tokens, 0 retries, 0 rate-limit responses
- `.env.local` contained compatible-provider variables, but the effective
  DeepSeek branch selected `DEEPSEEK_*` and the run manifest records direct
  DeepSeek. No B.AI endpoint was used.

All 36 roster rows were attempted and terminal: 36/36, 12/12 institutions,
0 failed/partial programme rows. The run sealed before scoring.

| Pipeline observation | Result |
|---|---:|
| Programme discovery | 36/36 (100.00%) |
| Required-source discovery | 36/36 (100.00%) |
| Sources fetched | 368 |
| Persisted raw HTML artifacts | 186 |
| Persisted raw PDF artifacts | 14 |
| Parser traces | 58/58 `parser_success=true` |
| Pipeline assertions total | 1,648 |
| Pipeline non-null assertions | 602 |
| Effective selected non-null assertions | 596 |
| Assertions rejected | 193 |
| Assertions needing review | 353 |
| Pipeline errors | 53 |

DeepSeek telemetry from the sealed pipeline report: 252 calls, 253 logical
requests, 253 request attempts, 4 cache hits, 252 Flash calls, 0 Pro calls,
1,972,261 prompt tokens, 209,150 completion tokens, 7 client failures,
4 group failures, 0 retries, 0 HTTP 429, 0 retry-after, 0 rate-limit
recoveries, and max in-flight 1. Five extraction-event failures were recorded;
the surfaced causes were invalid acceptance-rate range, truncated output,
missing evidence, and invalid document type (two events). No 401/402/5xx or
timeout was recorded in the provider telemetry.

## Final projection and headline metrics

Final runtime state distribution across 252 case projections:

| State | Count |
|---|---:|
| `FOUND` with non-null value | 0 |
| `NEEDS_REVIEW` | 187 |
| `CONFLICTING_SOURCES` | 50 |
| `ACCESS_BLOCKED` | 12 |
| `NOT_EVALUATED` | 2 |
| `EXTRACTION_FAILED` | 1 |
| `PARSE_FAILED` | 0 |
| Other | 0 |

| Metric | Result | Locked target/status |
|---|---:|---|
| Programme discovery recall | 36/36 = 100.00% | >=90%; no institution <80% — PASS |
| Required-source discovery recall | 36/36 = 100.00% | >=90% — PASS |
| Critical precision | 0/0 — unavailable | >=98%; no accepted assertions — not satisfied |
| Critical resolved coverage | 0/122 = 0.00% | diagnostic; materially insufficient |
| Safe-unresolved correctness | 85/124 = 68.55% | 100% contract expectation — FAIL |
| PRODUCT_SAFE evidence entailment | 0/0 — unavailable | 100% when denominator >0; no PRODUCT_SAFE emitted |
| Truth comparison failures | 0 | — |

The quality failure is driven by the absence of resolved runtime values and
the remaining 39 unsafe/operationally non-compatible safe-unresolved cases;
it is not a safety failure.

## Zero-tolerance safety audit

All locked counters are zero:

| Counter | Count |
|---|---:|
| False-current critical | 0 |
| Fuzzy-only identity merge | 0 |
| Critical unresolved conflict promoted | 0 |
| Critical `SOURCE_NOT_FOUND` promoted | 0 |
| Critical `STALE_ONLY` promoted | 0 |
| Prohibited high-volatility inferred critical promoted | 0 |
| PRODUCT_SAFE without durable provenance | 0 |

`PRODUCT_SAFE` total is 0, so entailment is **unavailable**, not a 100% pass.

## Remediation-4 and original P0 replay

All seven Remediation-4 cases have no concrete runtime value and therefore no
false-current regression. `GT-V2-02-tuition` is conservatively
`CONFLICTING_SOURCES`; the other six are `NEEDS_REVIEW`. All are safe under the
locked contract.

| Case | Runtime state | Value present | Product state | Result |
|---|---|---:|---|---|
| `GT-V2-01-major_admissions_requirement` | NEEDS_REVIEW | no | REVIEWABLE | safe |
| `GT-V2-02-major_admissions_requirement` | NEEDS_REVIEW | no | REVIEWABLE | safe |
| `GT-V2-02-tuition` | CONFLICTING_SOURCES | no | REVIEWABLE | no false-current; coverage loss |
| `GT-V2-15-application_deadline` | NEEDS_REVIEW | no | REVIEWABLE | safe |
| `GT-V2-15-major_admissions_requirement` | NEEDS_REVIEW | no | REVIEWABLE | safe |
| `GT-V2-22-english_requirement` | NEEDS_REVIEW | no | REVIEWABLE | safe |
| `GT-V2-22-major_admissions_requirement` | NEEDS_REVIEW | no | REVIEWABLE | safe |

The six original Remediation-1 P0 cases are also all `NEEDS_REVIEW`, null,
`REVIEWABLE`, and `SAFE_UNRESOLVED_PASS`:

`GT-V2-09-programme_identity`, `GT-V2-09-credential`,
`GT-V2-15-credential`, `GT-V2-22-credential`, `GT-V2-23-credential`,
`GT-V2-27-credential`.

## Per-field results

`Correct` means a resolved factual assertion matched frozen truth. No run-3
case reached that class because no value was projected.

| Field | Scoreable | Correct | Safe unresolved | Coverage loss | Operational failure | False-current | Precision | Resolved coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| programme_identity | 36 | 0 | 2 | 34 | 0 | 0 | 0/0 | 0/34 |
| credential | 36 | 0 | 6 | 30 | 0 | 0 | 0/0 | 0/30 |
| programme_status | 36 | 0 | 29 | 0 | 7 | 0 | 0/0 | 0/0 |
| tuition | 33 | 0 | 0 | 33 | 0 | 0 | 0/0 | 0/11 |
| application_deadline | 36 | 0 | 26 | 10 | 0 | 0 | 0/0 | 0/4 |
| english_requirement | 36 | 0 | 10 | 26 | 8 | 0 | 0/0 | 0/24 |
| major_admissions_requirement | 33 | 0 | 12 | 21 | 0 | 0 | 0/0 | 0/19 |

## Per-institution results

| Institution | Programmes | Discovery | Critical cases | Correct | Safe unresolved | Incorrect | Coverage loss | Unsafe promotions |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Cornell | 3 | 3/3 | 21 | 0 | 7 | 0 | 14 | 0 |
| Duke | 3 | 3/3 | 19 | 0 | 7 | 0 | 12 | 0 |
| ETH Zurich | 3 | 3/3 | 21 | 0 | 6 | 0 | 15 | 0 |
| Harvard | 3 | 3/3 | 18 | 0 | 6 | 0 | 12 | 0 |
| MIT | 3 | 3/3 | 21 | 0 | 10 | 0 | 11 | 0 |
| Northwestern | 3 | 3/3 | 20 | 0 | 10 | 0 | 10 | 0 |
| Princeton | 3 | 3/3 | 21 | 0 | 5 | 0 | 16 | 0 |
| Sorbonne Université | 3 | 3/3 | 21 | 0 | 10 | 0 | 11 | 0 |
| UCLA | 3 | 3/3 | 21 | 0 | 8 | 0 | 13 | 0 |
| University of Michigan | 3 | 3/3 | 21 | 0 | 2 | 0 | 19 | 0 |
| University of Tokyo | 3 | 3/3 | 21 | 0 | 3 | 0 | 18 | 0 |
| Université de Montréal | 3 | 3/3 | 21 | 0 | 11 | 0 | 10 | 0 |

All institutions met the discovery floor in run #3. The remaining quality loss
is field resolution/coverage, not programme discovery.

## Stress slices

Tags overlap; rows must not be summed.

| Slice | Programmes | Critical cases | Correct | Safe unresolved | Coverage loss | Main error classes |
|---|---:|---:|---:|---:|---:|---|
| PDF | 14 | 97 | 0 | 30 | 67 | CONFLICT 21; DISCOVERY 2; FETCH 6; QUALITY_POLICY 38 |
| multilingual | 10 | 70 | 0 | 28 | 42 | CONFLICT 14; DISCOVERY 2; FETCH 2; EXTRACTION 1; QUALITY_POLICY 23 |
| related-party | 8 | 55 | 0 | 17 | 38 | CONFLICT 10; DISCOVERY 2; EXTRACTION 1; QUALITY_POLICY 25 |
| historical | 33 | 225 | 0 | 75 | 150 | CONFLICT 44; DISCOVERY 2; EXTRACTION 1; FETCH 12; QUALITY_POLICY 91 |
| identity-edge | 16 | 111 | 0 | 36 | 75 | CONFLICT 22; DISCOVERY 2; EXTRACTION 1; FETCH 4; QUALITY_POLICY 46 |
| conflict-capable | 34 | 232 | 0 | 83 | 149 | CONFLICT 43; DISCOVERY 2; FETCH 10; QUALITY_POLICY 94 |
| adversarial | 27 | 185 | 0 | 64 | 121 | CONFLICT 37; DISCOVERY 2; EXTRACTION 1; FETCH 10; QUALITY_POLICY 71 |
| structured/catalogue | 17 | 115 | 0 | 38 | 77 | CONFLICT 25; FETCH 10; QUALITY_POLICY 42 |

## Error taxonomy and priority classification

Run-3 scorer taxonomy counts:

| Class | Count |
|---|---:|
| QUALITY_POLICY | 99 |
| CONFLICT | 47 |
| GROUND_TRUTH_AMBIGUOUS | 6 |
| FETCH | 12 |
| DISCOVERY | 2 |
| EXTRACTION | 1 |

### P0

**None.** All seven zero-tolerance counters are zero, no PRODUCT_SAFE value
was emitted, and benchmark integrity passed.

### P1

There are 161 primary scoreable coverage-loss cases. The exact IDs are grouped
by the scorer's primary diagnostic class below. `GROUND_TRUTH_AMBIGUOUS` is
not included as P1.

**CONFLICT (47):**

`GT-V2-01-tuition`, `GT-V2-02-tuition`, `GT-V2-03-tuition`,
`GT-V2-04-tuition`, `GT-V2-06-application_deadline`,
`GT-V2-06-major_admissions_requirement`, `GT-V2-07-tuition`,
`GT-V2-08-tuition`, `GT-V2-08-application_deadline`,
`GT-V2-08-major_admissions_requirement`, `GT-V2-09-tuition`,
`GT-V2-09-application_deadline`, `GT-V2-09-major_admissions_requirement`,
`GT-V2-10-tuition`, `GT-V2-11-tuition`, `GT-V2-13-tuition`,
`GT-V2-14-tuition`, `GT-V2-15-tuition`, `GT-V2-16-tuition`,
`GT-V2-17-tuition`, `GT-V2-18-tuition`, `GT-V2-19-tuition`,
`GT-V2-20-tuition`, `GT-V2-21-tuition`, `GT-V2-22-tuition`,
`GT-V2-23-tuition`, `GT-V2-24-tuition`, `GT-V2-25-tuition`,
`GT-V2-26-tuition`, `GT-V2-26-application_deadline`,
`GT-V2-26-major_admissions_requirement`, `GT-V2-27-tuition`,
`GT-V2-27-application_deadline`, `GT-V2-27-major_admissions_requirement`,
`GT-V2-28-tuition`, `GT-V2-29-tuition`, `GT-V2-30-tuition`,
`GT-V2-31-tuition`, `GT-V2-32-tuition`, `GT-V2-33-tuition`,
`GT-V2-34-tuition`, `GT-V2-35-tuition`,
`GT-V2-35-application_deadline`,
`GT-V2-35-major_admissions_requirement`, `GT-V2-36-tuition`,
`GT-V2-36-application_deadline`, `GT-V2-36-major_admissions_requirement`.

**QUALITY_POLICY (99):**

`GT-V2-01-programme_identity`, `GT-V2-01-credential`,
`GT-V2-01-application_deadline`, `GT-V2-02-programme_identity`,
`GT-V2-02-credential`, `GT-V2-03-programme_identity`,
`GT-V2-03-credential`, `GT-V2-03-application_deadline`,
`GT-V2-04-programme_identity`, `GT-V2-04-credential`,
`GT-V2-04-english_requirement`, `GT-V2-04-major_admissions_requirement`,
`GT-V2-05-programme_identity`, `GT-V2-05-credential`,
`GT-V2-05-english_requirement`, `GT-V2-07-programme_identity`,
`GT-V2-07-credential`, `GT-V2-07-english_requirement`,
`GT-V2-08-programme_identity`, `GT-V2-08-credential`,
`GT-V2-10-programme_identity`, `GT-V2-10-credential`,
`GT-V2-10-english_requirement`, `GT-V2-10-major_admissions_requirement`,
`GT-V2-11-programme_identity`, `GT-V2-11-credential`,
`GT-V2-11-english_requirement`, `GT-V2-12-programme_identity`,
`GT-V2-12-credential`, `GT-V2-12-english_requirement`,
`GT-V2-13-programme_identity`, `GT-V2-13-credential`,
`GT-V2-13-english_requirement`, `GT-V2-14-programme_identity`,
`GT-V2-14-credential`, `GT-V2-15-programme_identity`,
`GT-V2-15-english_requirement`, `GT-V2-16-programme_identity`,
`GT-V2-16-credential`, `GT-V2-16-application_deadline`,
`GT-V2-16-english_requirement`, `GT-V2-16-major_admissions_requirement`,
`GT-V2-17-programme_identity`, `GT-V2-17-credential`,
`GT-V2-17-english_requirement`, `GT-V2-18-programme_identity`,
`GT-V2-18-credential`, `GT-V2-18-english_requirement`,
`GT-V2-19-programme_identity`, `GT-V2-19-credential`,
`GT-V2-20-programme_identity`, `GT-V2-20-credential`,
`GT-V2-20-english_requirement`, `GT-V2-20-major_admissions_requirement`,
`GT-V2-21-programme_identity`, `GT-V2-21-credential`,
`GT-V2-21-english_requirement`, `GT-V2-21-major_admissions_requirement`,
`GT-V2-22-programme_identity`, `GT-V2-23-programme_identity`,
`GT-V2-23-major_admissions_requirement`, `GT-V2-24-programme_identity`,
`GT-V2-24-credential`, `GT-V2-24-major_admissions_requirement`,
`GT-V2-25-programme_identity`, `GT-V2-25-credential`,
`GT-V2-25-english_requirement`, `GT-V2-25-major_admissions_requirement`,
`GT-V2-26-programme_identity`, `GT-V2-26-credential`,
`GT-V2-27-programme_identity`, `GT-V2-28-programme_identity`,
`GT-V2-28-credential`, `GT-V2-28-english_requirement`,
`GT-V2-28-major_admissions_requirement`, `GT-V2-29-programme_identity`,
`GT-V2-29-credential`, `GT-V2-29-english_requirement`,
`GT-V2-29-major_admissions_requirement`, `GT-V2-30-programme_identity`,
`GT-V2-30-credential`, `GT-V2-30-english_requirement`,
`GT-V2-30-major_admissions_requirement`, `GT-V2-31-programme_identity`,
`GT-V2-31-credential`, `GT-V2-31-major_admissions_requirement`,
`GT-V2-32-credential`, `GT-V2-32-programme_identity`,
`GT-V2-32-major_admissions_requirement`,
`GT-V2-33-programme_identity`, `GT-V2-33-credential`,
`GT-V2-34-programme_identity`, `GT-V2-34-credential`,
`GT-V2-34-english_requirement`, `GT-V2-34-major_admissions_requirement`,
`GT-V2-35-programme_identity`, `GT-V2-35-credential`,
`GT-V2-36-programme_identity`, `GT-V2-36-credential`.

**FETCH (12):** `GT-V2-06-programme_status`,
`GT-V2-06-english_requirement`, `GT-V2-08-programme_status`,
`GT-V2-08-english_requirement`, `GT-V2-09-programme_status`,
`GT-V2-09-english_requirement`, `GT-V2-26-programme_status`,
`GT-V2-26-english_requirement`, `GT-V2-35-programme_status`,
`GT-V2-35-english_requirement`, `GT-V2-36-programme_status`,
`GT-V2-36-english_requirement`.

**DISCOVERY (2):** `GT-V2-27-programme_status`,
`GT-V2-27-english_requirement`.

**EXTRACTION (1):** `GT-V2-24-english_requirement`.

The exact machine-readable row-level diagnoses, source refs, raw refs, and
assertion refs are in `errors.jsonl`.

## Run #1 → #2 → #3 comparison

| Metric | Run #1 | Run #2 | Run #3 | Run #3 − Run #2 |
|---|---:|---:|---:|---:|
| Programme discovery | 33/36 = 91.67% | 33/36 = 91.67% | 36/36 = 100.00% | +8.33 pp |
| Required-source discovery | 33/36 = 91.67% | 33/36 = 91.67% | 36/36 = 100.00% | +8.33 pp |
| Critical precision | 3/60 = 5.00% | 0/0 N/A | 0/0 N/A | N/A |
| Resolved coverage | 3/122 = 2.46% | 0/122 = 0.00% | 0/122 = 0.00% | +0.00 pp |
| Safe-unresolved correctness | 0/124 = 0.00% | 26/124 = 20.97% | 85/124 = 68.55% | +47.58 pp |
| False-current critical | 6 | 0 | 0 | 0 |
| Effective non-null assertions | 0 | 262 | 596 | +334 |
| Final non-null projected values | 66 | 0 | 0 | +0 |
| Pipeline errors | 60 | 58 | 53 | -5 |
| Provider calls | 0 | 71 | 252 | +181 |

Historical output hashes remain immutable: run #1
`d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc`; run #2
`d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df`; run #3
`ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad992f39af1a90a8c`.

## Artifacts and validation

| Artifact | Path | SHA-256 |
|---|---|---|
| Run manifest | `run-manifest.json` | recorded in manifest |
| Sealed pipeline output | `pipeline-output.json` | `ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad992f39af1a90a8c` |
| Score result | `score-result.json` | `6cee0fa06aaeb4b2d315d9d768b0c55d2f42c39132d776463c71770a18bb8417` |
| Errors | `errors.jsonl` | `c87b7db6e5cf22d1de36a371bd0a952b7bffc23228d23fa8924b34501f800312` |
| Scorer report | `phase3f-v2-run-20260905T030109Z-benchmark-report.md` | `ac88d9acc41cf7057f5aa63023f733b42d2c289b691c0910f1be110f3588dea0` |

Post-run validation: 332 ingestion/scorer tests PASS; compileall PASS;
JSON/JSONL validation PASS (29 run JSON/JSONL files); secret scan PASS;
frozen inputs and official run #1/#2 hashes PASS; `git diff --check` PASS
(only normal LF/CRLF conversion warnings).

## Final decision

Benchmark classification is exactly **FAIL — QUALITY**. The next action is
**QUALITY REMEDIATION REQUIRED**; no remediation was performed in this task.
The official run is complete, sealed, and must not be rerun or modified.

Slice F remains **NO-GO**. Do not run the failure/restart/concurrency matrix,
schema/RLS gate, final regression, OpenCode review, pilot, US-50, or Asia-50
without separate authorization.
