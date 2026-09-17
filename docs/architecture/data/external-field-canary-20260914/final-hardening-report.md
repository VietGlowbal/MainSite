# Final external canary hardening - 2026-09-15

This is the final Atlas recovery gate for the unchanged frozen manifest: 50
institutions and 100 programmes, SHA-256
`337be94f344025abff75ba6de9ce9653dcc062b714e6aa89451af9a99d689b9f`.
Promotion stayed disabled. The valid evidence set is the Atlas recovery run
plus the narrow Aalto current-relationship correction; the later full replay
that encountered DeepSeek HTTP 402 is explicitly excluded from the gate.

## A. Atlas recovery

The exact ingestion environment was `D:\projects\Glowbal\MainSite\.env.local`
and the URI host was `cluster0.i72bzd7.mongodb.net` (credentials omitted).
Certificate verification remained enabled and no TLS bypass, mock, or local
fallback was used.

| Check | Result |
| --- | --- |
| SRV resolution | PASS (3 hosts) |
| TCP connectivity | PASS |
| TLS handshake | PASS |
| Mongo authentication | PASS |
| Database selection | PASS |
| `MongoRawEvidenceStore.ensure_indexes()` | PASS |
| bounded write | PASS |
| read metadata and payload | PASS |
| delete and verify absence | PASS |

The smoke document was removed after verification. The only runtime warning
was the existing Python 3.14/cryptography notice about a negative certificate
serial; it did not affect the verified TLS/authenticated connection.

## B. Small real durable smoke

`runs/recovery-smoke-20260915/` used one ETH institution and two discovered
programmes. One deep programme was processed through real external requests,
Mongo/object storage, materialisation and semantic extraction: 1 raw source,
1 materialisation, 6 non-null semantic assertions, 6 accepted, 3 review, and
0 errors. Promotion was disabled and the configured local raw limit was zero.

## C. Resume/checkpoint

The production entry point is:

```text
python run.py run --config <config> --resume <run-directory|crawl_state.sqlite>
```

The existing SQLite state is used. Resume validates the run ID, configuration
fingerprint, institution population, per-institution seed fingerprints and
runtime switches. Completed checkpoints are skipped; retryable provider,
parser and durable-write failures remain `PARTIAL` and are eligible for a
later continuation.

Two real observations cover both branches:

- Resuming the frozen `final-20260915-mainenv` state after Atlas recovery
  skipped 50 terminal checkpoints and continued 0. That state had already been
  terminalized by the pre-Atlas outage attempt, so its zero-evidence output is
  not used for coverage.
- The controlled real interruption run `runs/resume-interruption-20260915/`
  was stopped with work running/not started, then resumed the same state. It
  continued all 12 selected institutions, reached 12 terminal checkpoints,
  preserved bindings, and produced 0 effective duplicates. Completed-skip,
  incompatible-state rejection and retryable-`PARTIAL` behavior are also
  covered by focused tests.

## D. Frozen-canary provider results

The primary run is `runs/final-20260915-atlas-recovery/`; the only correction
is `runs/final-20260915-aalto-repair-v2/`. Counts below are merged for the same
manifest. `Rows/matched` shows materialisation rows; `exact` is the existing
provider-slot target metric used by the gate.

| Provider | Eligible / attempted / exact | Raw persisted | Rows / matched | Semantic proposals | Accepted / review | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| College Scorecard (US) | 12 / 12 / 12 | 12 | 12 / 12 | 30 | 12 / 18 | 0 |
| swissuniversities (CH) | 8 / 8 / 8 | 8 | 8 / 8 | 27 | 23 / 4 | 0 |
| Onisep Idéo (FR) | 16 / 16 / 16 | 24 | 24 / 16 | 76 | 74 / 2 | 0 |
| Discover Uni (UK) | 16 / 12 / 12 | 12 | 12 / 11 | 128 | 119 / 9 | 1 target absence |
| DUO RIO (NL) | 16 / 16 / 16 | 16 | 16 / 16 | 50 | 49 / 1 | 0 |
| Susa-navet event (SE) | 6 / 6 / 6 | 6 | 6 / 6 | 14 | 14 / 0 | 0 |
| Susa-navet info (SE) | 6 / 6 / 6 | 6 | 6 / 6 | 23 | 22 / 1 | 0 |
| Studyinfo hakukohde (FI) | 6 / 6 / 6 | 7 | 7 / 7 | 8 | 8 / 0 | 0 |
| Studyinfo toteutus (FI) | 6 / 6 / 6 | 7 | 7 / 7 | 0 | 0 / 0 | 0 |
| Studyinfo valintaperuste (FI) | 6 / 6 / 6 | 7 | 7 / 7 | 19 | 13 / 6 | 0 |

Totals: 98 eligible provider slots, 94 attempted and 94 exact target matches,
105 persisted raw-source audit events, 105 materialisation rows, 375 unique
non-null effective semantic proposals (511 runtime non-null assertions), 334
accepted assertions and 41 review assertions.

Accepted external assertions by provider/field/scope:

