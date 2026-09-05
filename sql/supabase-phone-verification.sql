-- ============================================================================
-- GLOWBAL — PHONE VERIFICATION + MARKETING CAPTURE
-- Run this in the Supabase SQL Editor after supabase-schema.sql and
-- supabase-profile-extensions.sql (which already adds student_profiles.phone).
-- Safe to re-run: every column guard uses `add column if not exists`.
--
-- WHAT THIS SUPPORTS
--   A second layer of protection at sign-up: after email + password the user
--   verifies a phone number via SMS one-time code (Supabase native phone OTP).
--   The verified number is also captured for marketing (implicit consent — the
--   act of providing + verifying the number records consent).
--
-- REQUIRED SUPABASE DASHBOARD SETTINGS (not SQL — configure once):
--   • Authentication → Providers → Phone: enable, and configure an SMS
--     provider (Twilio / MessageBird / Vonage / Twilio Verify).
--   • Authentication → Providers → Phone → "Enable phone confirmations": ON.
--   • For the inline, strictly-required phone gate to work right after sign-up,
--     the client needs a session to attach the phone (auth.updateUser +
--     verifyOtp type: 'phone_change'). If "Confirm email" is ON the user has no
--     session until they click the email link, so the app falls back to the
--     email-confirmation screen in that case.
-- ============================================================================

alter table public.student_profiles
  -- phone already exists (supabase-profile-extensions.sql); these track the
  -- verification + marketing state around it.
  add column if not exists phone_verified       boolean not null default false,
  add column if not exists phone_verified_at     timestamptz,
  add column if not exists marketing_consent     boolean not null default false,
  add column if not exists marketing_consent_at  timestamptz,
  -- How consent was obtained, for auditability (e.g. 'signup_phone_implicit').
  add column if not exists marketing_consent_source text;

-- Fast lookup of who still needs to verify (e.g. a re-prompt job) and of
-- marketing-reachable numbers.
create index if not exists idx_student_profiles_phone_verified
  on public.student_profiles(phone_verified);
create index if not exists idx_student_profiles_marketing_consent
  on public.student_profiles(marketing_consent);
