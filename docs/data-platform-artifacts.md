# Data Platform artifact archive

The ingestion service retains large immutable raw evidence at its existing
Mongo raw-evidence boundary. MongoDB continues to own snapshot, observation,
provenance, and content-hash metadata; the archive owns only body bytes.

Small non-streamed raw bodies can also remain inline in MongoDB below the
configured threshold. Selecting Drive does not migrate historical locators or
archive every local run report automatically. With Drive selected, structured
staging now stores both CSV data and JSON manifests on Drive, without a
Supabase client. Other run reports are still local, so complete collection-only
Drive/Mongo persistence is not implied by this change.
The [2026-09-21 admission/storage audit](architecture/admission-storage-audit-20260921.md)
records the measured inventory, remaining storage work and no-LLM rerun order.

For the frozen Stage 1 population, `scripts/run_stage1_drive_ultra_fill.py`
wraps the deterministic provider acquisition with the same Mongo/Drive raw
boundary, then runs MAX_FILL and ultra offline and archives the touched CSV,
JSONL and JSON outputs plus a run manifest. Mongo keeps bounded lineage in
`stage1_derived_artifacts`; the manifest and all bytes remain content-addressed
on Drive. The 2026-09-22 run made 199 network calls, retained 197 non-empty
responses, and made no LLM or Supabase call.

The repaired no-network follow-up is
`scripts/replay_stage1_drive_ultra_fill.py`; it adds the two admission-package
document columns, prevents generic donor/default filling for certificate and
transcript, and emits `stage1-programme-admission-packages.jsonl`. Use
`scripts/archive_stage1_replay_outputs.py` to archive an already-generated
replay without rerunning acquisition. Run
`stage1-package-schema-fix-20260922T050353Z-drive` archived 41 updated
artifacts with Mongo lineage, zero network calls, zero LLM calls and zero
Supabase writes.

## Google Drive for desktop

Set these values in the ingestion process environment (never commit a real
machine path or credentials):

```text
DATA_PLATFORM_ARTIFACT_BACKEND=google_drive_desktop
DATA_PLATFORM_ARCHIVE_ROOT=<existing Google Drive for desktop directory>
DATA_PLATFORM_ARTIFACT_RUN_BUDGET_BYTES=<optional non-negative byte count>
```

The configured root must already exist and contain the existing
`raw/objects` archive path. Startup verifies the root, `raw`, and
`raw/objects` are readable and writable; it then creates and probes its
private `.artifact-staging` and `.artifact-locks` work directories under that
verified root. All checks use a tiny write/read/remove probe; failure is
configuration-invalid and prevents a remote or dual raw-evidence run from
starting. A successfully written file has local state `PRESENT`, readback
state `VERIFIED`, and cloud-sync state `UNKNOWN`: Google Drive for desktop
performs syncing outside this process, so local readback is never presented as
cloud confirmation.

New objects use portable logical locators, never a drive letter:

```text
raw/objects/<first-two-sha256-characters>/<sha256>.<extension>
```

Writes are SHA-256-addressed, atomic, read back and checked before the caller
receives success. Equal bytes deduplicate while each Mongo snapshot keeps its
own raw-document observation and provenance. The optional per-run budget counts
only new retained bytes; exceeding it leaves no final archive object and stops
the raw persistence operation safely. Budgeted stream staging is serialized so
concurrent workers cannot each consume the same remaining allowance, and
same-hash MIME/extension differences reuse the already-canonical physical file.
An OS-backed per-hash lock under the archive's hidden `.artifact-locks`
directory also protects separate worker processes sharing one mounted root.

## Compatibility and scope

Every heavy Data Platform write requires an explicit
`DATA_PLATFORM_ARTIFACT_BACKEND`; unset, blank, and `None` fail closed rather
than selecting S3, Supabase Storage, local, or raw-evidence storage. The only
supported active heavy-write backend is `google_drive_desktop`. When it is
selected and existing Supabase Storage settings are also present, pre-existing
`raw/sha256/...` locators remain read-compatible. That adapter is passed only
to read paths; new Drive byte writes and streams never fall back to Supabase.
`legacy_supabase_storage` and `legacy_s3` are available only when explicitly
selected for controlled compatibility or migration; they are never automatic
fallbacks. Every public raw/staging injection boundary requires the exact
preflighted Drive adapter (not a spoofable backend-name string), and a
Drive-selected staging writer must use the shared archive instance so
deduplication and the run budget cannot be bypassed.

The audit boundary is `raw_evidence.py` → `MongoRawEvidenceStore` →
`ObjectStore`: raw evidence, source/provider acquisition, Stage 1 raw fetches,
and parser re-reads all pass through it. With Drive selected, extracted
structured archive rows are serialized as deterministic UTF-8 CSV artifacts.
`DriveStructuredStagingStore` writes the former staging metadata (run, raw
document, provider, programme, counts, partial flags, lineage and CSV
locator/hash/size) into an immutable JSON manifest in the same archive.
Both CSV and manifest objects use the shared archive's deduplication and run
budget. Small rebuildable index pointers under
`structured-staging/<sha256(run-id)>/<manifest-sha256>.json` are atomically
written and read back; their filesystem overhead is outside the object-byte
budget, like the archive's lock files. Run IDs never become path segments.
`iter_records(run_id)` on a fresh staging writer resolves the index and verifies
manifest hashes through the archive reader. Repeated identical observations
deduplicate; changed observations retain history. CSV or manifest/index failure
raises rather than reporting staging success. An interrupted write can leave
an unindexed immutable object; a retry repairs the index without refetching.

`EXTERNAL_STRUCTURED_STAGING_ENABLED=auto` selects this Drive writer whenever
the Drive backend is selected, even without Supabase configuration. `0`
explicitly disables staging. Drive mode rejects a Supabase writer, including
injected writers; credentials do not alter this selection. The Supabase staging
adapter is available only with an explicitly selected legacy backend. This
change does not migrate existing database rows or change independent catalogue
import/promotion commands. JSONL/CSV run traces outside this staging boundary
remain local control-plane reports rather than durable raw artifacts.

CSV null semantics are documented and stable: `None` is emitted as an empty
field, while an input empty string is also an empty field; callers that need to
distinguish those values must carry an explicit companion flag in the row.
