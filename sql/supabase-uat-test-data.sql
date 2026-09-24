-- ============================================================================
-- GLOWBAL — UAT TEST DATA SEED
-- ----------------------------------------------------------------------------
-- Generates a complete, realistic set of test accounts and data for User
-- Acceptance Testing (UAT). Covers BOTH live systems:
--
--   • Apply V2 ......... courses, course_applications, application_stages,
--                        application_tasks, application_requirements,
--                        application_sources, application_match_analyses,
--                        application_recommendations, application_events
--   • Mentorship/Profile mentorship: achiever_profiles, mentor_availability_slots,
--                        bookings, session_reviews
--                        profile:    student_profiles, work_experiences,
--                        english_test_scores, uploaded_documents
--   • Mailing lists .... newsletter_subscriptions, waitlist_signups
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL Editor (Dashboard → SQL Editor
--   → New Query) and run it. It must be run with the postgres / service role so
--   it can write to auth.* and bypass RLS — the SQL Editor already does this.
--
-- PREREQUISITES
--   Run these migrations first (this script assumes their tables/columns exist):
--     supabase-schema.sql, supabase-global-station.sql, supabase-mentorship.sql,
--     supabase-profile-extensions.sql, supabase-missing-tables.sql,
--     supabase-apply-v2.sql, supabase-newsletter.sql, supabase-waitlist.sql
--
-- IDEMPOTENT + CLEANUP
--   The CLEANUP section at the top removes any prior UAT data first, so the
--   whole script is safe to re-run — every run gives you a fresh, known-good
--   dataset. To ONLY tear the test data down (without re-seeding), run just the
--   "SECTION 0 — CLEANUP" block below.
--
-- TEST ACCOUNTS (all share the same password)
--   Password: GlowbalUAT!2026
--   ┌───────────────────────────────────┬──────────┬───────────────────────────┐
--   │ Email                             │ Role     │ What to test               │
--   ├───────────────────────────────────┼──────────┼───────────────────────────┤
--   │ tester.admin@glowbal-uat.test     │ Admin    │ Admin dashboards / users  │
--   │ tester.student.a@glowbal-uat.test │ Student  │ Active applicant, bookings │
--   │ tester.student.b@glowbal-uat.test │ Student  │ Early-stage researcher    │
--   │ tester.student.c@glowbal-uat.test │ Student  │ Offer received, reviews    │
--   │ tester.mentor.a@glowbal-uat.test  │ Mentor   │ Approved mentor, bookings │
--   │ tester.mentor.b@glowbal-uat.test  │ Mentor   │ Approved mentor, calendar │
--   └───────────────────────────────────┴──────────┴───────────────────────────┘
-- ============================================================================

create extension if not exists pgcrypto;  -- for crypt() / gen_salt()

-- ============================================================================
-- PRE-FLIGHT — ENSURE REQUIRED SCHEMA  (profile extensions)
-- ----------------------------------------------------------------------------
-- These columns/tables come from supabase-profile-extensions.sql. If that
-- migration was never applied — or aborted partway (an older copy used the
-- invalid `CREATE POLICY IF NOT EXISTS` and rolled the whole script back) —
-- the inserts further down fail with "column ... does not exist". We add them
-- here idempotently so this seed is self-sufficient on a partially-migrated
-- database. Every statement is a no-op when the object already exists.
-- ============================================================================

alter table public.student_profiles
  add column if not exists phone                  text,
  add column if not exists date_of_birth          date,
  add column if not exists current_institution    text,
  add column if not exists current_qualification  text,
  add column if not exists predicted_grades       text,
  add column if not exists graduation_year        integer,
  add column if not exists preferred_cities       text[],
  add column if not exists study_mode_preference  text,
  add column if not exists target_intake          text,
  add column if not exists application_cycle_year integer,
  add column if not exists profile_version        integer default 1;

create table if not exists public.work_experiences (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  company          text not null,
  role             text not null,
  employment_type  text,
  start_date       date,
  end_date         date,
  is_current       boolean not null default false,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.work_experiences enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='work_experiences' and policyname='work_experiences_owner'
  ) then
    create policy "work_experiences_owner" on public.work_experiences
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.english_test_scores (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  test_type        text not null,
  overall_score    numeric,
  listening_score  numeric,
  reading_score    numeric,
  writing_score    numeric,
  speaking_score   numeric,
  test_date        date,
  expiry_date      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.english_test_scores enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='english_test_scores' and policyname='english_test_scores_owner'
  ) then
    create policy "english_test_scores_owner" on public.english_test_scores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================================
-- SECTION 0 — CLEANUP  (run on its own to tear UAT data down)
-- ----------------------------------------------------------------------------
-- Deleting the auth.users rows cascades to: student_profiles, achiever_profiles,
-- course_applications (+ stages/tasks/requirements/sources/analyses/
-- recommendations/events), bookings, session_reviews, mentor_availability_slots,
-- work_experiences, english_test_scores, uploaded_documents and auth.identities.
-- Courses + mailing-list rows have no user FK, so we remove them explicitly.
-- ============================================================================

delete from auth.users where id in (
  'a0a00000-0000-4000-a000-000000000001',  -- admin
  'a0a00000-0000-4000-a000-000000000002',  -- student A
  'a0a00000-0000-4000-a000-000000000003',  -- student B
  'a0a00000-0000-4000-a000-000000000004',  -- student C
  'a0a00000-0000-4000-a000-000000000005',  -- mentor A
  'a0a00000-0000-4000-a000-000000000006'   -- mentor B
);

delete from public.courses where id in (
  'c0a00000-0000-4000-a000-000000000001',
  'c0a00000-0000-4000-a000-000000000002',
  'c0a00000-0000-4000-a000-000000000003',
  'c0a00000-0000-4000-a000-000000000004'
);

delete from public.newsletter_subscriptions where email like '%@glowbal-uat.test';
delete from public.waitlist_signups        where email like '%@glowbal-uat.test';

-- ============================================================================
-- SECTION 1 — AUTH USERS  (test accounts + email identities)
-- ============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'tester.admin@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"UAT Admin"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'tester.student.a@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"An Nguyen"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'tester.student.b@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bao Le"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000004',
   'authenticated', 'authenticated', 'tester.student.c@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Chi Tran"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000005',
   'authenticated', 'authenticated', 'tester.mentor.a@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Mai Pham"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000', 'a0a00000-0000-4000-a000-000000000006',
   'authenticated', 'authenticated', 'tester.mentor.b@glowbal-uat.test',
   crypt('GlowbalUAT!2026', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Quan Vo"}',
   now(), now(), '', '', '', '');

-- Email identities (required for email/password sign-in on modern GoTrue).
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.id in (
  'a0a00000-0000-4000-a000-000000000001',
  'a0a00000-0000-4000-a000-000000000002',
  'a0a00000-0000-4000-a000-000000000003',
  'a0a00000-0000-4000-a000-000000000004',
  'a0a00000-0000-4000-a000-000000000005',
  'a0a00000-0000-4000-a000-000000000006'
);

