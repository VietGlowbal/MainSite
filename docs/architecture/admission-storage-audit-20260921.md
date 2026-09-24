# Admission collection and Drive/Mongo audit — 2026-09-21

Latest execution update (2026-09-22): `stage1-coverage-20260922T135149Z-drive`
completed with the automatic non-`atlas-sql` MongoDB driver selection. It made
347 network calls and 71 cache hits, persisted 332 raw responses (75,145,268
bytes), added 8 deterministic official-admission assertions, made 0 paid LLM
calls and 0 Supabase writes. Provider raw persistence included 135 official
admission pages, 59 official university pages, 66 Discover Uni, 56 DUO RIO, 1
Onisep, 9 Studyinfo and 6 Susa-navet responses. The replay processed 230 frozen
verified programmes; the ultra output contains 230 rows and 9,204 populated
canonical cells, but the four-component admission package remains
`COMPLETE=0`, `PARTIAL=2`, `UNKNOWN=228`. Only the two Edinburgh rows have
direct package evidence; certificate values are review/advisory and transcript
coverage remains empty.

The run manifest is stored on the mounted Drive raw object and lists 24 derived
artifacts. All 24 artifact hashes read back as `VERIFIED`; cloud sync is still
`UNKNOWN` because mounted readback does not prove cloud durability. The
read-only storage audit written after the run reported `llm_calls=0`,
`crawl_requests=0`, `remote_writes=0`, zero checked hash failures, and retained
Mongo/Drive body coverage. This supersedes the earlier failed TLS retries and
the 2026-09-22T055104Z run as the latest measured acquisition.

Legacy-schema comparison: the Drive export contains 400 historical package rows
and 1,600 requirement rows. The current run has 230 package rows and 920
four-component requirement objects, so row counts are not directly comparable.
All four logical package fields are present, but the current JSONL does not
include legacy package metadata (`run_id`, `official_url`, `retrieved_at`,
`precheck`, `payload`) or the web projection fields
(`display_mode`, `use_for_eligibility`, `source_run_id`, `source_programme_id`,
`source_retrieved_at`, `updated_at`, `course_id`). The `sop_or_essay` export
field also needs the `sop_essay_requirements` compatibility alias. This is an
offline projection gap, not a reason to recrawl.

That projection was completed offline as
`stage1-package-compat-fix-20260922T143314Z-drive`. The archive contains the
three compatibility files, with 230 package rows and 920 requirement rows;
Drive/Mongo indexed 73 derived artifacts and verified all 73 mounted readbacks.
No network, LLM or Supabase operation was used. `course_id` is intentionally
blank pending a trusted mapping to the generated web-catalogue course ID;
`source_programme_id` and the source run metadata are populated.

Follow-up 2026-09-22: the code now stages CSV data **and metadata manifests on
Drive**, without constructing a Supabase client in Drive mode. The staging
dependency described below is historical and superseded by this change.
See [artifact archive](../data-platform-artifacts.md) for current behavior.

The original document below is a read-only 2026-09-21 inventory. A controlled
follow-up run on 2026-09-22 used the frozen 230-programme population and the
deterministic provider logic: run
`stage1-coverage-20260922T041448Z-drive` made 199 network calls, persisted 197
non-empty responses (50,306,419 bytes) as Mongo `source_snapshots` plus Drive
objects, then ran the no-network MAX_FILL and ultra advisory steps. It made
zero LLM calls and zero Supabase writes. Twenty-three touched derived outputs
and one run manifest are indexed in Mongo `stage1_derived_artifacts`; Drive
readback verified all 24 hashes, while cloud sync remains unknown. This run is
an execution update, not a rewrite of the historical counts below.

A fresh deterministic recrawl then completed as
`stage1-coverage-20260922T055104Z-drive` with the same 199 network calls and 6
cache hits. It persisted 197 non-empty responses (50,154,013 bytes), added no
new assertions, made zero LLM calls and zero Supabase writes, and verified
24/24 Drive artifact hashes. The admission-package result remained
`COMPLETE=0`, `PARTIAL=2`, `UNKNOWN=228`; the recrawl therefore did not supply
direct certificate/transcript evidence for the frozen population.

The next targeted-admission implementation added deterministic HTML/PDF
parsing and programme-identity gating, but run
`stage1-coverage-20260922T073256Z-drive` could not begin persistence because
Mongo Atlas rejected the TLS handshake (`ReplicaSetNoPrimary`). It produced no
derived result and made no LLM or Supabase write; the prior successful run is
still the authoritative measured result until Mongo connectivity is restored.

Retry `stage1-coverage-20260922T075900Z-drive` reproduced the same TLS
handshake failure during Mongo raw index setup and produced no new artifacts.

An explicit retry with the worktree dotenv as
`stage1-coverage-20260922T081301Z-drive` reached the `atlas-sql` host and also
failed before persistence; that endpoint is not a MongoDB driver endpoint.

