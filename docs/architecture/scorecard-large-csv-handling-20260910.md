# College Scorecard bulk large CSV handling

Date: 2026-09-10

The College Scorecard bulk URL and source admission configuration were left
unchanged. The downstream `NO_YIELD` was caused by the existing ZIP parser
rejecting `Most-Recent-Cohorts-Institution.csv` at 221,187,893 bytes because the
ordinary member limit is 64 MiB.

## Implementation

- `ZipDocumentParser` now has a separate, bounded structured-member path.
- The provider explicitly selects `Most-Recent-Cohorts-Institution.csv`.
- Selected CSV/TSV members are read through `ZipExtFile` + buffered text CSV
  iteration; the member is never materialised as one byte string.
- Ordinary ZIP members retain the existing 64 MiB member and 128 MiB archive
  limits. Selected structured members are capped at 512 MiB per member and in
  aggregate, with bounded sample/row/scan limits.
- Known identifiers can filter rows early (`target_identifiers`, including
  `UNITID` through the provider's `identifier_mapping`). Without identifiers,
  Scorecard deterministically retains the first configured sample rows.
- Every bounded member result records `partial`, `rows_scanned`,
  `rows_retained`, `member_name`, and `bounded_reason`.
- The immutable ZIP remains the raw snapshot. Derived rows are written to the
  additive `structured_archive_members.jsonl` run stream with provider ID,
  dataset ID, ZIP locator/hash, member name, academic cycle, raw-document ID,
  and acquisition run ID.

## Files changed

- `services/data-ingestion/src/glowbal_ingestion/parser_registry.py`
- `services/data-ingestion/src/glowbal_ingestion/pipeline.py`
- `services/data-ingestion/src/glowbal_ingestion/config.py`
- `services/data-ingestion/src/glowbal_ingestion/external_sources.py`
- `services/data-ingestion/configs/external-providers.json`
- `services/data-ingestion/tests/test_external_acquisition.py`
- `docs/current-status.md`

## Deterministic verification

- Focused large-member and regression tests: **6/6 passed**
- External acquisition suite: **45/45 passed**
- Source/ecosystem/raw-evidence regressions: **30/30 passed**
- Core, acquisition, and worker regressions: **210/210 passed**
- `compileall`: **passed**

## Bounded live Scorecard check

One real HTTP request was made to the configured bulk URL. The response was
HTTP 200 (`application/zip`), the 221 MB CSV member was streamed, the first 100
rows were retained as an explicitly partial deterministic sample, and one
`SourceDocument` plus one `structured_archive_members` row were persisted.

The source row retained `source_class=government_dataset`,
`source_authority=GOVERNMENT`, `source_relationship=GOVERNMENT`,
`provider_id=college_scorecard_bulk`, `dataset_id=college-scorecard-bulk`,
the ZIP content hash, raw-document ID, and run ID. The member row retained the
same ZIP lineage plus `member_name=Most-Recent-Cohorts-Institution.csv`,
`rows_scanned=100`, `rows_retained=100`, `partial=true`, and
`bounded_reason=sample_rows`. No LLM, estimator, topology, assertion, or
promotion work ran.

Artifact: [scorecard-large-csv-live-recheck-20260910](data/scorecard-large-csv-live-recheck-20260910/).