-- ============================================================================
-- SECTION 2 — STUDENT PROFILES  (admin + 3 students)
-- ============================================================================

insert into public.student_profiles (
  user_id, study_level, target_subjects, preferred_countries, budget_range,
  academic_background, grades_summary, goals, career_interests, profile_summary,
  bio, location, nationality, achievements, skills, onboarding_completed,
  onboarding_completed_at, is_admin, phone, date_of_birth, current_institution,
  current_qualification, predicted_grades, graduation_year, preferred_cities,
  study_mode_preference, target_intake, application_cycle_year, profile_version
) values
  -- Admin (also has a profile so admin pages have a backing row)
  ('a0a00000-0000-4000-a000-000000000001', 'postgraduate',
   array['Education Technology'], array['United Kingdom'], '£20k-£30k',
   'Internal Glowbal admin test account.', '{"gpa":"N/A"}'::jsonb,
   'Operate and verify the platform.', array['Product'], 'Glowbal UAT admin account.',
   'Admin tester.', 'London, UK', 'British', '[]'::jsonb, array['Admin'],
   true, now(), true, '+44 20 7946 0000', '1990-01-15', 'Glowbal',
   'BSc', 'N/A', 2012, array['London'], 'full_time', 'October 2026', 2026, 1),

  -- Student A — active applicant, mid-journey
  ('a0a00000-0000-4000-a000-000000000002', 'undergraduate',
   array['Computer Science','Mathematics'], array['United Kingdom','Australia'],
   '£25k-£35k', 'A-levels in Maths, Further Maths, Physics, Computer Science.',
   '{"a_levels":[{"subject":"Mathematics","grade":"A*"},{"subject":"Further Mathematics","grade":"A"},{"subject":"Physics","grade":"A"},{"subject":"Computer Science","grade":"A*"}]}'::jsonb,
   'Study CS at a top UK university and move into AI research.',
   array['Software Engineering','AI Research','Startups'],
   'Ambitious CS applicant with strong maths background and competition experience.',
   'Final-year secondary student from Hanoi aiming for UK computer science programmes.',
   'Hanoi, Vietnam', 'Vietnamese',
   '[{"title":"Gold medal, National Informatics Olympiad","year":2025},{"title":"Hackathon winner, VietHack 2024","year":2024}]'::jsonb,
   array['Python','C++','Algorithms','Public Speaking'], true, now(), false,
   '+84 90 123 4567', '2007-03-22', 'Hanoi-Amsterdam High School',
   'A-levels', 'A*A*AA', 2026, array['Cambridge','Manchester','London'],
   'full_time', 'October 2026', 2026, 1),

  -- Student B — early-stage researcher
  ('a0a00000-0000-4000-a000-000000000003', 'postgraduate',
   array['Data Science','Statistics'], array['Australia','Canada'],
   'A$40k-A$55k', 'BSc in Mathematics, currently exploring masters options.',
   '{"degree":"BSc Mathematics","gpa":"3.6/4.0"}'::jsonb,
   'Find an affordable, well-ranked data science masters abroad.',
   array['Data Analytics','Machine Learning'],
   'Recent maths graduate just starting to research masters programmes.',
   'Da Nang graduate weighing up data science masters across Australia and Canada.',
   'Da Nang, Vietnam', 'Vietnamese', '[]'::jsonb,
   array['R','SQL','Statistics'], true, now(), false,
   '+84 90 765 4321', '2002-08-09', 'University of Science, VNU',
   'BSc Mathematics', 'First Class', 2024, array['Melbourne','Sydney','Toronto'],
   'full_time', 'February 2027', 2027, 1),

  -- Student C — offer received, journey complete
  ('a0a00000-0000-4000-a000-000000000004', 'undergraduate',
   array['Business Administration'], array['Vietnam'],
   'US$30k-US$40k', 'IB Diploma, 38 points.',
   '{"ib_total":38,"hl":["Business Management","Economics","English"]}'::jsonb,
   'Start a business degree at a leading university in Vietnam.',
   array['Entrepreneurship','Marketing'],
   'Confident applicant who has already received an offer for a BBA programme.',
   'Ho Chi Minh City student who has secured a VinUniversity BBA offer.',
   'Ho Chi Minh City, Vietnam', 'Vietnamese',
   '[{"title":"President, School Business Club","year":2025}]'::jsonb,
   array['Leadership','Marketing','Excel'], true, now(), false,
   '+84 91 222 3333', '2007-11-30', 'British International School HCMC',
   'IB Diploma', '38 points', 2026, array['Hanoi','Ho Chi Minh City'],
   'full_time', 'August 2026', 2026, 1);

-- ============================================================================
-- SECTION 3 — ACHIEVER (MENTOR) PROFILES
-- ============================================================================

insert into public.achiever_profiles (
  id, display_name, legal_name, date_of_birth, avatar_url, university_id,
  degree_level, subject, graduation_year, study_start_year, currently_enrolled,
  bio, help_topics, strengths, languages, session_price_vnd, session_duration_mins,
  hourly_rate_amount, hourly_rate_currency, status, verified_at,
  total_sessions, avg_rating
) values
  -- Mentor A — VND-priced, receives the seeded bookings + reviews
  ('a0a00000-0000-4000-a000-000000000005', 'Mai P.', 'Mai Thi Pham', '1999-05-12',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=tester-mentor-a',
   (select id from public.universities where name ilike '%Cambridge%' order by id limit 1),
   'undergraduate', 'Computer Science, BA', 2025, 2022, true,
   'Cambridge CS undergrad. I help applicants with personal statements, the SAQ and technical interviews — in English or Vietnamese.',
   array['Personal statement','Interview prep','Course choice'],
   array['Strong writer','Mock interviews','STEM Olympiad veteran'],
   array['English','Vietnamese'], 500000, 60, 500000, 'VND', 'approved', now(), 0, 0),

  -- Mentor B — USD-priced, calendar-only (no bookings) for variety
  ('a0a00000-0000-4000-a000-000000000006', 'Quan V.', 'Quan Minh Vo', '1997-09-03',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=tester-mentor-b',
   (select id from public.universities where name ilike '%Melbourne%' order by id limit 1),
   'masters', 'MSc Data Science', 2024, 2022, false,
   'Melbourne data science alum now working as an ML engineer. I review SOPs and run mock interviews for data/analytics masters applicants.',
   array['SOP review','Interview prep','Career planning'],
   array['Tech-savvy','Startup experience'],
   array['English','Vietnamese'], 500000, 60, 6000, 'USD', 'approved', now(), 0, 0);

-- ============================================================================
-- SECTION 4 — PROFILE EXTENSIONS  (work experience, English tests, documents)
-- ============================================================================

