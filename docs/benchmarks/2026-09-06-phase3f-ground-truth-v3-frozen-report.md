# Phase 3F Ground Truth V3 — Frozen Report

Status: **FROZEN** as Benchmark V3 methodology input
Frozen at: `2026-09-06T08:14:44.618374Z`

## Population and factual-change boundary

- Total truth records: **252**
- Unique case IDs: **252**
- Programme-identity cases: **36**
- Reviewed-confirmed: **246**
- Reviewed-ambiguous: **6**
- Unreviewed: **0**
- Factual GT corrections: **0**
- Representation/schema evolution: **36 identity records carry structured v3 identity**

The V3 artifact preserves every V2 row and every non-identity factual field.
The additional `programme_identity_v3` object separates source-native identity,
canonical programme identity, credential, degree level, hierarchy, stage,
joint/dual semantics, aliases, and ambiguity without rewriting V2 expected text.

## Identity change types

- `AMBIGUITY_REPRESENTED`: **4**
- `CREDENTIAL_SEPARATED`: **2**
- `GRANULARITY_RESTRUCTURED`: **1**
- `HIERARCHY_ADDED`: **7**
- `REPRESENTATION_RESTRUCTURED`: **22**

## Approved human queue

- `APPROVE_CANONICAL_EQUIVALENCE`: **1**
- `APPROVE_STRUCTURED_HIERARCHY`: **5**
- `KEEP_AMBIGUOUS`: **3**
- `KEEP_NON_EQUIVALENT_GRANULARITY`: **3**

The twelve human-queue decisions are recorded in
`docs/benchmarks/audits/2026-09-06-phase3f-programme-identity-contract-v2-human-review-log.jsonl`.
Ambiguous cases remain explicit; no identity is forced to pass for benchmark
coverage.

## Version boundary

V2 truth, V2 scorer, V2 freeze manifest, and official Runs #1–#4 remain
immutable. V3 is a new frozen methodology artifact and is not a claim that V2
factual labels were wrong.
