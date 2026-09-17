# Retained semantic acceptance replay ? 2026-09-12

Acceptance now distinguishes evidence-supported observations from target applicability. The replay uses only the frozen routed-refresh-20260912 artifacts: 10 institutions, 20 selected targets, 19 acquired programme rows and 19 requested fields. No acquisition, LLM calls, database writes or promotion ran. Original artifacts are unchanged; their SHA256 hashes are recorded in result.json.

## Changes and safety

- Existing high-risk field proposals defaulted to NEEDS_REVIEW even with no validation errors. A post-validation acceptance pass now checks the actual bound retained source, exact excerpt and field-specific claim before accepting a native OBSERVED proposal.
- Missing optional cycle, audience, fee period and degree context can remain null/UNKNOWN. Unsupported optional funding labels/booleans can be omitted while retaining explicit funding details; unsupported amounts or core details are never completed. Every projection is logged.
- Institution-scoped statements are rebound to the actual institution entity, not the requesting programme. Explicit qualifications remain in evidence and structured details. Applicability remains UNKNOWN; acceptance does not assert universal eligibility or current-cycle applicability.
- Source URL/hash/raw-document/run/authority/relationship/dataset binding is mandatory. The existing assertion provider_id identifies the extraction provider (for this sample, openai_compatible); it is preserved separately from the acquisition provider reachable through raw source lineage.
- Wrong identity, non-native/inferred assertions and unsupported values cannot be accepted. Historical/future states remain explicit. Search results are blocked. Comparable material conflicts remain in review. Different named awards and distinct literal funding policy statements are not automatically competing claims.
- Graduation/completion GPA is not accepted as admission GPA. Negated requirements remain in review. Bare dollar signs do not establish USD. Unverified external entity linkage remains blocked.
- Accepted projections use the existing stable entity/field/source/value ID convention. Decision logs retain original proposal IDs. Rejected decisions are excluded from effective output and shared assertion caching.
- Existing accepted/rejected proposals are not re-labelled by this pass. H1?H4, uncertainty, acquisition, storage, promotion and canonical semantics were not edited.

## Acceptance results

Counts below are retained proposal rows, not independent sources or unique facts.

| Metric | Before | After |
|---|---:|---:|
| NEEDS_REVIEW | 166 | 124 |
| Concrete accepted OBSERVED rows | 38 | 72 |
| Newly accepted | ? | 34 |
| Newly hard rejected | ? | 8 |

There are 71 distinct accepted assertion IDs in 72 rows: one institution funding fact was repeated under two requesting targets. This is not two independent donors. The 57 pre-existing raw rejections remain rejected.

| Classification | Effective review proposals | All raw review proposals |
|---|---:|---:|
| ACCEPTABLE_NOW | 9 | 9 |
| ACCEPTANCE_POLICY_TOO_STRICT | 25 | 25 |
| HARD_INVALID | 8 | 8 |
| REAL_CONFLICT | 0 | 0 |
| IDENTITY_MISMATCH | 0 | 0 |
| INSUFFICIENT_EVIDENCE | 124 | 127 |

All 169 raw NEEDS_REVIEW proposals were inspected; the effective merge retained 166. No later replay-generated statuses were used as input.

| Field | Accepted before | Accepted after |
|---|---:|---:|
| programme_identity | 20 | 20 |
| academic_cycle | 3 | 3 |
| tuition | 0 | 0 |
| application_fee | 5 | 5 |
| additional_fees | 0 | 0 |
| intakes | 6 | 6 |
| priority_deadline | 0 | 0 |
| funding_deadline | 0 | 0 |
| international_deadline | 0 | 0 |
| final_deadline | 0 | 0 |
| rolling_admission | 1 | 1 |
| minimum_degree | 0 | 2 |
| minimum_gpa | 0 | 1 |
| gpa_scale | 3 | 3 |
| ielts_overall | 0 | 0 |
| ielts_subscores | 0 | 0 |
| toefl | 0 | 0 |
| duolingo | 0 | 0 |
| scholarships | 0 | 31 |

Accepted scope: {'programme': 37, 'institution': 35}. Source classes: {'official_web': 72}. All 72 accepted rows have temporal_state UNKNOWN; acceptance is not verified current truth.

## Remaining review reasons

| Reason | Count |
|---|---:|
| CURRENCY_NOT_ESTABLISHED | 44 |
| FIELD_NOT_SUPPORTED | 19 |
| UNSUPPORTED_FUNDING_DETAILS | 10 |
| EVIDENCE_NOT_IN_SNAPSHOT | 9 |
| MISSING_PROVENANCE | 8 |
| STRUCTURED_THRESHOLD_REQUIRES_REVIEW | 8 |
| DEADLINE_TYPE_NOT_SUPPORTED | 6 |
| BASIS_NOT_SUPPORTED | 4 |
| PROGRAMME_SCOPE_UNVERIFIED | 4 |
| THRESHOLD_NOT_EXPLICIT | 4 |
| REQUIREMENT_NOT_EXPLICIT | 4 |
| SUBJECT_SCOPE_UNVERIFIED | 3 |
| ADMISSION_VS_COMPLETION_UNRESOLVED | 1 |