insert into public.work_experiences (
  user_id, company, role, employment_type, start_date, end_date, is_current, description
) values
  ('a0a00000-0000-4000-a000-000000000002', 'CodeClub Hanoi', 'Volunteer Coding Tutor',
   'volunteer', '2024-06-01', null, true,
   'Teach Python to secondary students every weekend; designed a 6-week intro curriculum.'),
  ('a0a00000-0000-4000-a000-000000000002', 'FPT Software', 'Summer Intern (Software)',
   'internship', '2025-06-15', '2025-08-15', false,
   'Built internal tooling in TypeScript; shipped a dashboard used by the QA team.'),
  ('a0a00000-0000-4000-a000-000000000004', 'School Business Club', 'Club President',
   'part_time', '2024-09-01', null, true,
   'Lead a 40-member club; organised a charity market that raised over US$2,000.');

insert into public.english_test_scores (
  user_id, test_type, overall_score, listening_score, reading_score,
  writing_score, speaking_score, test_date, expiry_date
) values
  ('a0a00000-0000-4000-a000-000000000002', 'IELTS', 7.5, 8.0, 8.0, 7.0, 7.0,
   '2025-09-20', '2027-09-20'),
  ('a0a00000-0000-4000-a000-000000000003', 'IELTS', 7.0, 7.5, 7.5, 6.5, 6.5,
   '2024-11-10', '2026-11-10'),
  ('a0a00000-0000-4000-a000-000000000004', 'IELTS', 7.0, 7.0, 7.5, 6.5, 6.5,
   '2025-05-05', '2027-05-05');

insert into public.uploaded_documents (
  user_id, type, storage_key, file_name, mime_type, parsed_summary, extraction_status
) values
  ('a0a00000-0000-4000-a000-000000000002', 'cv',
   'a0a00000-0000-4000-a000-000000000002/cv-an-nguyen.pdf', 'cv-an-nguyen.pdf',
   'application/pdf', 'CS applicant; informatics olympiad gold; Python/C++; internship at FPT Software.',
   'parsed'),
  ('a0a00000-0000-4000-a000-000000000002', 'personal_statement',
   'a0a00000-0000-4000-a000-000000000002/ps-cambridge.pdf', 'ps-cambridge.pdf',
   'application/pdf', 'Personal statement focused on competitive programming and AI research ambitions.',
   'parsed'),
  ('a0a00000-0000-4000-a000-000000000004', 'statement_of_purpose',
   'a0a00000-0000-4000-a000-000000000004/sop-vinuni.pdf', 'sop-vinuni.pdf',
   'application/pdf', 'SOP highlighting entrepreneurship and leadership for a BBA programme.',
   'parsed');

-- ============================================================================
-- SECTION 5 — APPLY V2: COURSE CATALOG
-- ============================================================================

insert into public.courses (
  id, university_id, university_name, course_name, course_url, degree_level,
  subject, study_mode, duration, intake, country, city, tuition_fee_text,
  tuition_fee_min, tuition_fee_max, tuition_currency, entry_requirements_summary,
  english_requirements_summary, application_method, application_code,
  source_confidence, extraction_status, last_extracted_at
) values
  ('c0a00000-0000-4000-a000-000000000001',
   (select id from public.universities where name ilike '%Cambridge%' order by id limit 1),
   'University of Cambridge', 'BA (Hons) Computer Science',
   'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400',
   'Bachelor''s', 'Computer Science', 'Full-time', '3 years', 'October 2026',
   'United Kingdom', 'Cambridge', '£24,507 per year', 24507, 24507, 'GBP',
   'A*A*A including Mathematics; STEP/admissions assessment may apply.',
   'IELTS 7.5 overall (7.0 in each element).', 'UCAS', 'G400',
   0.9, 'extracted', now()),

  ('c0a00000-0000-4000-a000-000000000002',
   (select id from public.universities where name ilike '%Manchester%' order by id limit 1),
   'The University of Manchester', 'BSc Computer Science',
   'https://www.manchester.ac.uk/study/undergraduate/courses/2026/computer-science-bsc',
   'Bachelor''s', 'Computer Science', 'Full-time', '3 years', 'September 2026',
   'United Kingdom', 'Manchester', '£28,000 per year', 28000, 28000, 'GBP',
   'AAA including Mathematics.',
   'IELTS 6.5 overall (6.0 in each element).', 'UCAS', 'G400',
   0.85, 'extracted', now()),

  ('c0a00000-0000-4000-a000-000000000003',
   (select id from public.universities where name ilike '%Melbourne%' order by id limit 1),
   'University of Melbourne', 'Master of Data Science',
   'https://study.unimelb.edu.au/find/courses/graduate/master-of-data-science/',
   'Master''s', 'Data Science', 'Full-time', '2 years', 'February 2027',
   'Australia', 'Melbourne', 'A$49,000 per year', 49000, 49000, 'AUD',
   'Undergraduate degree with a strong quantitative background.',
   'IELTS 6.5 overall (6.0 in each element).', 'Direct Apply', null,
   0.8, 'extracted', now()),

  ('c0a00000-0000-4000-a000-000000000004',
   (select id from public.universities where name ilike '%VinUni%' order by id limit 1),
   'VinUniversity', 'Bachelor of Business Administration',
   'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/',
   'Bachelor''s', 'Business Administration', 'Full-time', '4 years', 'August 2026',
   'Vietnam', 'Hanoi', 'US$35,000 per year', 35000, 35000, 'USD',
   'High school diploma with a strong GPA; interview required.',
   'IELTS 6.5 overall.', 'Direct Apply', null,
   0.8, 'extracted', now());

-- ============================================================================
-- SECTION 6 — APPLY V2: COURSE APPLICATIONS
-- ============================================================================

