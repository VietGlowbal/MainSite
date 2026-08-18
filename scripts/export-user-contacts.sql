-- Export user contact details: name · date of birth · phone · email
--
-- READ-ONLY. This is not a migration — do not add it to a migration runner.
-- Run in the Supabase SQL Editor (or psql with the service role); `auth.users`
-- is not reachable through PostgREST/the JS client, so this cannot run from
-- app code.
--
-- Where each field actually lives (verified against the live DB, 2026-08-17):
--   email        auth.users.email             (raw_user_meta_data->>'email' as fallback for OAuth rows)
--   name         auth.users.raw_user_meta_data->>'full_name'   -- written by the signup form
--                ->>'name' is the Google OAuth spelling
--   phone        student_profiles.phone       -- primary; auth.users.phone only set for SMS auth,
--                                                raw_user_meta_data->>'phone' is the pre-callback copy
--   date_of_birth student_profiles.date_of_birth (date)
--                                                raw_user_meta_data->>'date_of_birth' is the pre-callback copy
--
-- src/app/auth/callback/route.ts copies phone + date_of_birth from auth metadata
-- into student_profiles on first login, but only when the profile field is still
-- empty — so metadata can hold a value the profile never received. Every column
-- below coalesces profile first, then metadata, to avoid dropping those rows.
--
-- Measured coverage, 2026-08-17 (re-run query 3 for current numbers):
--   409 auth users · 233 student_profiles rows -> 176 users have NO profile row.
--     The LEFT JOIN is load-bearing; an INNER JOIN silently drops 43% of users.
--   email 409/409 · full_name 409/409 (all via raw_user_meta_data)
--   phone: 16 on student_profiles, 63 on auth metadata, 0 on auth.users.phone.
--     Most phone numbers only exist in metadata — the callback backfill ran for
--     a minority of accounts. Reading student_profiles.phone alone loses ~3/4
--     of them. auth.users.phone is empty everywhere (no SMS auth in use); it is
--     kept in the coalesce as a harmless guard.
--   date_of_birth: 15 on student_profiles, 59 on auth metadata, 1 row with age
--     but no DOB.
--   So: DOB and phone are sparse (~15% of users). Expect mostly NULLs.
--
-- These numbers should climb from 2026-08-17: /auth/complete-profile now holds
-- any signed-in student missing phone or date_of_birth until they fill them in,
-- and it writes to student_profiles directly rather than via auth metadata. The
-- metadata fallbacks above stay for the accounts created before that date.
--
-- PII: output contains personal data. Do not commit result files, paste into
-- tickets, or send through third-party tools.


-- ---------------------------------------------------------------------------
-- 1. Main export — one row per user
-- ---------------------------------------------------------------------------
select
  au.id                                                   as user_id,

  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), '')
  )                                                       as full_name,

  coalesce(
    sp.date_of_birth,
    case
      when au.raw_user_meta_data ->> 'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}$'
        then (au.raw_user_meta_data ->> 'date_of_birth')::date
    end
  )                                                       as date_of_birth,

  coalesce(
    nullif(trim(sp.phone), ''),
    nullif(trim(au.phone), ''),
    nullif(trim(au.raw_user_meta_data ->> 'phone'), '')
  )                                                       as phone,

  coalesce(
    nullif(trim(au.email), ''),
    nullif(trim(au.raw_user_meta_data ->> 'email'), '')
  )                                                       as email,

  -- context columns — drop the ones you don't need
  sp.age                                                  as self_reported_age,
  sp.country,
  sp.location,
  sp.nationality,
  sp.study_level,
  sp.onboarding_completed,
  sp.plus_status,
  sp.marketing_consent,
  sp.phone_verified,
  (au.email_confirmed_at is not null)                     as email_verified,
  au.created_at                                           as signed_up_at,
  au.last_sign_in_at
from auth.users au
left join public.student_profiles sp on sp.user_id = au.id
where au.deleted_at is null           -- exclude soft-deleted accounts
  and au.is_anonymous is not true     -- exclude anonymous sessions
order by au.created_at desc;


-- ---------------------------------------------------------------------------
-- 2. Variants — uncomment the WHERE fragment you need in query 1
-- ---------------------------------------------------------------------------
--   Marketing-consented only:      and sp.marketing_consent is true
--   Has a usable phone number:     and coalesce(nullif(trim(sp.phone), ''), nullif(trim(au.phone), '')) is not null
--   Completed onboarding:          and sp.onboarding_completed is true
--   Signed up in the last 30 days: and au.created_at >= now() - interval '30 days'
--   Paying users:                  and sp.plus_status is true
--   Exclude staff/test accounts:   and au.email not ilike '%@glowbal%'


-- ---------------------------------------------------------------------------
-- 3. Completeness check — how much of this data actually exists
-- ---------------------------------------------------------------------------
-- Run this before promising a field to anyone; a column existing is not the
-- same as it being populated.
select
  count(*)                                                          as total_users,
  count(au.email)                                                   as has_email,
  count(nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''))    as has_full_name,
  -- Same coalesce as query 1, metadata fallback included. Counting only
  -- sp.phone/au.phone here would report ~16 while the export returns ~63.
  count(coalesce(
    nullif(trim(sp.phone), ''),
    nullif(trim(au.phone), ''),
    nullif(trim(au.raw_user_meta_data ->> 'phone'), '')
  ))                                                                as has_phone,
  count(coalesce(
    sp.date_of_birth,
    case
      when au.raw_user_meta_data ->> 'date_of_birth' ~ '^\d{4}-\d{2}-\d{2}$'
        then (au.raw_user_meta_data ->> 'date_of_birth')::date
    end
  ))                                                                as has_dob,
  count(sp.date_of_birth)                                           as has_dob_on_profile,
  count(sp.age)                                                     as has_age_only,
  count(sp.user_id)                                                 as has_profile_row
from auth.users au
left join public.student_profiles sp on sp.user_id = au.id
where au.deleted_at is null
  and au.is_anonymous is not true;


-- ---------------------------------------------------------------------------
-- 4. CSV export (psql only — the SQL Editor has its own Download CSV button)
-- ---------------------------------------------------------------------------
-- \copy (<paste query 1 here, without the trailing semicolon>) to 'users.csv' with (format csv, header)
