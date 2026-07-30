-- Seed 20 US institutions for the bounded 20x20 crawl.
-- Review the domains before production use. Safe to re-run:
-- existing rows are updated by exact name/domain and missing rows are inserted.

begin;

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
end $$;

with seed(name, primary_domain, official_url) as (
  values
    ('Massachusetts Institute of Technology', 'mit.edu', 'https://www.mit.edu/'),
    ('Harvard University', 'harvard.edu', 'https://www.harvard.edu/'),
    ('Stanford University', 'stanford.edu', 'https://www.stanford.edu/'),
    ('Yale University', 'yale.edu', 'https://www.yale.edu/'),
    ('Princeton University', 'princeton.edu', 'https://www.princeton.edu/'),
    ('Columbia University in the City of New York', 'columbia.edu', 'https://www.columbia.edu/'),
    ('University of Pennsylvania', 'upenn.edu', 'https://www.upenn.edu/'),
    ('Duke University', 'duke.edu', 'https://duke.edu/'),
    ('Johns Hopkins University', 'jhu.edu', 'https://www.jhu.edu/'),
    ('Northwestern University', 'northwestern.edu', 'https://www.northwestern.edu/'),
    ('University of Chicago', 'uchicago.edu', 'https://www.uchicago.edu/'),
    ('California Institute of Technology', 'caltech.edu', 'https://www.caltech.edu/'),
    ('Cornell University', 'cornell.edu', 'https://www.cornell.edu/'),
    ('University of California-Berkeley', 'berkeley.edu', 'https://www.berkeley.edu/'),
    ('University of California-Los Angeles', 'ucla.edu', 'https://www.ucla.edu/'),
    ('University of Michigan-Ann Arbor', 'umich.edu', 'https://umich.edu/'),
    ('Georgia Institute of Technology-Main Campus', 'gatech.edu', 'https://www.gatech.edu/'),
    ('Carnegie Mellon University', 'cmu.edu', 'https://www.cmu.edu/'),
    ('University of Illinois Urbana-Champaign', 'illinois.edu', 'https://illinois.edu/'),
    ('New York University', 'nyu.edu', 'https://www.nyu.edu/')
)
update public.universities u
set country = 'United States',
    country_code = 'US',
    primary_domain = s.primary_domain,
    official_url = s.official_url,
    source = 'curated',
    domain_source = 'manual_validated',
    domain_review_status = 'approved',
    crawl_seed_enabled = true,
    domain_discovered_at = coalesce(u.domain_discovered_at, now())
from seed s
where lower(coalesce(u.primary_domain, '')) = lower(s.primary_domain)
   or lower(u.name) = lower(s.name);

with seed(name, primary_domain, official_url) as (
  values
    ('Massachusetts Institute of Technology', 'mit.edu', 'https://www.mit.edu/'),
    ('Harvard University', 'harvard.edu', 'https://www.harvard.edu/'),
    ('Stanford University', 'stanford.edu', 'https://www.stanford.edu/'),
    ('Yale University', 'yale.edu', 'https://www.yale.edu/'),
    ('Princeton University', 'princeton.edu', 'https://www.princeton.edu/'),
    ('Columbia University in the City of New York', 'columbia.edu', 'https://www.columbia.edu/'),
    ('University of Pennsylvania', 'upenn.edu', 'https://www.upenn.edu/'),
    ('Duke University', 'duke.edu', 'https://duke.edu/'),
    ('Johns Hopkins University', 'jhu.edu', 'https://www.jhu.edu/'),
    ('Northwestern University', 'northwestern.edu', 'https://www.northwestern.edu/'),
    ('University of Chicago', 'uchicago.edu', 'https://www.uchicago.edu/'),
    ('California Institute of Technology', 'caltech.edu', 'https://www.caltech.edu/'),
    ('Cornell University', 'cornell.edu', 'https://www.cornell.edu/'),
    ('University of California-Berkeley', 'berkeley.edu', 'https://www.berkeley.edu/'),
    ('University of California-Los Angeles', 'ucla.edu', 'https://www.ucla.edu/'),
    ('University of Michigan-Ann Arbor', 'umich.edu', 'https://umich.edu/'),
    ('Georgia Institute of Technology-Main Campus', 'gatech.edu', 'https://www.gatech.edu/'),
    ('Carnegie Mellon University', 'cmu.edu', 'https://www.cmu.edu/'),
    ('University of Illinois Urbana-Champaign', 'illinois.edu', 'https://illinois.edu/'),
    ('New York University', 'nyu.edu', 'https://www.nyu.edu/')
)
insert into public.universities (
  country, name, country_code, primary_domain, official_url, source,
  domain_source, domain_review_status, crawl_seed_enabled, domain_discovered_at
)
select
  'United States', s.name, 'US', s.primary_domain, s.official_url, 'curated',
  'manual_validated', 'approved', true, now()
from seed s
where not exists (
  select 1
  from public.universities u
  where lower(coalesce(u.primary_domain, '')) = lower(s.primary_domain)
     or lower(u.name) = lower(s.name)
);

create index if not exists idx_universities_crawl_seed_review
  on public.universities (domain_review_status, crawl_seed_enabled)
  where primary_domain is not null;

select pg_notify('pgrst', 'reload schema');
commit;
