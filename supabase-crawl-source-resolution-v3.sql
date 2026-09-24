-- Phase 3B Slice B: additive source-resolution audit metadata only.
-- Assumption: supabase-crawl-acquisition-v3.sql has been applied first.  This
-- migration deliberately stores no raw bodies, promotion rules, or canonical
-- catalogue fields. Apply through the project's normal Supabase migration path.

create table if not exists public.crawl_source_admission_decisions_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  admission_decision_id uuid not null,
  acquisition_intent_id uuid,
  source_candidate_id uuid,
  admitted boolean not null,
  reason text not null,
  authority_score integer not null default 0,
  relationship_score integer not null default 0,
  temporal_score integer not null default 0,
  relevance_score integer not null default 0,
  applicability_score integer not null default 0,
  total_score integer not null,
  allowed_domain text,
  decided_at timestamptz not null default now(),
  primary key (run_id, admission_decision_id),
  foreign key (run_id, acquisition_intent_id)
    references public.crawl_acquisition_intents(run_id, intent_id) on delete restrict,
  foreign key (run_id, source_candidate_id)
    references public.crawl_source_candidates(run_id, candidate_id) on delete restrict
);

create index if not exists crawl_source_admission_decisions_v3_intent_idx
  on public.crawl_source_admission_decisions_v3(run_id, acquisition_intent_id, decided_at desc);
create index if not exists crawl_source_admission_decisions_v3_candidate_idx
  on public.crawl_source_admission_decisions_v3(run_id, source_candidate_id, decided_at desc);

create table if not exists public.crawl_source_discovery_evidence_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  discovery_evidence_id uuid not null,
  source_candidate_id uuid not null,
  discovery_method text not null,
  evidence_summary text,
  source_locator text,
  created_at timestamptz not null default now(),
  primary key (run_id, discovery_evidence_id),
  foreign key (run_id, source_candidate_id)
    references public.crawl_source_candidates(run_id, candidate_id) on delete restrict
);

create index if not exists crawl_source_discovery_evidence_v3_candidate_idx
  on public.crawl_source_discovery_evidence_v3(run_id, source_candidate_id, created_at desc);

-- Existing crawl_acquisition_attempts_v3 is the attempt ledger. Its
-- raw_document_id remains a reference only and cannot store raw payload data.