Nine retained source rows failed raw snapshot hash verification, so they were not bound for acceptance. Eight review proposals lack a usable verified source binding. Nine further proposals have excerpts not found contiguously in their hash-verified snapshot. These are retained-evidence integrity/support gaps, not optional metadata, and were not bypassed or repaired.

## Unchanged H1?H4 evaluation

Uses the previous analyze_field_aware_refresh.py evaluation helper without modifying inference. Denominator is 19 acquired targets ? 19 fields = 361 target?field pairs; one frozen target has no acquired programme row.

| Metric | Before | After |
|---|---:|---:|
| Direct, unconflicted target?field pairs | 29/361 (8.03%) | 31/361 (8.59%) |
| H1 parent/faculty | 0 | 0 |
| H2 institution | 1 | 8 |
| H3 sibling | 0 | 0 |
| H4 peer/external | 0 | 0 |
| Unresolved among pairs without usable direct evidence | 331/332 (99.70%) | 322/330 (97.58%) |
| Raw engine abstentions (includes direct available) | 360/361 | 353/361 |

H2 after: intakes 1, minimum_degree 2, scholarships 5. Every emitted estimate has independent support count 1. Mean heuristic combined uncertainty: intakes 0.1987; minimum_degree 0.2387; scholarships 0.2807. Numerical donor dispersion is not measurable for these nonnumerical single-support outputs. No calibration or accuracy claim is made.

After: 316 NO_COMPATIBLE_DONOR, 3 DIRECT_TARGET_CONFLICT and 3 INCOMPATIBLE_NON_NUMERIC_DONOR_CONFLICT. The two original identity conflicts remain; additional funding records expose the unchanged engine?s inability to combine some nonnumerical records. These cases abstain. Acceptance-stage zero newly detected material conflicts does not mean all legacy or downstream conflict states are zero.

Tuition has zero accepted values and 19/19 target abstentions. Broader funding/eligibility acceptance helps H2 but does not supply independent, cycle/audience/basis-compatible tuition donors. The hierarchy was not weakened to use these observations.

## Verification

Environment: PYTHONPATH=services/data-ingestion/src;services/data-ingestion. Commands used rtk proxy.

- Baseline selected regression: `python -m pytest services/data-ingestion/tests/test_semantic_tuition.py services/data-ingestion/tests/test_hierarchical_inference.py services/data-ingestion/tests/test_core.py services/data-ingestion/tests/test_quality_slice_c.py -q` ? 226 passed.
- Final ingestion regression: `python -m pytest services/data-ingestion/tests -q` ? 533 passed, including 30 new semantic acceptance tests.
- `python -m compileall -q` on semantic_acceptance.py, pipeline.py, replay_semantic_acceptance.py and test_semantic_acceptance.py ? passed.
- `git diff --check -- services/data-ingestion/src/glowbal_ingestion/pipeline.py docs/current-status.md` ? passed.
- Inspected accepted value/evidence projections, including broader institution policy, funding qualifiers and graduation/admission GPA distinction. This was local review, not an independently executed OpenCode verification.

Replay command:

```powershell
$env:PYTHONPATH='services/data-ingestion/src;services/data-ingestion'
rtk proxy python services/data-ingestion/scripts/replay_semantic_acceptance.py --run-dir docs/architecture/data/field-aware-provider-routing-refresh-20260912/runs/routed-refresh-20260912 --output-dir docs/architecture/data/semantic-acceptance-replay-20260912 --audit-script docs/architecture/data/field-aware-refresh-20260911/analyze_field_aware_refresh.py
```

## Files and artifacts

- `services/data-ingestion/src/glowbal_ingestion/semantic_acceptance.py`: SourceBinding, reconsider_assertions, explicit claim checks and optional context projection.
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py`: final acceptance decision logging and effective assertion integration.
- `services/data-ingestion/tests/test_semantic_acceptance.py`: focused deterministic regressions.
- `services/data-ingestion/scripts/replay_semantic_acceptance.py`: bounded retained replay, classifications and existing hierarchy evaluation.
- `docs/current-status.md`: current milestone summary.
- This directory: `result.json`, `acceptance-decisions.jsonl`, `raw-proposal-classifications.jsonl`, `effective_field_assertions.jsonl`, `hierarchical-evaluation.json`, `report.md`.

No commit or push. The report counts reflect this retained sample only, not production-wide acceptance or calibrated truth.
