-- ============================================================================
-- GLOWBAL — university primary_domain column + backfill
-- ----------------------------------------------------------------------------
-- Adds `primary_domain` to public.universities so the AI Course Selector can
-- run domain-restricted ("site:") web searches against each university's
-- official website. This dramatically improves result relevance (no more
-- reddit/wikipedia/aggregator noise) and works even on Vercel Hobby.
--
-- Safe to re-run (idempotent): the column add is guarded, and the backfill
-- only fills rows where primary_domain IS NULL.
--
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New Query).
-- ============================================================================

-- 1. Add the column (and a course_discovery_url for future use), if missing.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'universities'
      and column_name = 'primary_domain'
  ) then
    alter table public.universities add column primary_domain text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'universities'
      and column_name = 'course_discovery_url'
  ) then
    alter table public.universities add column course_discovery_url text;
  end if;
end $$;

-- 2. Backfill primary_domain for well-known universities.
--    Matching is tolerant of a leading "The " and a trailing "(...)" suffix
--    (e.g. "Technical University of Munich (TUM)").
with domain_map(name_pattern, domain) as (
  values
    -- United Kingdom
    ('University of Oxford', 'ox.ac.uk'),
    ('University of Cambridge', 'cam.ac.uk'),
    ('Imperial College London', 'imperial.ac.uk'),
    ('University College London', 'ucl.ac.uk'),
    ('London School of Economics and Political Science', 'lse.ac.uk'),
    ('London School of Economics', 'lse.ac.uk'),
    ('University of Edinburgh', 'ed.ac.uk'),
    ('King''s College London', 'kcl.ac.uk'),
    ('University of Manchester', 'manchester.ac.uk'),
    ('University of Bristol', 'bristol.ac.uk'),
    ('University of Warwick', 'warwick.ac.uk'),
    ('University of Glasgow', 'gla.ac.uk'),
    ('University of Birmingham', 'birmingham.ac.uk'),
    ('University of Leeds', 'leeds.ac.uk'),
    ('University of Sheffield', 'sheffield.ac.uk'),
    ('University of Nottingham', 'nottingham.ac.uk'),
    ('University of Southampton', 'southampton.ac.uk'),
    ('Durham University', 'durham.ac.uk'),
    ('University of St Andrews', 'st-andrews.ac.uk'),
    ('Queen Mary University of London', 'qmul.ac.uk'),
    ('Lancaster University', 'lancaster.ac.uk'),
    ('University of York', 'york.ac.uk'),
    ('University of Exeter', 'exeter.ac.uk'),
    ('University of Bath', 'bath.ac.uk'),
    -- United States
    ('Massachusetts Institute of Technology', 'mit.edu'),
    ('Harvard University', 'harvard.edu'),
    ('Stanford University', 'stanford.edu'),
    ('California Institute of Technology', 'caltech.edu'),
    ('University of Chicago', 'uchicago.edu'),
    ('Princeton University', 'princeton.edu'),
    ('Yale University', 'yale.edu'),
    ('Columbia University', 'columbia.edu'),
    ('University of Pennsylvania', 'upenn.edu'),
    ('Cornell University', 'cornell.edu'),
    ('University of California, Berkeley', 'berkeley.edu'),
    ('University of California, Los Angeles', 'ucla.edu'),
    ('University of Michigan', 'umich.edu'),
    ('Johns Hopkins University', 'jhu.edu'),
    ('New York University', 'nyu.edu'),
    ('Carnegie Mellon University', 'cmu.edu'),
    -- Canada
    ('University of Toronto', 'utoronto.ca'),
    ('McGill University', 'mcgill.ca'),
    ('University of British Columbia', 'ubc.ca'),
    ('University of Waterloo', 'uwaterloo.ca'),
    ('University of Alberta', 'ualberta.ca'),
    ('McMaster University', 'mcmaster.ca'),
    -- Australia
    ('University of Melbourne', 'unimelb.edu.au'),
    ('University of Sydney', 'sydney.edu.au'),
    ('Australian National University', 'anu.edu.au'),
    ('University of New South Wales', 'unsw.edu.au'),
    ('University of Queensland', 'uq.edu.au'),
    ('Monash University', 'monash.edu'),
    ('University of Western Australia', 'uwa.edu.au'),
    ('University of Adelaide', 'adelaide.edu.au'),
    -- Asia
    ('National University of Singapore', 'nus.edu.sg'),
    ('Nanyang Technological University', 'ntu.edu.sg'),
    ('University of Hong Kong', 'hku.hk'),
    ('Hong Kong University of Science and Technology', 'ust.hk'),
    ('Tsinghua University', 'tsinghua.edu.cn'),
    ('Peking University', 'pku.edu.cn'),
    ('University of Tokyo', 'u-tokyo.ac.jp'),
    ('Kyoto University', 'kyoto-u.ac.jp'),
    ('Seoul National University', 'snu.ac.kr'),
    ('KAIST', 'kaist.ac.kr'),
    -- Europe
    ('ETH Zurich', 'ethz.ch'),
    ('EPFL', 'epfl.ch'),
    ('Ecole Polytechnique Federale de Lausanne', 'epfl.ch'),
    ('Delft University of Technology', 'tudelft.nl'),
    ('University of Amsterdam', 'uva.nl'),
    ('Leiden University', 'universiteitleiden.nl'),
    ('Technical University of Munich', 'tum.de'),
    ('Ludwig Maximilian University of Munich', 'lmu.de'),
    ('Heidelberg University', 'uni-heidelberg.de'),
    ('KU Leuven', 'kuleuven.be'),
    ('University of Bologna', 'unibo.it'),
    ('Sapienza University of Rome', 'uniroma1.it'),
    ('Politecnico di Milano', 'polimi.it'),
    ('Bocconi University', 'unibocconi.it'),
    ('Sorbonne University', 'sorbonne-universite.fr'),
    ('PSL University', 'psl.eu'),
    ('Lund University', 'lu.se'),
    ('Karolinska Institute', 'ki.se'),
    ('University of Copenhagen', 'ku.dk'),
    ('Trinity College Dublin', 'tcd.ie'),
    -- Vietnam
    ('VinUniversity', 'vinuni.edu.vn'),
    ('Vietnam National University', 'vnu.edu.vn')
)
update public.universities u
set primary_domain = m.domain
from domain_map m
where u.primary_domain is null
  and (
    lower(u.name) = lower(m.name_pattern)
    or lower(u.name) = lower('The ' || m.name_pattern)
    or lower(regexp_replace(u.name, '\s*\([^)]*\)\s*$', '')) = lower(m.name_pattern)
    or lower(regexp_replace(u.name, '\s*\([^)]*\)\s*$', '')) = lower('The ' || m.name_pattern)
  );

-- 3. Report what still needs a domain (run separately to review/fill manually
--    or via scripts/backfill-university-domains.mjs):
-- select id, name, country from public.universities where primary_domain is null order by qs_rank nulls last;
