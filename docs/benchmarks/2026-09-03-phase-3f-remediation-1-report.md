# Phase 3F Remediation 1 smoke report

Date: 2026-09-03

Status: provider/extraction smoke PASS; full benchmark rerun READY. The
official 36-programme benchmark was not run.

## Live provider and extraction

- Provider: OpenAI-compatible Cline/B.AI endpoint `api.b.ai`.
- Model: `deepseek-v4-flash`; reasoning: `none`; Node remains 22.15.0.
- Connectivity smoke: PASS, HTTP 200, non-empty response, 1 call,
  158 prompt tokens, 6 completion tokens.
- Controlled structured extraction: PASS; schema
  `GlowBalEducationExtraction/v9`, one non-null fact, evidence and source URL
  validated.
- Official-document extraction: PASS using the retained Harvard Data Science
  HTML snapshot. Real parser output was non-empty; one LLM fact survived
  `extract_fields → fact_to_assertion → JSON → benchmark projection` as
  `FOUND` with a non-null value. Source URL, raw document ID, and evidence were
  retained.

## Three-programme smoke

Run: `phase3f-remediation1-3prog-20260903T062957Z`

Selected frozen roster rows: 1 (MIT AI, ordinary catalogue HTML), 2 (MIT CSE,
PDF/complex), and 22 (Université de Montréal Informatique, multilingual /
identity-sensitive).

- 3/3 runtime programme records.
- 30 sources fetched; one `BLOCKED_BY_ROBOTS` source error retained.
- 9 successful DeepSeek Flash calls; 12 failed provider attempts retained in
  extraction diagnostics; no Pro calls.
- 23 audit assertions, 10 non-null values, 4 `NEEDS_REVIEW` candidate values.
- 6 non-rejected non-null assertions had source URL, raw document ID, and
  evidence.
- Projection suppressed all 4 reviewable candidate values to canonical
  `NEEDS_REVIEW/null`. All 3 runtime credentials remained unresolved; no
  roster credential became runtime fact.
- No truth, review packet, expected value, or scorer contract was passed to
  the pipeline.

Artifacts:

- [smoke summary](remediation-smokes/phase3f-remediation1-3prog-20260903T062957Z/smoke-summary.json)
- [projection checks](remediation-smokes/phase3f-remediation1-3prog-20260903T062957Z/smoke-projection.json)
- Pipeline artifacts are in the sibling `pipeline-run/` directory.

## Validation

- Provider/remediation/scorer tests: 34 passed, 6 subtests.
- Core extraction/normalization selection: 47 passed, 138 deselected, 19
  subtests.
- `compileall`: PASS.
- Secret/logging pattern scan: PASS.
- `git diff --check`: PASS.
- Frozen truth, roster, scorer contract, and sealed baseline hashes unchanged.
- Node 22.15.0 retained; Node 24.19.x remains deferred/unverified.

The sealed baseline run remains
`phase3f-v2-run-20260901T120410Z`; no benchmark run #2 was created.
