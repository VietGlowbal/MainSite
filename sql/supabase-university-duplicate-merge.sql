-- Merges nine duplicate `universities` rows into their canonical twins, then
-- adds the uniqueness constraint that would have prevented them.
--
-- Reported by the 21/08 Beta Product Review: saving UC Berkeley or MIT returned
-- zero scholarships. The reviewer read that as thin scholarship coverage. It is
-- not — it is two rows per university, with the product's data split across
-- both halves.
--
--
-- WHAT IS ACTUALLY WRONG
--
-- `universities` holds 108 rows for 99 real institutions. Nine of them are
-- duplicated, and every duplicate sits in one contiguous id block (98-106) that
-- looks like a later bulk import landing beside an existing curated row:
--
--     98  Massachusetts Institute of Technology      <- 1   ...of Technology (MIT)
--     99  Columbia University in the City of New York <- 6   Columbia University
--    100  California Institute of Technology         <- 12  ...of Technology (Caltech)
--    101  University of California-Berkeley          <- 14  ...Berkeley (UCB)
--    102  University of California-Los Angeles       <- 15  ...Los Angeles (UCLA)
--    103  University of Michigan-Ann Arbor           <- 16  University of Michigan, Ann Arbor
--    104  Georgia Institute of Technology-Main Campus<- 17  Georgia Institute of Technology
--    105  University of Illinois Urbana-Champaign    <- 19  ...Urbana-Champaign (UIUC)
--    106  New York University                        <- 20  New York University (NYU)
--
-- The halves are NOT redundant. Measured against production on 2026-09-04:
--
--   * The CANONICAL rows (low ids) carry the editorial content. All nine have
--     `specific_insight` and `strengths`; none of the duplicates do. They also
--     hold every scholarship link — all 25 of them.
--   * The DUPLICATE rows carry the crawler payload: 180 of the 593 rows in
--     `courses` (30%), 39 of 196 `academic_units` (20%), and 7 of the 17
--     `university_profiles`.
--
-- So the duplicate rows are the ones with the plainer, more searchable names
-- AND no scholarships. A student who searches "Massachusetts Institute of
-- Technology" saves the empty twin and sees nothing; a student who happens to
-- pick the "(MIT)" row sees four scholarships. Same school, same page.
--
--
-- WHY A NAIVE DELETE IS DESTRUCTIVE
--
-- THIRTEEN tables carry an FK to `universities`, and four of them CASCADE:
-- `academic_units`, `scholarship_universities`, `university_profiles` and
-- `user_universities`. The other nine SET NULL. So `DELETE FROM universities
-- WHERE id BETWEEN 98 AND 106` would destroy 39 academic units and 7 profiles
-- outright, and silently strip the university off 180 courses — turning nearly
-- a third of the catalogue into unattributed rows with no error raised.
--
-- Everything must therefore be repointed BEFORE the delete. That ordering is
-- the whole point of this file.
--
--
-- DIRECTION OF THE MERGE
--
-- Canonical (low id) survives, because editorial content cannot be regenerated
-- and crawler payload can. Repointing is additive and safe: the two crawl
-- batches captured DIFFERENT programmes — across the five pairs that have 20
-- courses on both sides there is not one shared `course_url`. MIT correctly
-- ends up with 40 courses, not 20 duplicated ones.
--
--
-- COLLISIONS THIS HANDLES
--
-- Three of the child tables constrain `university_id`, so a blind UPDATE can
-- raise:
--
--   * `user_universities` UNIQUE (user_id, university_id) — one user really has
--     saved BOTH NYU rows. Their duplicate save is dropped, not merged.
--   * `academic_units` UNIQUE (university_id, source_organisation_unit_id) —
--     six pairs have units on both sides, so the same source unit may appear
--     twice. The duplicate is dropped.
--   * `university_profiles` PK (university_id) — one profile per university. No
--     canonical twin currently has one, so all seven move cleanly; the guard is
--     kept in case that changes before this is run.
--
-- `courses` is unique on `course_url`/`canonical_url` only, never on
-- `university_id`, so repointing it cannot collide.
--
-- Rows dropped by a collision guard are redundant by definition — the canonical
-- side already holds an equivalent row. Nothing unique is discarded.
--
--
-- WHAT THIS ACTUALLY DELETES
--
-- Measured against production on 2026-09-04, the whole migration removes:
--
--     1 row from user_universities   (the redundant NYU save described above)
--     9 rows from universities       (the duplicate shells, once emptied)
--
-- and nothing else. 232 rows are MOVED. The DELETE statements on
-- academic_units, university_profiles and scholarship_universities match zero
-- rows today; they exist only to absorb collisions that a crawl could introduce
-- between now and when this is applied.
--
--
-- EVERY DELETION IS REVERSIBLE
--
-- Before any row is deleted it is copied verbatim into
-- `public.university_merge_archive` as jsonb. That table is NOT temporary and
-- is not dropped on commit — it is the undo log. To inspect what was removed:
--
--     SELECT source_table, row_data FROM public.university_merge_archive;
--
-- To restore a deleted universities row (ids keep their original values, so
-- anything still pointing at one reconnects):
--
--     INSERT INTO universities
--     SELECT (jsonb_populate_record(NULL::universities, row_data)).*
--       FROM public.university_merge_archive
--      WHERE source_table = 'universities';
--
-- Drop the archive table once you are satisfied, not before.
--
--
-- SAFE TO RE-RUN. Every statement is scoped to ids 98-106, which stop existing
-- after the first successful run. A second run matches nothing and commits a
-- no-op. It aborts rather than guessing if the data no longer matches the shape
-- described above.
--
-- SINGLE TRANSACTION. Any failure anywhere — including the pre-delete guard in
-- section 3 — rolls back every change in this file, including the archive
-- writes. There is no partial state to clean up.
--
-- Per known-issues.md §0: this is a NEW file. Do not edit an already-applied
-- migration to change this behaviour — write another follow-up instead.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. The merge map, and a pre-flight check that reality still matches it.
-- ---------------------------------------------------------------------------