| Provider | Accepted fields (count) | Scope |
| --- | --- | --- |
| Scorecard | tuition (12) | institution |
| swissuniversities | tuition (15), additional_fees (8) | institution |
| Onisep | programme_identity (15), credential (15), programme_focus (15), curriculum_overview (26), tuition (2), learning_outcomes (1) | programme |
| Discover Uni | programme_identity (10), credential (10), career_outcomes (33), employment_outcomes (46), programme_focus (8), curriculum_overview (7), learning_outcomes (5) | programme |
| DUO RIO | programme_identity (16), credential (16), programme_focus (17) | programme |
| Susa-navet event | intakes (5), final_deadline (6), curriculum_overview (3) | programme |
| Susa-navet info | programme_identity (6), programme_focus (5), curriculum_overview (6), subject_prerequisites (4), work_experience (1) | programme |
| Studyinfo hakukohde | required_documents (3), intakes (2), programme_focus (1), curriculum_overview (1), minimum_degree (1) | programme |
| Studyinfo valintaperuste | curriculum_overview (1), learning_outcomes (1), ielts_overall (2), toefl (2), standardized_tests (4), additional_fees (1), scholarships (2) | programme |

The accepted scope totals are 299 programme and 35 institution assertions.
Fields with no accepted row remain visible in the machine-readable coverage
matrix (`programme_status`, `academic_cycle`, `rolling_admission`,
`minimum_gpa`, `gpa_scale`, `ielts_subscores`, `duolingo`, application and
funding deadline/fee fields, recommendation/SOP/portfolio, and funding
amount/eligibility).

## E. Materialisation gate

```text
previous valid: 93/98 = 94.9%
new valid:      94/98 = 95.92%
required:       >=95%
```

This uses the same frozen provider-slot convention as the previous gate. A
strict unique-target `entity_match=true` count is 93/98 because one Discover
Uni route is the explicitly isolated Manchester target-level source absence;
it is not a persistence, parser, or platform failure and is not relabelled.

## F. Manchester final status

- `PUBUKPRN=10007798`, `KISCourse=28`, `KISMODE=Full-time`: exact official
  Discover Uni Computer Science route and accepted binding.
- `PUBUKPRN=10007798`, `KISCourse=2571195`, `KISMODE=Full-time`: current
  official route identifies Computer Science rather than the frozen Data
  Science target; retained as `TARGET_LEVEL_SOURCE_ABSENCE`, with no fuzzy
  match or acceptance relaxation.

## G. Studyinfo final status

The refreshed Aalto relationship is durable and exact:

```text
hakukohde:     1.2.246.562.20.00000000000000091188 (HTTP 200)
toteutus:      1.2.246.562.17.00000000000000008123
valintaperuste:34db13a9-3733-434c-a323-67c130ae0f1f (HTTP 200)
```

The stale `...70512` / `c9458393-...` relationship is no longer used. The
frozen programme key remains bound through the derived runtime alias, without
changing the manifest.

## H. Resume, idempotency and cache

The bounded replay at `runs/replay-20260914/` and the controlled resume show
stable target bindings and no uncontrolled effective assertion duplicates
(12 raw-content keys and 19 effective assertion keys overlapped; duplicate
counts were zero and target-binding consistency was true).
Audit streams remain append-only by design; effective streams are keyed and
idempotent. The valid Atlas run used 584 LLM calls, 115 cache hits, 469 cache
misses, and a maximum LLM in-flight count of 1. A later non-gate replay hit
DeepSeek HTTP 402 after quota exhaustion; it is excluded from the gate and
does not indicate an Atlas or persistence defect.

## I. Data integrity

```text
accepted rows checked:                 334
missing provider/source/hash/raw IDs:  0
bad scope / unknown provider IDs:       0 / 0
fabricated scope/cycle/currency/basis:  0
duplicate raw document IDs:             0
duplicate effective keys:               0
local raw bytes / configured maximum:   0 / 0
heavy local-copy violation:             false
```

Durable object storage wrote 924,129,432 bytes and 32 small sources used
Mongo inline storage. No raw heavy object was retained locally.

## J. H1-H4

The unchanged hierarchy evaluator produced:

```text
Direct: 180
H1:       0
H2:       0
H3:      48
H4:       0
abstentions: 1852
```

No hierarchy gate or compatibility rule was changed.

## K. Final readiness decision

**A — READY FOR MASS SCALE**

Atlas durable smoke, checkpoint continuation, the >=95% provider-slot gate,
integrity, failure isolation, idempotency and stable target bindings all pass.
The Manchester target-level source absence is a legitimate source outcome,
not a mass-scale blocker. Hardening stops here.

Recommended staged rollout (not executed in this task):

1. Stage 1: approximately 300-500 programmes.
2. Stage 2: 1,000+ programmes.
3. Stage 3: broader supported population.

Use the same `--resume` state path and keep promotion isolated until each stage
passes its operational and integrity checks.

## L. Tests and artifacts

Focused resume/external regressions: **29 passed** (`test_resume_checkpoint.py`,
`test_external_field_evidence.py`). The new runtime Aalto alias regression is
included. The full ingestion suite passed **670/670**, source compilation and
canary helper compilation passed, JSON artifacts validated, and `git diff
--check` passed (only normal CRLF normalization warnings were emitted).

Key artifacts:

- [`final-atlas-gate-result.json`](final-atlas-gate-result.json)
- [`atlas-recovery-smoke.json`](atlas-recovery-smoke.json)
- [`final-hardening-result.json`](final-hardening-result.json)
- [`final-config.json`](final-config.json) and [`final-config-ledger.json`](final-config-ledger.json)
- [`final-20260915-atlas-recovery`](runs/final-20260915-atlas-recovery/)
- [`final-20260915-aalto-repair-v2`](runs/final-20260915-aalto-repair-v2/)
- [`resume-interruption-20260915`](runs/resume-interruption-20260915/)
- [`replay-20260914`](runs/replay-20260914/)

No commit or push was made.