insert into public.course_applications (
  id, user_id, course_id, university_id, university_name, course_name, course_url,
  degree_level, subject, study_mode, intake, country, country_flag, status,
  progress_percentage, deadline, deadline_source, deadline_confidence,
  imported_from_url, import_status, ai_summary, user_notes
) values
  -- A1: Student A → Cambridge CS (mid-journey, preparing)
  ('aaa00000-0000-4000-a000-000000000001', 'a0a00000-0000-4000-a000-000000000002',
   'c0a00000-0000-4000-a000-000000000001',
   (select id from public.universities where name ilike '%Cambridge%' order by id limit 1),
   'University of Cambridge', 'BA (Hons) Computer Science',
   'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400',
   'Bachelor''s', 'Computer Science', 'Full-time', 'October 2026', 'United Kingdom', '🇬🇧',
   'preparing', 40, date '2026-10-15', 'UCAS deadline page', 0.95,
   'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400',
   'complete',
   'Strong academic fit. Focus now is finishing the personal statement and securing references before the UCAS Oxbridge deadline.',
   'Top choice — need to nail the technical interview prep.'),

  -- A2: Student A → Manchester CS (submitted, awaiting decision)
  ('aaa00000-0000-4000-a000-000000000002', 'a0a00000-0000-4000-a000-000000000002',
   'c0a00000-0000-4000-a000-000000000002',
   (select id from public.universities where name ilike '%Manchester%' order by id limit 1),
   'The University of Manchester', 'BSc Computer Science',
   'https://www.manchester.ac.uk/study/undergraduate/courses/2026/computer-science-bsc',
   'Bachelor''s', 'Computer Science', 'Full-time', 'September 2026', 'United Kingdom', '🇬🇧',
   'submitted', 90, date '2026-01-29', 'UCAS equal consideration deadline', 0.9,
   'https://www.manchester.ac.uk/study/undergraduate/courses/2026/computer-science-bsc',
   'complete',
   'Application submitted via UCAS. Predicted grades exceed the AAA requirement — a strong, safe choice.',
   'Submitted! Now waiting to hear back.'),

  -- B1: Student B → Melbourne Data Science (just researching)
  ('aaa00000-0000-4000-a000-000000000003', 'a0a00000-0000-4000-a000-000000000003',
   'c0a00000-0000-4000-a000-000000000003',
   (select id from public.universities where name ilike '%Melbourne%' order by id limit 1),
   'University of Melbourne', 'Master of Data Science',
   'https://study.unimelb.edu.au/find/courses/graduate/master-of-data-science/',
   'Master''s', 'Data Science', 'Full-time', 'February 2027', 'Australia', '🇦🇺',
   'researching', 10, date '2026-10-31', 'Course intake page', 0.7,
   'https://study.unimelb.edu.au/find/courses/graduate/master-of-data-science/',
   'complete',
   'Good quantitative background. Still early — needs to confirm prerequisites and compare funding options before applying.',
   'Comparing this against a couple of Canadian options.'),

  -- C1: Student C → VinUniversity BBA (offer received)
  ('aaa00000-0000-4000-a000-000000000004', 'a0a00000-0000-4000-a000-000000000004',
   'c0a00000-0000-4000-a000-000000000004',
   (select id from public.universities where name ilike '%VinUni%' order by id limit 1),
   'VinUniversity', 'Bachelor of Business Administration',
   'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/',
   'Bachelor''s', 'Business Administration', 'Full-time', 'August 2026', 'Vietnam', '🇻🇳',
   'offer_received', 100, date '2026-03-15', 'Admissions portal', 0.9,
   'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/',
   'complete',
   'Offer received! All requirements met. Next step is to review the offer terms and accept before the deadline.',
   'Got the offer — deciding on the scholarship package.');

-- ============================================================================
-- SECTION 7 — APPLY V2: STAGES
-- ----------------------------------------------------------------------------
-- A standard 5-stage journey per application. Stage status / application
-- progress are refined automatically by the schema triggers once tasks below
-- are inserted, so the dataset stays internally consistent.
-- ============================================================================

insert into public.application_stages (
  application_id, name, slug, description, order_num, status, is_required, icon,
  why_this_matters, ai_generated, confidence, started_at
) values
  -- A1 (Cambridge) — research/eligibility done, documents in progress
  ('aaa00000-0000-4000-a000-000000000001', 'Research & Shortlist', 'research', 'Understand the course, modules and fit.', 1, 'completed', true, 'search', 'A focused shortlist saves time and strengthens every later step.', true, 0.9, now() - interval '40 days'),
  ('aaa00000-0000-4000-a000-000000000001', 'Check Eligibility', 'eligibility', 'Confirm you meet academic and English requirements.', 2, 'completed', true, 'check-circle', 'Applying to a course you are eligible for protects your UCAS choices.', true, 0.9, now() - interval '32 days'),
  ('aaa00000-0000-4000-a000-000000000001', 'Prepare Documents', 'documents', 'Personal statement, references and supporting documents.', 3, 'in_progress', true, 'file-text', 'Strong documents are what set competitive applicants apart.', true, 0.9, now() - interval '20 days'),
  ('aaa00000-0000-4000-a000-000000000001', 'Submit Application', 'submit', 'Complete and submit the UCAS application.', 4, 'not_started', true, 'send', 'Submitting early avoids deadline-day technical issues.', true, 0.9, null),
  ('aaa00000-0000-4000-a000-000000000001', 'Interview & Decision', 'decision', 'Interview preparation and responding to the offer.', 5, 'not_started', true, 'award', 'Good interview prep can turn a borderline application into an offer.', true, 0.9, null),

  -- A2 (Manchester) — submitted, awaiting decision
  ('aaa00000-0000-4000-a000-000000000002', 'Research & Shortlist', 'research', 'Understand the course, modules and fit.', 1, 'completed', true, 'search', 'A focused shortlist saves time and strengthens every later step.', true, 0.9, now() - interval '50 days'),
  ('aaa00000-0000-4000-a000-000000000002', 'Check Eligibility', 'eligibility', 'Confirm you meet academic and English requirements.', 2, 'completed', true, 'check-circle', 'Applying to a course you are eligible for protects your UCAS choices.', true, 0.9, now() - interval '45 days'),
  ('aaa00000-0000-4000-a000-000000000002', 'Prepare Documents', 'documents', 'Personal statement, references and supporting documents.', 3, 'completed', true, 'file-text', 'Strong documents are what set competitive applicants apart.', true, 0.9, now() - interval '35 days'),
  ('aaa00000-0000-4000-a000-000000000002', 'Submit Application', 'submit', 'Complete and submit the UCAS application.', 4, 'completed', true, 'send', 'Submitting early avoids deadline-day technical issues.', true, 0.9, now() - interval '20 days'),
  ('aaa00000-0000-4000-a000-000000000002', 'Interview & Decision', 'decision', 'Await and respond to the decision.', 5, 'in_progress', true, 'award', 'Tracking the decision lets you respond quickly when it lands.', true, 0.9, now() - interval '18 days'),

  -- B1 (Melbourne) — only research underway
  ('aaa00000-0000-4000-a000-000000000003', 'Research & Shortlist', 'research', 'Understand the course, modules and fit.', 1, 'in_progress', true, 'search', 'A focused shortlist saves time and strengthens every later step.', true, 0.8, now() - interval '5 days'),
  ('aaa00000-0000-4000-a000-000000000003', 'Check Eligibility', 'eligibility', 'Confirm you meet academic and English requirements.', 2, 'not_started', true, 'check-circle', 'Applying to a course you are eligible for protects your application.', true, 0.8, null),
  ('aaa00000-0000-4000-a000-000000000003', 'Prepare Documents', 'documents', 'CV, SOP, references and transcripts.', 3, 'not_started', true, 'file-text', 'Strong documents are what set competitive applicants apart.', true, 0.8, null),
  ('aaa00000-0000-4000-a000-000000000003', 'Submit Application', 'submit', 'Complete and submit the direct application.', 4, 'not_started', true, 'send', 'Submitting early keeps funding options open.', true, 0.8, null),
  ('aaa00000-0000-4000-a000-000000000003', 'Decision', 'decision', 'Respond to the offer.', 5, 'not_started', true, 'award', 'Quick responses keep scholarship options on the table.', true, 0.8, null),

  -- C1 (VinUni) — fully complete, offer in hand
  ('aaa00000-0000-4000-a000-000000000004', 'Research & Shortlist', 'research', 'Understand the course, modules and fit.', 1, 'completed', true, 'search', 'A focused shortlist saves time and strengthens every later step.', true, 0.9, now() - interval '120 days'),
  ('aaa00000-0000-4000-a000-000000000004', 'Check Eligibility', 'eligibility', 'Confirm you meet academic and English requirements.', 2, 'completed', true, 'check-circle', 'Applying to a course you are eligible for protects your application.', true, 0.9, now() - interval '110 days'),
  ('aaa00000-0000-4000-a000-000000000004', 'Prepare Documents', 'documents', 'SOP, references and transcripts.', 3, 'completed', true, 'file-text', 'Strong documents are what set competitive applicants apart.', true, 0.9, now() - interval '95 days'),
  ('aaa00000-0000-4000-a000-000000000004', 'Submit Application', 'submit', 'Complete and submit the direct application.', 4, 'completed', true, 'send', 'Submitting early avoids deadline-day technical issues.', true, 0.9, now() - interval '80 days'),
  ('aaa00000-0000-4000-a000-000000000004', 'Interview & Decision', 'decision', 'Interview, then respond to the offer.', 5, 'completed', true, 'award', 'Responding on time secures your place.', true, 0.9, now() - interval '40 days');