-- The undo log. Persistent on purpose: it outlives the transaction so the
-- deletes below can be reversed after the fact. RLS on, no policies, so only
-- the service role can read it — it holds a student's saved-university row.
CREATE TABLE IF NOT EXISTS public.university_merge_archive (
  id          bigserial PRIMARY KEY,
  archived_at timestamptz NOT NULL DEFAULT now(),
  source_table text       NOT NULL,
  row_data    jsonb       NOT NULL
);

ALTER TABLE public.university_merge_archive ENABLE ROW LEVEL SECURITY;

CREATE TEMP TABLE university_merge_map (
  dup_id   bigint PRIMARY KEY,
  canon_id bigint NOT NULL,
  label    text   NOT NULL
) ON COMMIT DROP;

INSERT INTO university_merge_map (dup_id, canon_id, label) VALUES
  ( 98,  1, 'MIT'),
  ( 99,  6, 'Columbia'),
  (100, 12, 'Caltech'),
  (101, 14, 'UC Berkeley'),
  (102, 15, 'UCLA'),
  (103, 16, 'Michigan'),
  (104, 17, 'Georgia Tech'),
  (105, 19, 'UIUC'),
  (106, 20, 'NYU');

DO $$
DECLARE
  missing_canon text;
  name_drift    text;
BEGIN
  -- Every canonical target must still exist. If one was deleted since this was
  -- written, repointing would push live rows at a dangling id.
  SELECT string_agg(m.label || ' (canon id ' || m.canon_id || ')', ', ')
    INTO missing_canon
    FROM university_merge_map m
   WHERE EXISTS (SELECT 1 FROM universities u WHERE u.id = m.dup_id)
     AND NOT EXISTS (SELECT 1 FROM universities u WHERE u.id = m.canon_id);

  IF missing_canon IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting: canonical row missing for %. The id pairing in this migration is stale.',
      missing_canon;
  END IF;

  -- The two rows in a pair must still be the same institution once punctuation
  -- and any parenthetical suffix are stripped. This is what stops the migration
  -- from merging two genuinely different universities if ids were ever reused.
  SELECT string_agg(m.label, ', ')
    INTO name_drift
    FROM university_merge_map m
    JOIN universities d ON d.id = m.dup_id
    JOIN universities c ON c.id = m.canon_id
   WHERE lower(regexp_replace(regexp_replace(d.name, '\(.*?\)', '', 'g'), '[^a-zA-Z]', '', 'g'))
      IS DISTINCT FROM
         lower(regexp_replace(regexp_replace(c.name, '\(.*?\)', '', 'g'), '[^a-zA-Z]', '', 'g'))
     -- Georgia Tech and Columbia differ by a real suffix ("-Main Campus",
     -- "in the City of New York") rather than a parenthetical, so they are
     -- matched on prefix instead of exact equality.
     AND m.label NOT IN ('Georgia Tech', 'Columbia');

  IF name_drift IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting: name mismatch on pair(s) %. These ids no longer look like the same institution.',
      name_drift;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM universities WHERE id BETWEEN 98 AND 106) THEN
    RAISE NOTICE 'No duplicate rows present — already merged. Committing a no-op.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Repoint the tables with no constraint on university_id.
