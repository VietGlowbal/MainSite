-- ============================================================================
-- SAVED PROGRAM — the subject a student picked for a saved university
-- ============================================================================
-- Backs the "Ngành …" line and the "Chọn lại ngành tại đây" link on each row of
-- the saved list (Figma 375:12701, and the re-picker 375:13546).
--
-- WHY A COLUMN AND NOT A TABLE. The design shows exactly one subject per saved
-- university, chosen and re-chosen in place — the same cardinality as `status`
-- and `match_score`, which already live on this row. A join table would only pay
-- for itself if a student could shortlist the same university twice under
-- different subjects, and `unique (user_id, university_id)` says they cannot.
--
-- `program_url` is separate from `program` on purpose. The picker's fallback is
-- "paste a link to the course" for subjects our directory does not list, so the
-- two carry different kinds of claim: `program` is a label we can render, and
-- `program_url` is a page the student found. One of them being present does not
-- imply the other.
--
-- Run this in the Supabase SQL editor (the repo applies .sql files by hand).
--
-- ⚠️ Until it is run, the saved list still renders — the read is `select *` and
-- treats both fields as absent, and the re-picker reports that the column is
-- missing rather than silently discarding the student's choice. See
-- docs/known-issues.md §0 for why that guard exists: `ADD COLUMN IF NOT EXISTS`
-- matches names and never types, so a wrong column can never be repaired by
-- re-running a file.

alter table public.user_universities
  add column if not exists program text,
  add column if not exists program_url text;

comment on column public.user_universities.program is
  'Subject/programme the student chose for this saved university. Free text: it comes from universities.strengths, from the VinUni college catalogue, or from a link the student pasted.';

comment on column public.user_universities.program_url is
  'Course page the student pasted when the directory did not list their subject. Not validated beyond being http(s).';

-- No RLS change needed: "Users manage own university list" in supabase-schema.sql
-- is `for all` on the row, so it already covers these columns.
