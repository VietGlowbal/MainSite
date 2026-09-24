-- Additive staging metadata for configured external-source acquisition.
-- Raw bodies remain in the existing MongoDB/object-storage boundary.  This
-- migration only makes provider/source lineage available to the verified
-- crawl staging tables and audit queries; it does not alter canonical
-- promotion or exact-evidence rules.
--
-- The live project exposes crawl_sources and crawl_field_assertions, but does
-- not expose the optional v3 source-graph tables. Those tables belong to a
-- separate, optional acquisition-graph migration and must not be a
-- prerequisite for this external-source provenance migration.

begin;

alter table public.crawl_sources
  add column if not exists raw_document_id text;
alter table public.crawl_sources
  add column if not exists parser_id text;
alter table public.crawl_sources
  add column if not exists parser_version text;
alter table public.crawl_sources
  add column if not exists source_class text;
alter table public.crawl_sources
  add column if not exists adapter_id text;
alter table public.crawl_sources
  add column if not exists provider_id text;
alter table public.crawl_sources
  add column if not exists dataset_id text;
alter table public.crawl_sources
  add column if not exists academic_cycle text;
alter table public.crawl_sources
  add column if not exists source_resolution text;
alter table public.crawl_sources
  add column if not exists original_url text;
alter table public.crawl_sources
  add column if not exists capture_url text;
alter table public.crawl_sources
  add column if not exists captured_at timestamptz;
alter table public.crawl_sources
  add column if not exists archive_provider text;
alter table public.crawl_sources
  add column if not exists temporal_state text;

-- Semantic extraction assertions use the same staging rail.  Keep dataset and
-- acquisition-run lineage alongside the existing provider/temporal fields so
-- an observed assertion can be traced to the immutable raw source without
-- changing canonical promotion semantics.
alter table public.crawl_field_assertions
  add column if not exists provider_id text;
alter table public.crawl_field_assertions
  add column if not exists source_authority text;
alter table public.crawl_field_assertions
  add column if not exists source_relationship text;
alter table public.crawl_field_assertions
  add column if not exists epistemic_state text not null default 'OBSERVED';
alter table public.crawl_field_assertions
  add column if not exists temporal_state text not null default 'UNKNOWN';
alter table public.crawl_field_assertions
  add column if not exists raw_document_id text;
alter table public.crawl_field_assertions
  add column if not exists dataset_id text;
alter table public.crawl_field_assertions
  add column if not exists acquisition_run_id text;

create index if not exists idx_crawl_field_assertions_external_lineage
  on public.crawl_field_assertions(run_id, provider_id, dataset_id, acquisition_run_id)
  where provider_id is not null or dataset_id is not null or acquisition_run_id is not null;

create index if not exists idx_crawl_sources_external_provider
  on public.crawl_sources(run_id, source_class, provider_id)
  where source_class is not null;

comment on column public.crawl_sources.source_class is
  'Configured source ecosystem class; staging provenance only.';
comment on column public.crawl_sources.provider_id is
  'Opaque external provider identity; never a promotion decision.';
comment on column public.crawl_sources.dataset_id is
  'External dataset/resource identity when supplied by the provider.';
comment on column public.crawl_field_assertions.dataset_id is
  'External dataset/resource identity for the observed assertion source.';
comment on column public.crawl_field_assertions.acquisition_run_id is
  'Acquisition run that produced the raw source for the observed assertion.';

commit;