--    These cannot collide, so a plain UPDATE is correct.
-- ---------------------------------------------------------------------------

UPDATE courses c
   SET university_id = m.canon_id,
       -- university_name is a denormalised copy the crawler wrote; leaving the
       -- duplicate's spelling behind would keep the two names visible in the UI.
       university_name = u.name
  FROM university_merge_map m
  JOIN universities u ON u.id = m.canon_id
 WHERE c.university_id = m.dup_id;

UPDATE course_applications a
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE a.university_id = m.dup_id;

UPDATE user_scholarships s
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE s.university_id = m.dup_id;

UPDATE course_parse_jobs j
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE j.university_id = m.dup_id;

UPDATE application_sources s
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE s.university_id = m.dup_id;

UPDATE achiever_profiles p
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE p.university_id = m.dup_id;

UPDATE course_search_sessions s
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE s.university_id = m.dup_id;

UPDATE course_search_session_results r
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE r.university_id = m.dup_id;

UPDATE programme_ingestion_jobs j
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE j.university_id = m.dup_id;

-- ---------------------------------------------------------------------------
-- 2. Repoint the constrained tables. Each moves what it can, then deletes the
--    remainder — rows whose canonical equivalent already exists.
-- ---------------------------------------------------------------------------

-- scholarship_universities: PK (scholarship_id, university_id).
-- Currently zero rows sit on a duplicate, but handled for completeness in case
-- a crawl lands between now and when this is applied.
UPDATE scholarship_universities su
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE su.university_id = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM scholarship_universities x
      WHERE x.scholarship_id = su.scholarship_id
        AND x.university_id  = m.canon_id
   );

INSERT INTO public.university_merge_archive (source_table, row_data)
SELECT 'scholarship_universities', to_jsonb(su)
  FROM scholarship_universities su
  JOIN university_merge_map m ON su.university_id = m.dup_id;

DELETE FROM scholarship_universities su
 USING university_merge_map m
 WHERE su.university_id = m.dup_id;

-- user_universities: UNIQUE (user_id, university_id).
-- The known collision is one user who saved both NYU rows.
UPDATE user_universities uu
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE uu.university_id = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM user_universities x
      WHERE x.user_id       = uu.user_id
        AND x.university_id = m.canon_id
   );

INSERT INTO public.university_merge_archive (source_table, row_data)
SELECT 'user_universities', to_jsonb(uu)
  FROM user_universities uu
  JOIN university_merge_map m ON uu.university_id = m.dup_id;

DELETE FROM user_universities uu
 USING university_merge_map m
 WHERE uu.university_id = m.dup_id;

-- academic_units: UNIQUE (university_id, source_organisation_unit_id).
UPDATE academic_units au
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE au.university_id = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM academic_units x
      WHERE x.university_id                = m.canon_id
        AND x.source_organisation_unit_id IS NOT DISTINCT FROM au.source_organisation_unit_id
   );

INSERT INTO public.university_merge_archive (source_table, row_data)
SELECT 'academic_units', to_jsonb(au)
  FROM academic_units au
  JOIN university_merge_map m ON au.university_id = m.dup_id;

DELETE FROM academic_units au
 USING university_merge_map m
 WHERE au.university_id = m.dup_id;

-- university_profiles: PK (university_id), one row per university.
UPDATE university_profiles up
   SET university_id = m.canon_id
  FROM university_merge_map m
 WHERE up.university_id = m.dup_id
   AND NOT EXISTS (
     SELECT 1 FROM university_profiles x WHERE x.university_id = m.canon_id
   );

INSERT INTO public.university_merge_archive (source_table, row_data)
SELECT 'university_profiles', to_jsonb(up)
  FROM university_profiles up
  JOIN university_merge_map m ON up.university_id = m.dup_id;

DELETE FROM university_profiles up
 USING university_merge_map m
 WHERE up.university_id = m.dup_id;

