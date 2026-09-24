# Supabase staging schema repair — 2026-09-10

## Live schema audit

The Supabase REST OpenAPI schema was read with the service-role key from the
main worktree environment. The exposed crawl tables are:

* `crawl_runs`
* `crawl_sources`
* `crawl_institutions`
* `crawl_organisation_units`
* `crawl_programmes`
* `crawl_programme_organisation_units`
* `crawl_programme_offerings`
* `crawl_field_assertions`
* `crawl_admission_packages`
* `crawl_admission_requirements`
* `crawl_policy_checks`
* `crawl_url_edges`
* `crawl_errors`
* `crawl_review_items`

The live schema does not expose `crawl_external_structured_rows` or the
optional acquisition/source-graph relations. `crawl_sources` has source
metadata and a raw object path but no archive-member, bounded-row, or complete
provider/dataset lineage fields. `crawl_field_assertions` is the assertion
rail and must not receive derived external rows. A separate additive structured
row table is therefore required.

## Repair

`supabase-external-structured-staging.sql` remains a self-contained additive
table/index/RLS migration with no foreign-key or relation dependency on the
unexposed source-graph tables. It stores the run, provider, dataset,
source-class, authority, relationship, raw object/hash, archive member,
institution/programme, cycle, bounded row counts, partial flag, and JSON
lineage required by external structured resources.

`supabase-external-source-provenance.sql` now adds the external provenance
columns needed by the verified `crawl_sources` table only. References to
unverified source-graph tables were removed. The importer still exposes local
artifact translators for diagnostics, but it no longer probes or writes those
tables; external structured rows are the only additive external table import.

## Verification

The focused staging/import suite passed 263/263 tests. The external-acquisition
plus staging/regression suite passed 262/262 tests, and Python compileall and
`git diff --check` passed.

Migration application was attempted with the Supabase CLI linked-project path,
but this environment has no `SUPABASE_ACCESS_TOKEN`, Postgres connection URL,
database password, or exposed SQL RPC. The CLI returned
`Access token not provided`; the REST table check still returns 404 for
`crawl_external_structured_rows`. No schema change was applied.

The earlier bounded Scorecard run demonstrated HTTP 200, durable ZIP object
storage, Mongo raw metadata, remote-range member parsing, and zero heavy local
files. Its structured-row write returned REST 404 because the additive table
was unapplied, so a post-migration Scorecard persistence validation remains
blocked until SQL access is supplied.