The Drive runner now auto-selects a non-`atlas-sql` driver URI. Run
`stage1-coverage-20260922T083322Z-drive` selected the standard `cluster0`
environment but still failed the Atlas TLS handshake during raw index setup.

Schema repair follow-up: the offline replay added top-level
`graduation_certificate` and `academic_transcript` columns to the strict,
MAX_FILL and ultra exports, split explicit document components from structured
`required_documents` assertions, and wrote a web-shaped
`stage1-programme-admission-packages.jsonl`. The archive-only run
`stage1-package-schema-fix-20260922T050353Z-drive` indexed 41 updated derived
artifacts in Mongo and verified their Drive readback. Package status is
`COMPLETE=0`, `PARTIAL=2`, `UNKNOWN=228`; certificate/transcript assertions
with `NEEDS_REVIEW` provenance remain advisory. No crawl, LLM call or Supabase
write occurred during this repair.

Scope of the original snapshot: retained evidence, offline processing and
admission export for the frozen 230 verified Stage 1 programmes. Historical
LLM outputs were inspected, not rerun.

## Decision

The snapshot decision was to avoid a blanket recrawl: original Stage 1 raw
evidence was retained and hash-verifiable, so archive/index repair and a
bounded deterministic replay were preferred. The follow-up run applied that
bounded provider acquisition and replayed the frozen population; it did not
claim that every admission field was recovered.

At the snapshot time, collection was **not yet exclusively Drive + Mongo**:
small raw bodies could live inline in Mongo; heavy bodies lived on Drive;
structured staging metadata still used Supabase; and run-derived assertions,
packages, traces and exports still used local files. The follow-up now archives
the run's raw responses and derived outputs on Drive with Mongo lineage and
keeps Supabase out of the selected run. Older local captures and legacy
locators remain separate migration work.

## Measured storage inventory

Reads used the configured Mongo database from the existing main-worktree
environment and the discovered mounted Drive archive. Counts describe this
audit snapshot. Credentials and physical archive paths are omitted.

| Check | Result |
| --- | --- |
| Mongo collections enumerated | `raw_blobs`: 299; `source_snapshots`: 1,111; no derived-package collection |
| Mongo inline bodies | 226; all SHA-256 checks passed |
| Mongo object-store blobs | 73; all have hash-matching Drive copies |
| Drive `raw/objects` | 78 files, 56,935,988 bytes; all filename SHA-256 checks passed |
| Legacy Mongo object locators | 65 blobs still use legacy keys despite Drive copies |
| Original `stage1-20260915-main` | 342 snapshots, 107 unique raw hashes: 71 verified inline, 36 verified on Drive; 0 missing verified bodies |
| Historical relational export on Drive | All 12 table files matched their manifest hashes |
| Historical admission export on Drive | 400 packages / 1,600 requirements; 0 exact programme-ID or official-URL matches with the current 230 targets |
| Local original run artifacts | 39 top-level files, 147,804,420 bytes; its package JSONL hash is absent from the Drive raw inventory |

The separate migration manifest records 230 historical object entries / 66
unique hashes, all locally verified and `AWAITING_SYNC_CONFIRMATION`. Mounted
readback does not establish cloud sync; cloud durability remains unknown.

The Drive reader delegates `raw/sha256/...` keys to its legacy adapter; it does
not look for an equal hash under `raw/objects/...`. Repair the 65 stale blob
locators and corresponding snapshot references with a hash-preserving mapping
or resolver. Copying bytes alone did not remove the legacy read dependency.
Those bodies need no source refetch.

## Later captures are not durably registered

`_existing_url_fetch_inventory.json` has 132 attempts:

- 107 successful entries / 103 unique hashes; none of those hashes are in
  Mongo raw blobs or Drive `raw/objects`.
- 61 unique raw hashes reconstruct exactly from retained text using tested
  encodings: 59 UTF-8 and 2 Latin-1. Archive/index these without refetching.
- The other 43 successful entries / 42 unique hashes **all retain exactly
  200,000 characters** and do not reconstruct the original raw hash. This
  includes a PDF decoded as text with replacement characters. Preserve these
  as partial captures, not complete raw payloads.
- 25 failed entries: 9 HTTP 404, 9 HTTP 403, 7 status 0.
- 16 successful captures have fewer than 300 visible characters after removing
  scripts/styles/navigation. Review for application shells, wrong pages or
  unavailable content before choosing rendering/API acquisition.

No `discover-official-cache.json` or `discover-cache-diagnostic.json` was found
at the roots of this worktree or main. This does not rule out other archives.
If no full copy exists elsewhere, recapturing a truncated source produces a
**new observation**, not restoration of its historical bytes.

The separate `_official_url_fetch_inventory.json` has 230 status-0 entries and
no bodies. That failed probe does not invalidate the 107 retained original raw
hashes or justify blindly retrying all provider URLs.

## Admission recovery and parser findings

The original package JSONL covers **175/230 current target IDs**. The 55 absent
targets are UK 14, NL 40, FR 1. Regenerate packages against the current population
and later evidence; missing package rows do not prove missing raw bodies.