-- Point each application at its current stage.
update public.course_applications c
set current_stage_id = s.id
from public.application_stages s
where s.application_id = c.id
  and (
    (c.id = 'aaa00000-0000-4000-a000-000000000001' and s.slug = 'documents') or
    (c.id = 'aaa00000-0000-4000-a000-000000000002' and s.slug = 'decision')  or
    (c.id = 'aaa00000-0000-4000-a000-000000000003' and s.slug = 'research')  or
    (c.id = 'aaa00000-0000-4000-a000-000000000004' and s.slug = 'decision')
  );

-- ============================================================================
-- SECTION 8 — APPLY V2: TASKS
-- ----------------------------------------------------------------------------
-- Tasks reference their stage via the UNIQUE(application_id, slug) on stages.
-- Inserting them fires the progress / stage-status triggers.
-- ============================================================================

-- Helper note: sub-selects below resolve stage_id by (application_id, slug).

-- A1 (Cambridge)
insert into public.application_tasks (
  application_id, stage_id, title, description, task_type, status, priority,
  due_date, action_label, action_type, action_target, source_url, confidence,
  sort_order, completed_at, created_by
) values
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='research'),    'Review course modules', 'Read the official module list and note three that excite you.', 'research', 'completed', 'medium', null, 'Open course page', 'external_url', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400', 0.9, 1, now() - interval '38 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='research'),    'Compare with two similar courses', 'Shortlist and compare against Imperial and UCL CS.', 'research', 'completed', 'low', null, null, 'none', null, null, 0.8, 2, now() - interval '36 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='eligibility'), 'Check A-level requirements', 'Confirm A*A*A including Mathematics is achievable from predicted grades.', 'eligibility', 'completed', 'high', null, 'Check requirements', 'open_modal', null, null, 0.9, 1, now() - interval '31 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='eligibility'), 'Verify English requirement', 'IELTS 7.5 overall — confirm your score meets each element minimum.', 'eligibility', 'completed', 'medium', null, null, 'none', null, null, 0.9, 2, now() - interval '30 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='documents'),   'Draft personal statement', 'Write a first draft focused on competitive programming and AI.', 'document', 'in_progress', 'high', current_date + 10, 'Open AI writer', 'internal_route', '/tools/personal-statement', null, 0.85, 1, null, 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='documents'),   'Request academic references', 'Ask two teachers at least four weeks before the deadline.', 'document', 'not_started', 'high', current_date + 14, null, 'none', null, null, 0.8, 2, null, 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='documents'),   'Upload your CV', 'Upload your latest CV so we can tailor suggestions.', 'document', 'not_started', 'medium', null, 'Upload CV', 'upload_document', null, null, 0.8, 3, null, 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='submit'),      'Complete the UCAS form', 'Fill in every UCAS section and double-check before submitting.', 'submission', 'not_started', 'high', current_date + 25, null, 'none', null, null, 0.8, 1, null, 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='submit'),      'Submit application', 'Submit at least 24 hours before the deadline.', 'deadline', 'not_started', 'urgent', current_date + 30, null, 'none', null, null, 0.9, 2, null, 'ai'),
  ('aaa00000-0000-4000-a000-000000000001', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000001' and slug='decision'),    'Book a mock interview', 'Practise a technical interview with a Glowbal advisor.', 'mentor', 'not_started', 'medium', null, 'Book an advisor', 'book_mentor', '/advisors', null, 0.8, 1, null, 'ai');

-- A2 (Manchester)
insert into public.application_tasks (
  application_id, stage_id, title, description, task_type, status, priority,
  due_date, action_label, action_type, action_target, confidence, sort_order, completed_at, created_by
) values
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='research'),    'Review course modules', 'Read the module list and note relevant optional units.', 'research', 'completed', 'medium', null, null, 'none', null, 0.9, 1, now() - interval '48 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='eligibility'), 'Confirm AAA requirement', 'Predicted grades exceed AAA — confirm Maths is included.', 'eligibility', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '44 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='documents'),   'Reuse and adapt personal statement', 'Adapt the Cambridge statement for the Manchester course.', 'document', 'completed', 'medium', null, null, 'none', null, 0.85, 1, now() - interval '34 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='documents'),   'Confirm references attached', 'Make sure references are attached in UCAS.', 'document', 'completed', 'high', null, null, 'none', null, 0.9, 2, now() - interval '30 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='submit'),      'Submit via UCAS', 'Application submitted through UCAS.', 'submission', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '20 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000002', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000002' and slug='decision'),    'Track UCAS Hub for a decision', 'Check UCAS Hub regularly for the university''s response.', 'general', 'in_progress', 'medium', current_date + 20, 'Open UCAS Hub', 'external_url', 'https://www.ucas.com/dashboard', 0.8, 1, null, 'ai');

