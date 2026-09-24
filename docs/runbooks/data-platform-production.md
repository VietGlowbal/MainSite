# Data platform production runbook

This runbook describes controlled non-production validation and a future
limited rollout. It contains no credentials. Phase 3F did not authorize
production rollout.

## Required configuration

Keep these values in the deployment secret store or an ignored `.env.local`;
never commit or print them:

- `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` for client-read checks
- `SUPABASE_SERVICE_ROLE_KEY` for server-only jobs and migrations
- `MONGODB_URI`
- `MONGODB_DATABASE`
- `DATA_PLATFORM_ARTIFACT_BACKEND=google_drive_desktop` for new heavy Data
  Platform artifacts. This value is required: unset, blank, and `None` are
  configuration errors, not requests to use a legacy backend.
- `DATA_PLATFORM_ARCHIVE_ROOT` for the existing Google Drive for desktop
  mount (runtime-only; never store a drive letter in metadata)
- `DATA_PLATFORM_ARTIFACT_RUN_BUDGET_BYTES` as an optional per-run cap
- `RAW_OBJECT_STORAGE_BUCKET` or `RAW_OBJECT_STORE_BUCKET` only for legacy
  compatibility reads/migrations; neither is a new-write fallback when Drive
  is selected. Select `legacy_supabase_storage` or `legacy_s3` explicitly
  only for a controlled compatibility or migration operation.
- provider credentials only for the selected extraction/search adapters

Use a separately named non-production Supabase project and Mongo database.
Confirm the target project identity before every schema or storage operation.

## Migration order

Run and verify only in the isolated non-production project, in dependency order:

1. `supabase-crawl-acquisition-v3.sql`
2. `supabase-crawl-source-resolution-v3.sql`
3. `supabase-evidence-quality-v3.sql`
4. `supabase-identity-promotion-v3.sql`
5. `supabase-ingestion-convergence-v3.sql`

Before and after each migration, enumerate the live schema, columns, indexes,
foreign keys, RPCs, views, and RLS policies. All five files are additive. Do
not edit an applied migration, apply these files to production, or treat a
successful file parse as schema verification.

## Worker and evidence flow

1. Before starting the bounded worker, verify that the configured Drive root,
   `raw`, and `raw/objects` already exist and are accessible. Startup creates
   and probes its private staging/lock directories beneath that verified root.
   Any root or access failure is retryable/configuration-invalid; do not unset
   the backend or fall back to Supabase/S3.
2. Start the bounded worker with the intended non-production configuration.
3. Claim jobs using the existing job-claim mechanism; record run, intent,
   attempt, policy, and failure class.
4. Persist remote raw evidence before accepting extraction as durable truth.
   Mongo owns bounded metadata/provenance and the configured Drive artifact
   store owns heavy bytes (HTML, JSON, PDF, ZIP, CSV, and provider output).
   Legacy Supabase/S3 locators remain readable only during transition.
5. Reprocess from retained raw evidence when testing parsers or policies; do
   not refetch solely for reprocessing.
6. Evaluate coverage, recovery, conflicts, identity, and Product Safety.
7. Use promotion-v3 dry-run first. Apply only an eligible, reviewed candidate.
8. Preserve immutable audit and projection history. Corrections are forward
   projections, not history deletion.

## Representative ingestion evidence

For a small non-production ingestion, record `raw-evidence-dev` object count
and bytes immediately before and after the run. The expected heavy-artifact
delta is zero; database metadata may change. Record the source/provider input,
logical locator, physical Drive path, SHA-256, and metadata/provenance result.
Then construct a fresh reader using only the metadata, logical locator, and
`DATA_PLATFORM_ARCHIVE_ROOT`, and verify its SHA-256. Record local mounted
readback separately from cloud sync: Drive Desktop local verification does not
confirm cloud durability, which requires operator confirmation.

## Monitoring

Alert on raw persistence failures, retry exhaustion, identity review/unresolved
counts, critical quality blocks, conflicts, inferred high-volatility values,
promotion blocks, legacy-v3 disagreements, scholarship mapping proposals, and
job age/stale workers. A promotion block is a semantic outcome, not an
infrastructure outage.

## Manual review and rollout stop conditions

Review identity ambiguity, material conflicts, missing lineage, stale critical
fields, and every proposed scholarship/university mapping. Stop the run for any
false-current critical value, fuzzy-only merge, broken lineage, duplicate
canonical projection, unsafe redirect/source admission, secret exposure, or
partial promotion after a database failure.

## Fallback

Disable promotion-v3 application while preserving dry-run and evidence capture.
Stop new workers, allow in-flight jobs to settle or mark them retryable, and
retain raw evidence and audit rows. Use an explicitly selected legacy backend
only where its compatibility status is approved; never obtain it by unsetting
the backend. Do not roll back by deleting audit, evidence, identity, or
historical projection records.
