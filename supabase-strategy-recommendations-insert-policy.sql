-- AI Strategy Dashboard — application_recommendations is missing an INSERT
-- policy, which blocks every recommendation the Dashboard ever tries to save.
--
-- FOUND FROM A LIVE BUG REPORT: the Dashboard showed "We couldn't refresh
-- your recommendations just now" and an empty table for every student, even
-- ones with a completed Course Match Analysis.
--
-- ROOT CAUSE. `supabase-apply-v2.sql` enabled RLS on
-- `application_recommendations` (line ~601) and added a SELECT policy and an
-- UPDATE policy, but never an INSERT policy:
--
--   CREATE POLICY "Users can view recommendations for their applications" ...
--   CREATE POLICY "Users can update recommendations for their applications" ...
--   -- no INSERT policy
--
-- Postgres RLS defaults to deny for any operation with no matching policy.
-- `generateRecommendations` (src/features/ai-strategy-dashboard/api/generate-recommendations.ts)
-- runs on the request-scoped, RLS-respecting client
-- (`await createClient()` from `@/lib/supabase/server`), so its
-- `.insert(plan.toInsert...)` call has been rejected by RLS since the
-- feature shipped (#112) — reads and updates of *existing* rows worked
-- (hence the sidebar-tips feature and recommendation status changes were
-- never seen to fail), but no student could ever get a first recommendation
-- row created. This is why the Dashboard read as "AI matching completely
-- broken/empty": the table was never populated in the first place.
--
-- This migration only adds the missing policy. It does not touch existing
-- rows, columns, or the SELECT/UPDATE policies.
--
-- Run this in the Supabase SQL editor. If `supabase-strategy-recommendation-fields.sql`
-- (adding `estimated_impact`, `pillar`, `source_analysis_id`, `archived_at`)
-- has not been run yet either, run that one first — `generateRecommendations`
-- also selects those columns and will fail with "Could not find the '...'
-- column" (PGRST204) until it has.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_recommendations'
      AND policyname = 'Users can insert recommendations for their applications'
  ) THEN
    CREATE POLICY "Users can insert recommendations for their applications"
      ON public.application_recommendations
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE id = application_recommendations.application_id
          AND user_id = auth.uid()
        )
      );
  END IF;
END $$;