-- B1 (Melbourne)
insert into public.application_tasks (
  application_id, stage_id, title, description, task_type, status, priority,
  due_date, action_label, action_type, action_target, confidence, sort_order, created_by
) values
  ('aaa00000-0000-4000-a000-000000000003', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000003' and slug='research'),    'Read the course structure', 'Review subjects, duration and study options.', 'research', 'completed', 'medium', null, 'Open course page', 'external_url', 'https://study.unimelb.edu.au/find/courses/graduate/master-of-data-science/', 0.8, 1, 'ai'),
  ('aaa00000-0000-4000-a000-000000000003', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000003' and slug='research'),    'Compare funding options', 'Compare tuition and scholarships against Canadian options.', 'research', 'in_progress', 'medium', current_date + 21, null, 'none', null, 0.7, 2, 'ai'),
  ('aaa00000-0000-4000-a000-000000000003', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000003' and slug='eligibility'), 'Check quantitative prerequisites', 'Confirm your maths background meets the prerequisite.', 'eligibility', 'not_started', 'high', current_date + 28, 'Check requirements', 'open_modal', null, 0.7, 1, 'ai'),
  ('aaa00000-0000-4000-a000-000000000003', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000003' and slug='documents'),   'Prepare your CV and SOP', 'Draft a CV and statement of purpose for the application.', 'document', 'not_started', 'medium', current_date + 40, 'Upload documents', 'upload_document', null, 0.7, 1, 'ai');

-- C1 (VinUni) — every task complete
insert into public.application_tasks (
  application_id, stage_id, title, description, task_type, status, priority,
  due_date, action_label, action_type, action_target, confidence, sort_order, completed_at, created_by
) values
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='research'),    'Review BBA curriculum', 'Read the curriculum and confirm fit.', 'research', 'completed', 'medium', null, null, 'none', null, 0.9, 1, now() - interval '115 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='eligibility'), 'Confirm GPA and IELTS', 'IB 38 and IELTS 7.0 comfortably meet requirements.', 'eligibility', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '108 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='documents'),   'Write statement of purpose', 'Finalise the SOP highlighting leadership and entrepreneurship.', 'document', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '92 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='submit'),      'Submit application', 'Submit through the VinUni admissions portal.', 'submission', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '78 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='decision'),    'Attend admissions interview', 'Completed the admissions interview.', 'general', 'completed', 'high', null, null, 'none', null, 0.9, 1, now() - interval '45 days', 'ai'),
  ('aaa00000-0000-4000-a000-000000000004', (select id from public.application_stages where application_id='aaa00000-0000-4000-a000-000000000004' and slug='decision'),    'Review and accept offer', 'Review the offer and scholarship terms, then accept.', 'deadline', 'completed', 'urgent', null, null, 'none', null, 0.9, 2, now() - interval '38 days', 'ai');

-- ============================================================================
-- SECTION 9 — APPLY V2: REQUIREMENTS
-- ============================================================================

insert into public.application_requirements (
  application_id, course_id, requirement_type, title, requirement_text,
  is_mandatory, student_status, source_url, confidence
) values
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', 'academic', 'A-level grades', 'A*A*A including Mathematics.', true, 'partially_met', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400', 0.9),
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', 'english',  'English proficiency', 'IELTS 7.5 overall, 7.0 in each element.', true, 'met', null, 0.9),
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', 'interview','Admissions interview', 'Shortlisted applicants attend a subject interview.', true, 'not_met', null, 0.8),
  ('aaa00000-0000-4000-a000-000000000002', 'c0a00000-0000-4000-a000-000000000002', 'academic', 'A-level grades', 'AAA including Mathematics.', true, 'met', null, 0.9),
  ('aaa00000-0000-4000-a000-000000000002', 'c0a00000-0000-4000-a000-000000000002', 'english',  'English proficiency', 'IELTS 6.5 overall, 6.0 in each element.', true, 'met', null, 0.9),
  ('aaa00000-0000-4000-a000-000000000003', 'c0a00000-0000-4000-a000-000000000003', 'academic', 'Quantitative degree', 'Undergraduate degree with a strong quantitative background.', true, 'met', null, 0.8),
  ('aaa00000-0000-4000-a000-000000000003', 'c0a00000-0000-4000-a000-000000000003', 'english',  'English proficiency', 'IELTS 6.5 overall, 6.0 in each element.', true, 'met', null, 0.8),
  ('aaa00000-0000-4000-a000-000000000004', 'c0a00000-0000-4000-a000-000000000004', 'academic', 'High school diploma', 'High school diploma with a strong GPA.', true, 'met', null, 0.9),
  ('aaa00000-0000-4000-a000-000000000004', 'c0a00000-0000-4000-a000-000000000004', 'interview','Admissions interview', 'Interview with the admissions panel.', true, 'met', null, 0.9);

-- ============================================================================
-- SECTION 10 — APPLY V2: SOURCES
-- ============================================================================

insert into public.application_sources (
  application_id, course_id, university_id, source_type, title, url, description,
  display_priority, is_official, confidence, validation_status, last_checked_at
) values
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', (select id from public.universities where name ilike '%Cambridge%' order by id limit 1), 'course_page', 'Cambridge CS course page', 'https://www.undergraduate.study.cam.ac.uk/courses/computer-science-ba-hons-g400', 'Official undergraduate course page.', 10, true, 0.95, 'valid', now()),
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', (select id from public.universities where name ilike '%Cambridge%' order by id limit 1), 'entry_requirements', 'Entry requirements', 'https://www.undergraduate.study.cam.ac.uk/applying/entrance-requirements', 'Academic and English entry requirements.', 20, true, 0.9, 'valid', now()),
  ('aaa00000-0000-4000-a000-000000000001', 'c0a00000-0000-4000-a000-000000000001', (select id from public.universities where name ilike '%Cambridge%' order by id limit 1), 'how_to_apply', 'How to apply', 'https://www.undergraduate.study.cam.ac.uk/applying', 'Application process and key dates.', 30, true, 0.9, 'unchecked', null),
  ('aaa00000-0000-4000-a000-000000000002', 'c0a00000-0000-4000-a000-000000000002', (select id from public.universities where name ilike '%Manchester%' order by id limit 1), 'course_page', 'Manchester CS course page', 'https://www.manchester.ac.uk/study/undergraduate/courses/2026/computer-science-bsc', 'Official course page.', 10, true, 0.9, 'valid', now()),
  ('aaa00000-0000-4000-a000-000000000003', 'c0a00000-0000-4000-a000-000000000003', (select id from public.universities where name ilike '%Melbourne%' order by id limit 1), 'course_page', 'Melbourne Data Science page', 'https://study.unimelb.edu.au/find/courses/graduate/master-of-data-science/', 'Official course page.', 10, true, 0.85, 'valid', now()),
  ('aaa00000-0000-4000-a000-000000000004', 'c0a00000-0000-4000-a000-000000000004', (select id from public.universities where name ilike '%VinUni%' order by id limit 1), 'course_page', 'VinUni BBA page', 'https://vinuni.edu.vn/college-of-business-management/bachelor-of-business-administration/', 'Official programme page.', 10, true, 0.85, 'valid', now());

-- ============================================================================
-- SECTION 11 — APPLY V2: MATCH ANALYSES
-- ============================================================================

