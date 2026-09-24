# Frozen Phase 3F scorer fixtures

These tiny normalized-output fragments are deterministic negative controls for
the scorer. They are not benchmark runs and are never passed to the v3
pipeline. The perfect output is generated inside the scorer test from the
frozen truth only.

The fragments cover safe abstention, wrong values/identity, deadline and fee
scope mismatches, unsafe promotion, stale-only evidence, unresolved conflict,
source-not-found promotion, and missing durable provenance.
