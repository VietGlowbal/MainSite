-- Hipo/Hipolabs university discovery fields and crawl-seed review gate.
-- Safe to run repeatedly in the Supabase SQL editor.

do $$
begin
  alter table public.universities add column if not exists primary_domain text;
  alter table public.universities add column if not exists source text not null default 'curated';
  alter table public.universities add column if not exists country_code text;
  alter table public.universities add column if not exists official_url text;
  alter table public.universities add column if not exists domain_candidates text[] not null default '{}';
  alter table public.universities add column if not exists official_web_pages text[] not null default '{}';
  alter table public.universities add column if not exists domain_source text;
  alter table public.universities add column if not exists domain_review_status text not null default 'pending';
  alter table public.universities add column if not exists crawl_seed_enabled boolean not null default false;
  alter table public.universities add column if not exists domain_discovered_at timestamptz;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'universities_domain_review_status_check'
      and conrelid = 'public.universities'::regclass
  ) then
    alter table public.universities
      add constraint universities_domain_review_status_check
      check (domain_review_status in ('pending', 'approved', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'universities_country_code_check'
      and conrelid = 'public.universities'::regclass
  ) then
    alter table public.universities
      add constraint universities_country_code_check
      check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

create index if not exists idx_universities_primary_domain
  on public.universities (lower(primary_domain))
  where primary_domain is not null;

create index if not exists idx_universities_crawl_seed_review
  on public.universities (domain_review_status, crawl_seed_enabled)
  where primary_domain is not null;

-- Review queue:
-- select id, name, country, country_code, primary_domain, official_url,
--        domain_candidates, official_web_pages
-- from public.universities
-- where domain_review_status = 'pending'
-- order by domain_discovered_at desc nulls last;
--
-- Approve one verified official domain:
-- update public.universities
-- set domain_review_status = 'approved', crawl_seed_enabled = true
-- where id = <reviewed_university_id>;
