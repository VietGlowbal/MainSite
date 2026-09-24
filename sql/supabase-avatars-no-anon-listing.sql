-- ─────────────────────────────────────────────────────────────────────────────
-- Stop anyone holding the public anon key from LISTING the `avatars` bucket.
--
-- WHY. `sql/supabase-missing-tables.sql` created
--
--     create policy "Anyone can read avatars" on storage.objects for select
--       to public using (bucket_id = 'avatars');
--
-- to make avatars "public read". Reading never needed it: `avatars` is a PUBLIC
-- bucket, and `/storage/v1/object/public/avatars/...` — what `getPublicUrl`
-- returns and what every <img> renders — is served without consulting RLS.
-- Measured 2026-09-14: an anonymous request for a `mockmentors/` file with no
-- apikey and no Authorization header answers 200 image/jpeg.
--
-- What the policy DID add is `POST /storage/v1/object/list/avatars`. With the
-- anon key it returns the bucket's top level; on 2026-09-14 that was 8 folders,
-- 6 of them UUIDs. Those UUIDs are auth user ids by construction — the
-- "Authenticated users upload avatars" policy only admits
-- `(storage.foldername(name))[1] = auth.uid()::text`. This is the user-id
-- enumeration the 21/08 Beta Product Review reported and that
-- docs/known-issues.md §0g says to assume is available.
--
-- WHY IT IS REPLACED, NOT JUST DROPPED. `MentorSignupForm.uploadAvatar` uploads
-- with `upsert: true`, and Supabase Storage requires SELECT and UPDATE (on top
-- of INSERT) for upsert. Dropping the SELECT policy outright would break mentor
-- avatar upload. The replacement is owner-scoped, the same shape as
-- "Users read own documents" / "Mentor reads own documents" in
-- supabase-critical-security-hardening-2026-09-08.sql: a signed-in user can see
-- and overwrite their own folder, and nobody can list anyone else's.
--
-- NOT AFFECTED: public avatar URLs already stored in profile rows; writers that
-- use the service role (`mockmentors/`, `universities_image/`), which bypasses
-- RLS.
--
-- Idempotent. Safe to run while the app is live.
--
-- VERIFY AFTER RUNNING — both with the anon key:
--   POST <SUPABASE_URL>/storage/v1/object/list/avatars  body {"prefix":""}
--     expect 200 []            (was 8 entries)
--   GET  <SUPABASE_URL>/storage/v1/object/public/avatars/mockmentors/<any file>
--     expect 200 image/*       (unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

drop policy if exists "Anyone can read avatars" on storage.objects;

drop policy if exists "Users read own avatars" on storage.objects;
create policy "Users read own avatars"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
