# Phase 3F critical-field reference set v2

Status: **ALL 12 BATCHES HUMAN-REVIEWED; TRUTH FREEZE PENDING / OVERALL SET NOT SCOREABLE**  
Manifest: [roster v2](2026-08-30-phase-3f-roster-v2.md)  
Structured queue: [ground-truth-v2.jsonl](2026-08-30-phase-3f-ground-truth-v2.jsonl)  
Prepared: 2026-09-01

This queue was generated from the frozen roster and independent official-source evidence. It does not read v3 assertions, coverage, recovery, identity, or promotion output. After Batch 12 human review, 246 records are reviewed-confirmed, 6 are reviewed-ambiguous, and 0 remain unreviewed. Confirmed unresolved records retain NEEDS_REVIEW and a null value; ambiguous records remain outside ordinary scoring until the separate truth-freeze methodology permits them. No benchmark scorer has run and Slice F remains NO-GO.

## Gate tally
| Measure | Count |
|---|---:|
| Programmes in v2 roster | 36 / 36 |
| Field cases prepared | 252 (7 per programme) |
| Programmes with at least identity + credential queue entries | 36 / 36 |
| REVIEWED_CONFIRMED | 246 |
| REVIEWED_AMBIGUOUS | 6 |
| NOT_APPLICABLE | 0 |
| PROPOSED | 0 (no unreviewed proposals) |
| Still UNREVIEWED | 0 |
| Scoreable field cases | 0 |

No PROPOSED or UNREVIEWED records remain. Human review is complete, but the separate truth-freeze/scoring gate remains pending: ambiguous-case handling, scoreability, immutability/versioning, and the scorer input contract have not been decided. The queue is not yet a frozen reference set and must not be used to calculate precision, recall, PRODUCT_SAFE entailment, or rollout readiness.

## Field allocation

| Field | Queue cases | Reviewed confirmed | Ambiguous | Not applicable | Unreviewed |
|---|---:|---:|---:|---:|---:|
| Programme identity | 36 | 36 | 0 | 0 | 0 |
| Credential | 36 | 36 | 0 | 0 | 0 |
| Programme status | 36 | 36 | 0 | 0 | 0 |
| Tuition/fees | 36 | 33 | 3 | 0 | 0 |
| Application deadline/intake | 36 | 36 | 0 | 0 | 0 |
| English-language requirement | 36 | 36 | 0 | 0 | 0 |
| Major admissions requirements | 36 | 33 | 3 | 0 | 0 |
| **Total** | **252** | **246** | **6** | **0** | **0** |


Funding/scholarship remains an additional applicability review, not a silently assumed field. Where the reviewer establishes that it applies, add a new case with the same provenance requirements; where it does not apply, record NOT_APPLICABLE only after the reviewer establishes that applicability decision.

## Review batches
Review in bounded batches of three programmes. Each batch contains 21 queue records and must be independently confirmed or left unreviewed before the next batch is frozen.

| Batch | Programmes | Stress priority | Status |
|---|---|---|---|
| 1 | MIT 1-3 | catalogue, PDF, cycle | REVIEWED_CONFIRMED (21) |
| 2 | Harvard 4-6 | PDF, separate finance, conflict | REVIEWED_CONFIRMED (18); REVIEWED_AMBIGUOUS (3) |
| 3 | Princeton 7-9 | 403/access, graduate/undergraduate identity | REVIEWED_CONFIRMED (21) |
| 4 | Duke 10-12 | fragmented admissions/finance, adversarial | REVIEWED_CONFIRMED (19); REVIEWED_AMBIGUOUS (2) |
| 5 | Northwestern 13-15 | dual-school/partner identity, catalogue | REVIEWED_CONFIRMED (20); REVIEWED_AMBIGUOUS (1) |
| 6 | Cornell 16-18 | CEMS relationship, PDF/catalogue | REVIEWED_CONFIRMED (21) |
| 7 | UCLA 19-21 | Spanish source, cycle, separate finance | CLOSED: REVIEWED_CONFIRMED (21); initial 17 CONFIRM + 4 REJECT, correction 4 CONFIRM |
| 8 | UdeM 22-24 | French, MILA relationship, cycle | CLOSED: REVIEWED_CONFIRMED (21); initial 18 CONFIRM + 3 REJECT, correction 3 CONFIRM |
| 9 | University of Tokyo 25-27 | Japanese/English PDFs, ITASIA | CLOSED: REVIEWED_CONFIRMED (21) |
| 10 | ETH Zurich 28-30 | multilingual regulation, EPFL/partners | CLOSED: REVIEWED_CONFIRMED (21); initial 19 CONFIRM + 2 REJECT, correction 2 CONFIRM |
| 11 | Sorbonne Université 31-33 | French, 2026 PDF decisions, partners | CLOSED: REVIEWED_CONFIRMED (21); initial 19 CONFIRM + 2 REJECT, correction 2 CONFIRM |
| 12 | University of Michigan 34-36 | online/departmental split, cycle | CLOSED: REVIEWED_CONFIRMED (21) |

## Required record completion

For each JSONL line, an independent reviewer must populate or explicitly
confirm:

- `expected_state` using the semantic vocabulary (`FOUND`, `NOT_REQUIRED`,
  `NOT_PUBLISHED`, `STALE_ONLY`, `CONFLICTING_SOURCES`, or `NEEDS_REVIEW`);
- `expected_value` and `normalized_value` when the state is `FOUND`;
- exact `scope`, `audience`, and `academic_cycle`;
- source URL/identity, authority, publication/retrieval context, and an
  evidence locator (page/section/heading or stable text locator for PDFs);
- `review_status` as `REVIEWED_CONFIRMED`, `REVIEWED_AMBIGUOUS`, or
  `NOT_APPLICABLE`;
- reviewer identity, timestamp, and a concise review note.

`REVIEWED_AMBIGUOUS` records remain auditable but are excluded from scored
precision. `NOT_APPLICABLE` requires a reviewed applicability decision. A
transport failure is not human truth: blocked sources must be reviewed through
an authoritative fallback or remain ambiguous.

## Independence controls

The JSONL queue contains source locators and no copied HTML, PDF, raw body, or
v3 output. The reviewer must not inspect a pipeline result first and then
select evidence to agree with it. Competing current, scoped, translated, or
cycle-specific evidence must be preserved in the review note and supporting
evidence record rather than collapsed before review.