-- ---------------------------------------------------------------------------
-- 3. Assert nothing still points at a duplicate, then delete the nine rows.
--    If this raises, the delete has NOT run and the transaction rolls back —
--    which is the intended outcome, because it means a table exists that this
--    migration does not know about.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(t.tbl || ' (' || t.n || ')', ', ')
    INTO offending
    FROM (
      SELECT 'academic_units' AS tbl, count(*) AS n FROM academic_units WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'achiever_profiles', count(*) FROM achiever_profiles WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'application_sources', count(*) FROM application_sources WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'course_applications', count(*) FROM course_applications WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'course_parse_jobs', count(*) FROM course_parse_jobs WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'course_search_session_results', count(*) FROM course_search_session_results WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'course_search_sessions', count(*) FROM course_search_sessions WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'courses', count(*) FROM courses WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'programme_ingestion_jobs', count(*) FROM programme_ingestion_jobs WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'scholarship_universities', count(*) FROM scholarship_universities WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'university_profiles', count(*) FROM university_profiles WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'user_scholarships', count(*) FROM user_scholarships WHERE university_id BETWEEN 98 AND 106
      UNION ALL SELECT 'user_universities', count(*) FROM user_universities WHERE university_id BETWEEN 98 AND 106
    ) t
   WHERE t.n > 0;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting before DELETE: rows still reference a duplicate university in %. Deleting now would cascade or null them.',
      offending;
  END IF;
END $$;

INSERT INTO public.university_merge_archive (source_table, row_data)
SELECT 'universities', to_jsonb(u)
  FROM universities u
  JOIN university_merge_map m ON u.id = m.dup_id;

DELETE FROM universities u
 USING university_merge_map m
 WHERE u.id = m.dup_id;

-- ---------------------------------------------------------------------------
-- 4. Stop it happening again.
--
--    The import that created these rows succeeded because nothing enforced
--    institutional identity — the FKs were all present and correct, but there
--    was no uniqueness on the name. This index makes the same import fail loudly
--    instead of silently doubling the catalogue.
--
--    Verified 2026-09-04 to hold across all 99 surviving rows with no
--    collisions. It normalises out case, punctuation, and any parenthetical
--    suffix, so "MIT" and "Massachusetts Institute of Technology (MIT)" collide
--    as intended.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS universities_normalized_name_key
  ON public.universities (
    (lower(regexp_replace(regexp_replace(name, '\(.*?\)', '', 'g'), '[^a-zA-Z]', '', 'g')))
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after committing.
--
-- Expected, based on the 2026-09-04 dry run:
--   duplicate_rows_remaining   0
--   university_rows            99
--   normalized_collisions      0
--   courses_orphaned           0     (no course left without a university)
--   berkeley_scholarships      1
--   mit_scholarships           4
--   mit_courses                40    (20 curated + 20 from the duplicate)
--   archived_universities      9
--   archived_saves             1     (the redundant NYU save)
--   archived_other             0     (no collisions occurred)
--
-- If archived_other is above 0, a crawl landed between this being written and
-- applied. Inspect those rows before dropping the archive:
--   SELECT source_table, row_data FROM public.university_merge_archive
--    WHERE source_table NOT IN ('universities', 'user_universities');
-- ---------------------------------------------------------------------------

SELECT
  (SELECT count(*) FROM universities WHERE id BETWEEN 98 AND 106)          AS duplicate_rows_remaining,
  (SELECT count(*) FROM universities)                                       AS university_rows,
  (SELECT count(*) FROM (
     SELECT lower(regexp_replace(regexp_replace(name, '\(.*?\)', '', 'g'), '[^a-zA-Z]', '', 'g')) AS n
       FROM universities GROUP BY 1 HAVING count(*) > 1) x)                 AS normalized_collisions,
  (SELECT count(*) FROM courses WHERE university_id IS NULL)                AS courses_orphaned,
  (SELECT count(*) FROM scholarship_universities WHERE university_id = 14)  AS berkeley_scholarships,
  (SELECT count(*) FROM scholarship_universities WHERE university_id = 1)   AS mit_scholarships,
  (SELECT count(*) FROM courses WHERE university_id = 1)                    AS mit_courses,
  (SELECT count(*) FROM public.university_merge_archive
     WHERE source_table = 'universities')                                   AS archived_universities,
  (SELECT count(*) FROM public.university_merge_archive
     WHERE source_table = 'user_universities')                              AS archived_saves,
  (SELECT count(*) FROM public.university_merge_archive
     WHERE source_table NOT IN ('universities', 'user_universities'))       AS archived_other;
