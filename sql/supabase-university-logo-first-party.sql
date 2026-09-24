-- ─────────────────────────────────────────────────────────────────────────────
-- Rewrite stored Google favicon URLs to the first-party proxy path.
--
-- WHY. `src/lib/wiki-images.ts` used to fall back to
-- `https://www.google.com/s2/favicons?sz=128&domain=<d>` when a university had
-- no Wikidata logo claim, and that URL was persisted into `logo_url`. Those
-- rows are rendered by plain `<img>` tags, so every student loading such a card
-- made their browser call www.google.com: a third-party request carrying their
-- IP and our Referer, fired before the cookie banner is answered and regardless
-- of what they answered. The resolver now emits `/api/university-logo?domain=…`
-- (proxied server-side); this brings already-stored rows onto the same path.
--
-- SCOPE IS `public.universities` ONLY, AND THAT IS MEASURED, NOT ASSUMED.
-- An earlier draft of this file also updated `public.course_applications`,
-- because `sql/supabase-apply-system.sql` declares `logo_url text` in its
-- CREATE TABLE. It failed with 42703: that column does not exist on the live
-- table. The CREATE was `if not exists` against a table that already existed,
-- so the column was never added, and nothing needs it — `/apply` reads the
-- crest by joining `universities(logo_url)` (see src/app/apply/page.tsx). Live
-- enumeration on 2026-09-08 found `logo_url` on exactly one table: universities.
-- Do not re-add the second UPDATE on the strength of the .sql file.
--
-- Idempotent: the WHERE clause only matches the old google.com form, so
-- re-running it is a no-op. Safe to run while the app is live — the proxy route
-- accepts exactly the domains this extracts.
--
-- Rows whose URL carries no parseable `domain=` parameter are left alone rather
-- than rewritten to a broken path; they are counted in the notice at the end so
-- a non-zero remainder is visible instead of silent.
--
-- Expected effect when first run: 3 rows (ids 27 ed.ac.uk, 48 u-tokyo.ac.jp,
-- 96 unibocconi.it), measured 2026-09-08.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

update public.universities
   set logo_url = '/api/university-logo?domain=' || substring(logo_url from 'domain=([^&]+)')
 where logo_url like 'https://www.google.com/s2/favicons%'
   and substring(logo_url from 'domain=([^&]+)') is not null;

do $$
declare
  rewritten int;
  leftover  int;
begin
  select count(*) into rewritten
    from public.universities
   where logo_url like '/api/university-logo?domain=%';
  select count(*) into leftover
    from public.universities
   where logo_url like 'https://www.google.com/s2/favicons%';

  raise notice 'universities on the proxy path: %; unparseable google rows left: %',
    rewritten, leftover;
end $$;

commit;
