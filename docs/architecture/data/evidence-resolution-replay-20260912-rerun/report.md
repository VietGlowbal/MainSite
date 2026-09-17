# Evidence-resolution replay — 2026-09-12

This replay used only the hash-verified `routed-refresh-20260912` run. It did
not acquire sources, call an LLM, write a database, promote an assertion, or
mutate canonical truth. The input hashes and all decisions are in
[`result.json`](result.json).

## Reusable mechanisms

`evidence_resolution.py` is the shared path used by semantic acceptance and
the replay. It finds a unique source span with token-aware punctuation and
whitespace tolerance, captures nearby row/header/section context, and leaves
repeated or materially ambiguous monetary rows unresolved. Structured parser
metadata can supply the row, column, table header, section, cycle, scope hint,
entity, and bounded context for that exact value; the source span and value
still have to match.

`resolve_entity_scope` binds a programme only from a linked programme ID, an
exact/descendant official URL, or a programme name in the source title. A
faculty/department binding requires a supplied verified unit or a unique unit
name in the source context. After the existing official-domain gate, an
unresolved programme scope may be widened to the owning institution; programme
membership alone never creates a faculty binding.

`resolve_provenance` and `binding_for_assertion` use the exact raw-document
binding first and a unique canonical source URL only as a fallback. Missing
hash, raw-document, run, authority, relationship, provider, dataset, parser,
and evidence-locator fields are propagated from that source. Conflicting URL,
hash, run, authority, relationship, provider, or dataset values remain
unresolved; no provenance is fabricated.

## Regression corpus and replay

The 166 input review proposals were classified from resolver diagnostics:

| Root cause | Cases | Still review | Resolved/accepted |
| --- | ---: | ---: | ---: |
| Alignment | 49 | 49 | 0 |
| Scope/entity binding | 0 | 0 | 0 |
| Provenance | 66 | 57 | 9 |
| Multiple fixes | 39 | 3 | 36 |
| Real insufficient evidence | 2 | 2 | 0 |
| Hard invalid | 10 | 2 | 8 rejected |

The replay aligned 106 retained spans, bound 107 source/entity contexts, and
repaired 105 provenance chains. It accepted only native observed facts; 42
accepted rows are programme-scoped and 41 are institution-scoped. No faculty
unit was fabricated because the frozen run has no verified organisation-unit
records.

| Measure | Frozen input | After resolver + acceptance |
| --- | ---: | ---: |
| Accepted observed assertions | 38 | 83 |
| Newly accepted | — | 45 |
| `NEEDS_REVIEW` | 166 | 113 |
| Hard-rejected decisions | — | 8 |

Newly accepted rows were 37 scholarships, 3 tuition, 2 minimum-degree, 1
additional-fee, 1 minimum-GPA, and 1 TOEFL observation. Remaining review reasons
are primarily unsupported currency/basis, unresolved multiple-amount alignment,
missing source spans, incomplete funding/threshold claims, and five
unverified organisation-unit cases.

## Unchanged H1–H4 evaluation

The existing evaluator ran over 361 target-field pairs without changing its
logic or parameters. Direct coverage is 32/361 (8.86%). H2 institution
fallback activated 8 times; H1 parent/faculty, H3 sibling, and H4 peer/external
donors activated zero times. Missing-target abstentions are 321/329 (97.57%),
and there are zero usable tuition donors. H2 support remains one independent
observation with no numerical dispersion; uncertainty remains the existing
heuristic signal.

## Safety and verification

No institution-specific rule or assertion fix was added. Search snippets remain
non-evidence, historical/archive semantics remain unchanged, and unsupported
values, identity mismatches, unresolved row alignment, and provenance conflicts
remain blocked. The structured-context merge is covered by the new regression
case in `test_evidence_resolution.py`.

Checks:

- Focused resolver/regression tests: **64 passed**.
- Complete ingestion test suite: **608 passed**.
- `compileall` for resolver, acceptance, and replay modules: passed.
- Acquisition, network, LLM, database, promotion, estimator, and benchmark
  activity: **0**.

Generated artifacts:

- [`result.json`](result.json)
- [`evidence-resolution-decisions.jsonl`](evidence-resolution-decisions.jsonl)
- [`metadata-reconciliation-decisions.jsonl`](metadata-reconciliation-decisions.jsonl)
- [`acceptance-decisions.jsonl`](acceptance-decisions.jsonl)
- [`hierarchical-evaluation.json`](hierarchical-evaluation.json)