The original effective assertions contain one top-level certificate and one
top-level transcript assertion, both `NEEDS_REVIEW`. The earlier claim that no
transcript assertion existed anywhere was too broad:

- UEF Data Engineering (`67ef7389-04ec-5e55-94cc-49456ef74cb3`): hash-verified
  Studyinfo JSON really requires officially certified degree-certificate copies
  after acceptance. Re-derive from raw without LLM. The old assertion carries
  `VALUE_SUPPORT_UNRESOLVED`; do not silently mark it verified.
- Aalto (`c695f7f2-0ce1-5caa-9600-cf5fc759a332`): “previous academic record” was
  captured as a transcript excerpt. That is a selection criterion, not evidence
  of a document-submission requirement. Keep unknown/review and repair the rule.
- Haaga-Helia (`8606b6c5-bf41-54d1-87f7-95596c5d82cc`): retained `hakukohde`
  evidence mentions a high-school diploma, transcript of study records and an
  official translation under stated language conditions. Recover the complete
  condition, not a universal requirement. The existing transcript rule misses
  this wording.
- Manchester's two candidate URLs remain Computer Science variants; verify
  their programme binding before applying reference or personal-statement data.

An isolated offline probe of production excerpt rules produced 14 candidates
across 9 programmes / 11 unique programme-field pairs. These are **not verified
requirements**: examples include the Aalto false positive and Bristol entry
qualifications mentioning diplomas. The probe constructs no pipeline/provider;
its provisional page type and URL association are not proof of applicability.

The ultra CSV now has dedicated certificate/transcript columns and explicit
package-status counters. The JSONL package projection carries per-requirement
value, evidence status, fill method, source URL, provider and provenance; it
does not upgrade `NEEDS_REVIEW` assertions to verified requirements.

## Required work and reruns

| Operation | Decision | New crawl / LLM |
| --- | --- | --- |
| Repair legacy raw locators | Required; bytes already exist | Neither |
| Archive/index local captures and derived artifacts on Drive/Mongo | Required; preserve partial flags | Neither |
| Fix deterministic admission parser and package/export retention | Required before replay | Neither |
| Replay all 230 targets against retained evidence | Required after fixes; preserve unknowns and identity gates | Neither |
| Obtain full bodies for 43 truncated entries / 42 hashes | Recapture if no full archive copy exists and complete raw retention is required | Targeted download only |
| Resolve 9 dead URLs | Find correct official replacements if source still needed | Targeted acquisition |
| Review 9 blocked URLs | Use permitted official alternatives/normal supported acquisition | Targeted acquisition; no access-control bypass |
| Recheck 7 status-0 URLs | Bounded retries after source review | Targeted acquisition |
| Acquire missing admissions/checklist pages | After offline replay and source resolution | Targeted acquisition |
| Rerun ultra/default fill or full LLM ingestion | Do not run | Not needed |

Queues count captures/URLs, not programmes. Some pages serve several targets,
are irrelevant after identity review, or have retained alternatives. The exact
number of programmes needing **new admissions-page acquisition** is not yet
established; keyword absence alone cannot determine it.

## No-LLM and runtime configuration

The inspected environment has a DeepSeek key. An empty `EXTRACTION_PROVIDER`
can auto-enable it. An isolated factory check confirmed explicit
`EXTRACTION_PROVIDER=none` returns `UnavailableExtractionProvider` on this
revision without a provider call. Omit provider keys from future collection-only
processes as well. Prefer a bounded acquisition/offline-parser entry point;
this factory check does not certify full ingestion as a successful no-LLM run.

Both Drive configuration variables are absent from the inspected `.env.local`
process, despite the mounted archive and recent Drive-tagged Mongo snapshots.
This is not a claim about every live worker. Set the explicit Drive backend,
existing archive root and intended remote evidence mode for future runs.

## Artifacts and verification

Read-only script: `scripts/audit_stage1_admission_storage.py`, arguments
`--env-file <secret-file> --archive-root <mounted-archive> --output <report-dir>`.
It reads Mongo and files; only local reports are written. It does not instantiate
the raw-store adapter, which would perform write probes/index setup.

Generated reports are in the existing git-ignored local artifact area,
`docs/architecture/data/admission-storage-audit-20260921/`:

- `storage-admission-audit.json`: inventory, hashes, coverage and probe counts.
- `programme-triage.json`: all 230 targets and preliminary source/field gaps.
- `offline-excerpt-candidates.json`: unvalidated probe excerpts.
- `source-recovery-queue.json`: 25 failed URLs.
- `full-body-recapture-queue.json`: 43 truncated entries.

Measured validation for the original snapshot: 78 Drive raw objects, 226 inline
Mongo bodies and 12 historical table exports passed SHA-256 verification. The
2026-09-22 follow-up additionally verified 197 new run snapshots and 24/24
derived Drive artifacts by SHA-256. No blanket migration was applied, and the
ultra CSV remains advisory because it still has no dedicated certificate or
transcript fields.
