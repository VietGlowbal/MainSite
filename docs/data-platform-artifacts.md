# Data Platform artifact archive

The ingestion service retains large immutable raw evidence at its existing
Mongo raw-evidence boundary. MongoDB continues to own snapshot, observation,
provenance, and content-hash metadata; the archive owns only body bytes.

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
structured archive rows are serialized as deterministic UTF-8 CSV artifacts
and the Supabase staging row retains only counts, lineage, and the Drive
locator/hash/size in its bounded JSON metadata; it does not retain the row
array. JSONL/CSV run traces remain local control-plane reports rather than
durable raw artifacts.

CSV null semantics are documented and stable: `None` is emitted as an empty
field, while an input empty string is also an empty field; callers that need to
distinguish those values must carry an explicit companion flag in the row.