insert into public.application_match_analyses (
  application_id, user_id, profile_version, current_match_score,
  max_possible_match_score, score_label, max_score_label, academic_score,
  english_score, experience_score, document_score, fit_score, strengths,
  weaknesses, improvement_actions, explanation, max_possible_explanation,
  model_name, prompt_version, analysis_status
) values
  ('aaa00000-0000-4000-a000-000000000001', 'a0a00000-0000-4000-a000-000000000002', 1, 72, 88,
   'Good match', 'Excellent match possible', 80, 95, 70, 55, 75,
   array['Outstanding maths and informatics record','Olympiad gold medal','Meets English requirement comfortably'],
   array['Personal statement still in draft','No mock interview practice yet'],
   '[{"action":"Finish and review the personal statement","impact":"high"},{"action":"Book a mock technical interview","impact":"medium"}]'::jsonb,
   'A strong candidate academically; the main gap is finishing the application documents.',
   'Completing the personal statement and interview prep could lift this to an excellent match.',
   'glowbal-match-v2', 'v2.1', 'complete'),

  ('aaa00000-0000-4000-a000-000000000002', 'a0a00000-0000-4000-a000-000000000002', 1, 85, 90,
   'Strong match', 'Excellent match possible', 90, 90, 70, 85, 85,
   array['Predicted grades exceed AAA','Application already submitted','Reused a polished personal statement'],
   array['Limited course-specific tailoring'],
   '[{"action":"Prepare for any applicant days","impact":"low"}]'::jsonb,
   'A safe, strong choice — predicted grades comfortably clear the bar and the application is in.',
   'Little left to improve; this is already a high-confidence application.',
   'glowbal-match-v2', 'v2.1', 'complete'),

  ('aaa00000-0000-4000-a000-000000000003', 'a0a00000-0000-4000-a000-000000000003', 1, 64, 82,
   'Fair match', 'Good match possible', 75, 80, 55, 40, 65,
   array['Strong quantitative degree','Meets English requirement'],
   array['Application not started','No CV or SOP prepared yet','Prerequisites unconfirmed'],
   '[{"action":"Confirm quantitative prerequisites","impact":"high"},{"action":"Draft CV and SOP","impact":"high"}]'::jsonb,
   'Good underlying profile, but the application is at an early stage.',
   'Preparing documents and confirming prerequisites would raise the match considerably.',
   'glowbal-match-v2', 'v2.1', 'complete'),

  ('aaa00000-0000-4000-a000-000000000004', 'a0a00000-0000-4000-a000-000000000004', 1, 92, 92,
   'Excellent match', 'Excellent match', 95, 90, 85, 95, 95,
   array['Offer already received','All requirements met','Strong leadership profile'],
   array[]::text[],
   '[]'::jsonb,
   'Everything is complete and an offer is in hand — an excellent outcome.',
   'No further improvement needed.',
   'glowbal-match-v2', 'v2.1', 'complete');

-- ============================================================================
-- SECTION 12 — APPLY V2: RECOMMENDATIONS + EVENTS
-- ============================================================================

insert into public.application_recommendations (
  application_id, recommendation_type, title, body, priority, action_label,
  action_type, action_target, confidence, is_dismissed
) values
  ('aaa00000-0000-4000-a000-000000000001', 'next_action', 'Finish your personal statement', 'Your draft is in progress — completing it is the highest-impact next step.', 'high', 'Open AI writer', 'internal_route', '/tools/personal-statement', 0.9, false),
  ('aaa00000-0000-4000-a000-000000000001', 'mentor', 'Practise the technical interview', 'A Cambridge CS advisor can run a realistic mock interview with you.', 'medium', 'Browse advisors', 'internal_route', '/advisors', 0.85, false),
  ('aaa00000-0000-4000-a000-000000000003', 'warning', 'Confirm prerequisites before applying', 'Double-check the quantitative prerequisites so you don''t waste an application.', 'high', 'Check requirements', 'open_modal', null, 0.8, false),
  ('aaa00000-0000-4000-a000-000000000004', 'tip', 'Compare your scholarship offers', 'Review the scholarship package carefully before accepting your offer.', 'medium', null, null, null, 0.8, false);

insert into public.application_events (
  application_id, user_id, event_type, event_label, metadata
) values
  ('aaa00000-0000-4000-a000-000000000001', 'a0a00000-0000-4000-a000-000000000002', 'application_created', 'Application created', '{"source":"url_import"}'::jsonb),
  ('aaa00000-0000-4000-a000-000000000001', 'a0a00000-0000-4000-a000-000000000002', 'stage_completed', 'Completed: Check Eligibility', '{"stage":"eligibility"}'::jsonb),
  ('aaa00000-0000-4000-a000-000000000002', 'a0a00000-0000-4000-a000-000000000002', 'status_changed', 'Status changed to submitted', '{"from":"ready_to_apply","to":"submitted"}'::jsonb),
  ('aaa00000-0000-4000-a000-000000000004', 'a0a00000-0000-4000-a000-000000000004', 'status_changed', 'Offer received', '{"from":"submitted","to":"offer_received"}'::jsonb);

-- ============================================================================
-- SECTION 13 — MENTORSHIP: AVAILABILITY, BOOKINGS, REVIEWS
-- ----------------------------------------------------------------------------
-- Done in a DO block because slots/bookings/reviews use bigserial ids that we
-- need to cross-reference. The booking triggers keep slot status and achiever
-- stats (avg_rating, total_sessions) consistent automatically.
-- ============================================================================

do $$
declare
  men_a uuid := 'a0a00000-0000-4000-a000-000000000005';
  men_b uuid := 'a0a00000-0000-4000-a000-000000000006';
  stu_a uuid := 'a0a00000-0000-4000-a000-000000000002';
  stu_c uuid := 'a0a00000-0000-4000-a000-000000000004';

  base   timestamptz := date_trunc('hour', now());
  s1_at  timestamptz;  s2_at timestamptz;  s3_at timestamptz;
  slot1  bigint;  slot2 bigint;  slot3 bigint;
  book1  bigint;  book2 bigint;  book3 bigint;
