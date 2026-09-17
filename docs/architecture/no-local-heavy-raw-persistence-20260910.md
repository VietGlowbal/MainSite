# No-local heavy raw persistence — implementation

## Scope

This change adds the durable streaming path for large external raw resources.
No provider validation, live fetch, LLM extraction, estimator, topology run,
promotion, Benchmark V3 run, commit, or push was performed.

## Previous path

`SafeFetcher.fetch` returned a complete `bytes` body. The pipeline built a
`RawSnapshotInput`, wrote the payload to the local run directory (or passed the
same bytes to the remote store), and the ZIP parser opened an in-memory
`BytesIO`. The Scorecard ZIP therefore retained a complete local archive before
the bounded CSV-member parser ran. Structured members were emitted only to the
run JSONL artifact.

## Implemented path

Large configured resources now use `SafeFetcher.fetch_stream`, which enforces
the existing response limit while yielding bounded chunks. Mongo raw evidence
accepts `RawSnapshotStreamInput` and sends chunks directly to the configured
S3-compatible or Supabase Storage object store. The object-store layer computes
SHA-256 and byte length incrementally and records provider/dataset/run metadata
without a local payload copy.

ZIP parsing uses a bounded range reader over the durable object. The central
directory and selected CSV member are read through object-store ranges; the
large CSV is still row- and byte-bounded by the existing structured-member
limits. Unselected archive members are represented by metadata only and are
not decompressed. The immutable ZIP remains the raw source. No extracted CSV
file is created locally.

Bounded structured archive rows retain raw document, object key, ZIP hash,
member, provider, dataset, cycle, run, row-count, partial, and bounded-reason
lineage. An additive `crawl_external_structured_rows` staging table and REST
writer make those rows durable in Supabase Postgres when Supabase is configured;
the JSONL stream remains a run/debug artifact and import source for previously
materialised runs. Heavy streaming runs require the durable sink before success.

`CrawlLimits` now exposes `large_raw_object_threshold_bytes` (8 MiB default) and
`max_local_temp_bytes` (0 by default). There is no silent local fallback for a
heavy stream: a durable stream-capable raw store and bounded seekable read path
are required. The byte-oriented path now raises `RESPONSE_REQUIRES_STREAMING`
when a response crosses the threshold, preventing unbounded buffering.

## Deterministic verification

`test_heavy_raw_streaming.py` covers incremental hashing, bounded S3/Supabase
uploads, remote range reads, selected-member ZIP parsing (including skipping
unselected members), UNITID-compatible structured rows, Mongo raw
metadata/lineage, local-heavy rejection, staging mapping, and import artifact
mapping. It passed 12/12 after the final additions. The focused raw,
source-adapter, Supabase Storage, external-acquisition, source-ecosystem,
worker, acquisition, convergence, and extraction-provider suites passed
124/124 together; compileall passed. No live network or production
database write was used for these checks.
