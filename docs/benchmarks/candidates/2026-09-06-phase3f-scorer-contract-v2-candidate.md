# Phase 3F Scorer Contract v2 (Candidate)

Status: **candidate only; scorer v1 remains authoritative**.

The candidate consumes structured identity objects, not a single title string.
It applies only deterministic normalization and evidence-backed official alias
maps. Fuzzy-only matches cannot pass. Parent/child, track, stage, credential,
joint/dual, and ambiguity differences remain explicit outcomes.

## Comparison order

1. Require the same institution scope and compatible target case.
2. Normalize only case, whitespace, punctuation, and evidence-backed credential
   decomposition.
3. Resolve official aliases only when the alias relationship is in the
   candidate record with provenance.
4. Compare canonical entity, parent/child, track, specialization, stage,
   joint/dual structure, and credential scope.
5. Emit one of `EXACT_EQUIVALENT`, `CANONICALLY_EQUIVALENT`,
   `PARENT_CHILD_RELATED_NOT_EQUIVALENT`, `CREDENTIAL_VARIANT`,
   `ALIAS_EQUIVALENT`, `NOT_EQUIVALENT`, or `AMBIGUOUS`.

`AMBIGUOUS`, coverage loss, and operational states are not correct factual
matches. This candidate specification does not change v1 scoring or thresholds.
