# Run #4 — V3 Candidate Identity Rescore

Status: **NON-OFFICIAL / METHODOLOGY EVALUATION**
Official run: `phase3f-v2-run-20260905T161914Z`
No recrawl, refetch, re-extraction, DeepSeek call, or mutation of Run #4 was performed.

## Official v2 result

The locked scorer produced **0/28** correct among the 28 Run #4 `programme_identity` values in `FOUND` state. This official result remains unchanged.

## Candidate v3 diagnostic

| Candidate result | Count |
|---|---:|
| Exact equivalent | 0 |
| Canonically equivalent | 24 |
| Wrong granularity | 3 |
| Factual wrong | 0 |
| Ambiguous | 1 |
| Coverage loss across all 36 | 8 |

Among the 28 runtime `FOUND` identity values, the candidate diagnostic is
**24/28 = 85.71% canonically equivalent**. The
three wrong-granularity cases are GT-V2-19 (pre-major/major stage), GT-V2-25
(department/degree scope), and GT-V2-32 (parent Master Informatique versus
MIND track). GT-V2-21 remains ambiguous because official evidence supports both
MS and PhD variants. No factual wrong runtime identity was established.

The eight non-FOUND identity cases remain coverage/operational outcomes and are
not converted into identity passes by this rescore.

## Candidate behavior checks

- Exact/canonical/alias equivalence requires structured-field agreement or
  official alias provenance.
- Parent/child is not equal by containment.
- Credential separation is explicit.
- Native titles are retained; invented translations are not accepted.
- Fuzzy-only pass: **false**.
- DeepSeek calls: **0**.
- Refetches: **0**.

## Pipeline classification

**`IDENTITY_PIPELINE_NEEDS_CANONICALIZATION`**, with a secondary
`IDENTITY_PIPELINE_NEEDS_GRANULARITY_FIX` cluster. The runtime evidence was not
shown factually wrong in this audit; the dominant issue is that flat runtime
strings cannot express the structured contract consistently.

This candidate rescore does not authorize runtime changes, scorer-v1 changes,
GT-v3 freezing, Remediation 9, or benchmark #5.