begin
  -- ── Mentor A: open future availability slots ────────────────────────────
  insert into public.mentor_availability_slots (mentor_id, starts_at, ends_at, status) values
    (men_a, base + interval '2 days'  + interval '10 hours', base + interval '2 days'  + interval '11 hours', 'open'),
    (men_a, base + interval '4 days'  + interval '14 hours', base + interval '4 days'  + interval '15 hours', 'open'),
    (men_a, base + interval '7 days'  + interval '9 hours',  base + interval '7 days'  + interval '10 hours', 'open');

  -- ── Mentor B: open future availability slots ────────────────────────────
  insert into public.mentor_availability_slots (mentor_id, starts_at, ends_at, status) values
    (men_b, base + interval '1 day'   + interval '16 hours', base + interval '1 day'   + interval '17 hours', 'open'),
    (men_b, base + interval '3 days'  + interval '11 hours', base + interval '3 days'  + interval '12 hours', 'open'),
    (men_b, base + interval '6 days'  + interval '13 hours', base + interval '6 days'  + interval '14 hours', 'open'),
    (men_b, base + interval '9 days'  + interval '15 hours', base + interval '9 days'  + interval '16 hours', 'open');

  -- ── Past booking 1: Student A with Mentor A (reviewed, 5★) ──────────────
  s1_at := base - interval '10 days' + interval '14 hours';
  insert into public.mentor_availability_slots (mentor_id, starts_at, ends_at, status)
    values (men_a, s1_at, s1_at + interval '1 hour', 'booked')
    returning id into slot1;

  insert into public.bookings (
    applicant_id, achiever_id, scheduled_at, duration_mins,
    session_price_vnd, glowbal_fee_vnd, achiever_payout_vnd, status,
    currency, amount_total, amount_service_fee, amount_mentor, slot_id,
    payment_reference, payment_confirmed_at, meeting_link, applicant_notes,
    help_topic, help_questions, help_outcome
  ) values (
    stu_a, men_a, s1_at, 60,
    500000, 50000, 450000, 'reviewed',
    'VND', 500000, 50000, 450000, slot1,
    'UAT-PAY-0001', s1_at - interval '1 day', 'https://meet.glowbal-uat.test/0001',
    'Want feedback on my Cambridge personal statement draft.',
    'Personal statement review', 'How do I make my opening paragraph stand out?',
    'Advisor gave detailed line-by-line edits and structure tips.'
  ) returning id into book1;
  update public.mentor_availability_slots set booking_id = book1 where id = slot1;

  -- ── Past booking 2: Student C with Mentor A (completed, 4★) ─────────────
  s2_at := base - interval '4 days' + interval '11 hours';
  insert into public.mentor_availability_slots (mentor_id, starts_at, ends_at, status)
    values (men_a, s2_at, s2_at + interval '1 hour', 'booked')
    returning id into slot2;

  insert into public.bookings (
    applicant_id, achiever_id, scheduled_at, duration_mins,
    session_price_vnd, glowbal_fee_vnd, achiever_payout_vnd, status,
    currency, amount_total, amount_service_fee, amount_mentor, slot_id,
    payment_reference, payment_confirmed_at, meeting_link, applicant_notes,
    help_topic, help_questions, help_outcome
  ) values (
    stu_c, men_a, s2_at, 60,
    500000, 50000, 450000, 'completed',
    'VND', 500000, 50000, 450000, slot2,
    'UAT-PAY-0002', s2_at - interval '2 days', 'https://meet.glowbal-uat.test/0002',
    'General advice on the BBA interview.',
    'Interview prep', 'What kinds of questions should I expect?',
    'Walked through common interview questions and a STAR-format answer.'
  ) returning id into book2;
  update public.mentor_availability_slots set booking_id = book2 where id = slot2;

  -- ── Future booking 3: Student A with Mentor A (confirmed/upcoming) ──────
  s3_at := base + interval '5 days' + interval '15 hours';
  insert into public.mentor_availability_slots (mentor_id, starts_at, ends_at, status)
    values (men_a, s3_at, s3_at + interval '1 hour', 'open')
    returning id into slot3;

  -- Inserting with status 'confirmed' fires trg_sync_slot_status, which flips
  -- the linked slot to 'booked' and stamps booking_id automatically.
  insert into public.bookings (
    applicant_id, achiever_id, scheduled_at, duration_mins,
    session_price_vnd, glowbal_fee_vnd, achiever_payout_vnd, status,
    currency, amount_total, amount_service_fee, amount_mentor, slot_id,
    payment_reference, payment_confirmed_at, meeting_link, applicant_notes,
    help_topic, help_questions
  ) values (
    stu_a, men_a, s3_at, 60,
    500000, 50000, 450000, 'confirmed',
    'VND', 500000, 50000, 450000, slot3,
    'UAT-PAY-0003', now(), 'https://meet.glowbal-uat.test/0003',
    'Mock technical interview for Cambridge CS.',
    'Mock interview', 'Can we do a timed problem-solving run-through?'
  ) returning id into book3;

  -- ── Reviews (fire trg_update_achiever_stats → recompute mentor A rating) ─
  insert into public.session_reviews (booking_id, reviewer_id, achiever_id, rating, comment, is_visible) values
    (book1, stu_a, men_a, 5, 'Incredibly helpful — my personal statement is so much stronger now. Highly recommend!', true),
    (book2, stu_c, men_a, 4, 'Really useful interview practice and clear, actionable feedback.', true);
end $$;

-- ============================================================================
-- SECTION 14 — MAILING LISTS: NEWSLETTER + WAITLIST
-- ============================================================================

insert into public.newsletter_subscriptions (
  email, first_name, status, source, topics, frequency
) values
  ('tester.student.a@glowbal-uat.test', 'An',   'active',       'website',  array['UK','Computer Science'], 'weekly'),
  ('tester.student.c@glowbal-uat.test', 'Chi',  'active',       'onboarding', array['Vietnam','Business'],  'immediate'),
  ('lead.unsubscribed@glowbal-uat.test','Sam',  'unsubscribed', 'website',  array['Scholarships'],          'weekly'),
  ('lead.weekly@glowbal-uat.test',      'Linh', 'active',       'guide',    array['Australia','Data Science'], 'weekly'),
  ('lead.daily@glowbal-uat.test',       'Minh', 'active',       'website',  array['Visa'],                  'daily');

-- Mark the unsubscribed row so the timestamp column is realistic.
update public.newsletter_subscriptions
set unsubscribed_at = now() - interval '3 days'
where email = 'lead.unsubscribed@glowbal-uat.test';

insert into public.waitlist_signups (email, first_name, notes, source) values
  ('waitlist.a@glowbal-uat.test', 'Hoa',  'Interested in UK undergraduate support.', 'website_waitlist'),
  ('waitlist.b@glowbal-uat.test', 'Tuan', 'Wants advising support for US applications.',  'website_waitlist'),
  ('waitlist.c@glowbal-uat.test', 'Ngoc', 'Asked about scholarship guidance.',      'website_waitlist');

-- ============================================================================
-- SECTION 15 — SUMMARY
-- ============================================================================

do $$
declare
  n_users int; n_apps int; n_bookings int; n_reviews int;
begin
  select count(*) into n_users    from auth.users where email like '%@glowbal-uat.test';
  select count(*) into n_apps     from public.course_applications where user_id in (
    'a0a00000-0000-4000-a000-000000000002','a0a00000-0000-4000-a000-000000000003','a0a00000-0000-4000-a000-000000000004');
  select count(*) into n_bookings from public.bookings where applicant_id in (
    'a0a00000-0000-4000-a000-000000000002','a0a00000-0000-4000-a000-000000000004');
  select count(*) into n_reviews  from public.session_reviews where achiever_id = 'a0a00000-0000-4000-a000-000000000005';

  raise notice 'Glowbal UAT seed complete:';
  raise notice '  % test accounts  | % applications | % bookings | % reviews', n_users, n_apps, n_bookings, n_reviews;
  raise notice '  Sign in with any tester.*@glowbal-uat.test  /  password: GlowbalUAT!2026';
end $$;

-- Final result grid: the accounts you can log in with.
select
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  case
    when sp.is_admin then 'admin'
    when ap.id is not null then 'mentor'
    when sp.user_id is not null then 'student'
    else 'unknown'
  end as role,
  'GlowbalUAT!2026' as password
from auth.users u
left join public.student_profiles  sp on sp.user_id = u.id
left join public.achiever_profiles ap on ap.id = u.id
where u.email like '%@glowbal-uat.test'
order by role, u.email;

-- ============================================================================
-- END OF UAT SEED
-- ============================================================================
