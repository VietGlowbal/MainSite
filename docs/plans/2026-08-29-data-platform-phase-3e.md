# Phase 3E — Ingestion convergence, legacy and scholarships

## Scope and rollout

Slice E adds a shadow/convergence contract. It does not apply migrations,
replace the legacy promotion path, remove the TypeScript parser, shut down
direct writes, or cut over scholarship reads. The retained Node runtime is
22.15.0; Node 24 verification and live schema verification remain deferred.

## Ingestion inventory

| Path | Input/output and writes | Slice E classification |
|---|---|---|
| Python acquisition (`services/data-ingestion/.../pipeline.py`) | Slice B acquisition, raw/staging artifacts, assertions and existing promotion compatibility | Converged shadow envelope; existing promotion compatibility |
| Legacy parser (`src/lib/course-parser/extract-course.ts`, `job-processor.ts`) | URL fetch/OpenAI extraction; application snapshot, checklist, source and scholarship writes; `course_parse_jobs` state | Common assertion adapter; application compatibility-only writes |
| Manual URL (`src/app/api/applications/from-course-url/route.ts`) | Approved-domain validation, cache lookup, `programme_ingestion_jobs`, or legacy queue fallback | Slice B acquisition intent shadow; legacy rollback remains |
| Programme CSV (`scripts/import-university-programs-csv.mjs`) | Structured CSV → crawl staging → existing promotion compatibility | File/hash/row assertion envelope; explicit confirmed migration path |
| Crawl catalogue backfill (`scripts/import-crawl-programmes-to-courses.mjs`) | Staging rows → direct `courses` upsert | Migration-only direct writer; guarded by explicit `--apply` and migration purpose |
| Scholarship CSV/provider ETL (`clean-scholarships.mjs`, `seed-scholarships.mjs`) | Deterministic cleaning; canonical scholarship compatibility tables and unconfirmed joins | Structured shadow envelope; compatibility-only write, mapping proposals preserved |
| Admin/repair and migration paths | Explicit operational or schema changes | Privileged/exception paths; not ordinary ingestion |

## Common contract

`src/lib/ingestion/convergence.ts` and
`services/data-ingestion/src/glowbal_ingestion/convergence.py` emit source
metadata, a reference to retained raw/structured evidence, staged assertions,
identity hints, provenance limitations, and a mandatory Slice C handoff. The
envelope explicitly disallows canonical writes. Structured inputs are parsed
deterministically; they do not require an LLM.

Legacy assertions retain the job ID, URL, parser version, parsed field,
original value and adaptation time. Since the legacy parser did not retain a
durable raw document, the adapter marks `RAW_EVIDENCE_NOT_RETAINED` rather than
inventing a document. Python envelopes link existing raw document IDs when
available.

## Jobs, guards and audit

The programme job type recognizes acquisition-intent, policy, attempt
fingerprint, failure-class and quality-evaluation references. The additive SQL
adds nullable columns for those references without changing existing queue
behavior. The direct-write guard blocks ordinary manual, CSV and scholarship
writes; legacy scholarship and application behavior is explicitly
compatibility-only, while migration/admin/curator paths remain distinguishable.
The additive tables store source/assertion metadata, curator decisions,
differential reports, write audit, and no raw bodies.

## Scholarships

Scholarship identity resolves strong provider/scheme identifiers first and
requires review when only ambiguous name data exists. University mappings carry
method, evidence, state and review flags; fuzzy/name candidates are proposals,
not confirmed relationships. Cycle recurrence is represented as
`EXPIRED_BUT_RECURRING` and remains inferred/advisory, never verified `ACTIVE`.
Existing scholarship tables and API behavior remain compatibility-only during
the shadow period.

## Legacy exit criteria

Removal is deferred until field and identity parity, application compatibility,
retry/failure parity, critical-field precision, acceptable performance, and an
operational fallback are benchmarked with zero P0/P1 parity failures. Slice F
owns that benchmark and production cutover decision.

## Verification record

Final status: **SLICE E — PASS** in shadow mode. `$env:PYTHONPATH='src';
python -m pytest` completed with **285 passed**; compileall, base/strict
TypeScript, 51 focused Node tests, and `git diff --check` passed. The full
Node suite measured 3467 passed, 2 todo, and two unrelated CV-route timeout
failures. The production build compiled but static generation was blocked by
missing Supabase environment variables. OpenCode initial and targeted
re-review were P0/P1 PASS. The migration is intentionally unapplied; Node 24,
live schema verification, and production cutover remain deferred.
