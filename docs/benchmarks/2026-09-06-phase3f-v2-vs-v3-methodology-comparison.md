# Phase 3F Benchmark V2 vs V3 Methodology

## Unchanged

- Frozen roster and 252-case population.
- All non-identity factual GT fields.
- Discovery, state, quality, Product Safety, and operational semantics.
- All quality thresholds and zero-tolerance safety requirements.
- Official Runs #1–#4 and V2 scorer artifacts.

## Changed in V3

- `programme_identity` is represented as a structured evidence-first object.
- `source_native_identity` is retained separately from canonical identity.
- Credential, degree level, parent/child, stage, joint/dual, and alias metadata
  are explicit dimensions.
- Official aliases and official translations can establish equivalence only with
  provenance.
- Parent/child, track, stage, joint/component, and dual/single distinctions are
  not automatically equivalent.
- Generic `AMBIGUOUS` identity comparison is excluded from concrete identity
  precision and reported separately; it counts as unresolved for coverage.

## Factual versus representation change

Factual GT corrections: **0**. The V3 change is a semantic-schema evolution
that resolves the V2 flat-string representation mismatch documented by the
independent 28-case evidence-first audit.

## Freeze order

Contract v2 → GT v3 → scorer v2 → validation/checksums → V3 freeze manifest →
offline sealed Run #4 rescore. No post-rescore policy change is permitted.
