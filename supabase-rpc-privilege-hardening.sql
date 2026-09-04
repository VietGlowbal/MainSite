-- Removes `anon` and `authenticated` EXECUTE on five admin RPCs, and pins
-- search_path on every SECURITY DEFINER function that was missing it.
--
-- Found 2026-09-04 while auditing the system after the 21/08 Beta Product
-- Review. The review did not find this — its section 5.2 tested table reads and
-- writes and correctly concluded RLS was holding. It never enumerated RPCs, and
-- RPCs are the hole: a SECURITY DEFINER function runs as its owner and does NOT
-- consult RLS, so an anon-executable one is a direct bypass of every policy the
-- review verified.
--
--
-- THE THREE THAT MATTER
--
-- All three are SECURITY DEFINER, EXECUTE-able by `anon`, and contain NO
-- authorization check whatsoever — not one reference to `auth.uid()`:
--
--   get_user_entitlement(target_user_id uuid)
--     Returns any named user's plan, course_search_limit, course_add_limit and
--     billing window. Cross-user information disclosure, callable by anyone
--     holding the publishable anon key — which ships in the client bundle by
--     design.
--
--   reset_billing_period(target_user_id uuid)
--     Resets any named user's billing window to the current month.
--
--   reset_all_billing_periods()
--     Does the same for every user whose period has expired, in one call.
--
-- The last two are a monetization bypass, not just a data problem: the billing
-- window is what makes a usage limit expire. Anyone who can reset their own
-- window on demand has uncapped `course_search_limit` and `course_add_limit`
-- for free, and anyone can reset everyone else's.
--
-- ⚠️ There is a plausible chain to the uuid these need. The review recorded that
-- the public `avatars` bucket lists 8 UUID-named objects to an unauthenticated
-- caller. Whether or not those are auth user ids today, treat user-id
-- enumeration as available and do not rely on the uuid being secret.
--
--
-- TWO MORE, LOWER IMPACT, REVOKED FOR THE SAME REASON
--
--   cleanup_expired_idempotency_keys()   deletes expired idempotency keys
--   cleanup_stale_search_sessions()      deletes stale search sessions
--
-- Both are maintenance jobs that DELETE rows and neither should ever have been
-- reachable from a browser.
--
--
-- WHAT IS *NOT* WRONG, so nobody re-opens it
--
--   * Five of the eleven functions the Supabase linter flags as
--     anon-executable are TRIGGER functions — create_user_entitlements,
--     sync_entitlements_from_profile, sync_billing_period_from_profile,
--     consume_activity_follow_up_question, update_achiever_stats. PostgREST
--     does not expose a function returning `trigger`, so they are not callable
--     over the API and the EXECUTE grant on them is inert. They are left alone
--     apart from the search_path fix below.
--
--   * confirm_application_candidate_snapshot is CORRECT and is the model to
--     copy: it reads `auth.uid()`, raises 42501 when it is NULL, scopes every
--     statement to `user_id = auth.uid()`, and already pins search_path. It is
--     untouched.
--
--
-- NO APPLICATION CODE CALLS ANY OF THE FIVE. Verified across the repo on
-- 2026-09-04: the only callers are scripts/check-migrations.mjs and
-- scripts/verify-phase1-checkpoint.mjs, and both authenticate with
-- SUPABASE_SERVICE_ROLE_KEY, which these REVOKEs do not touch. Nothing in the
-- product breaks.
--
-- If a signed-in user ever needs their OWN entitlement from the client, do NOT
-- re-grant this function. Add the check the function is missing —
-- `IF target_user_id <> auth.uid() THEN RAISE EXCEPTION ... END IF;` — and
-- grant only `authenticated`.
--
--
-- SAFE TO RE-RUN. REVOKE on an already-revoked privilege is a no-op, and
-- ALTER FUNCTION ... SET search_path is idempotent.
--
-- Per known-issues.md §0: this is a NEW file. Do not edit an already-applied
-- migration to change this behaviour — write another follow-up instead.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Revoke browser-reachable EXECUTE on the admin and maintenance RPCs.
--
--    `service_role` is deliberately not mentioned: it keeps its grant, which is
--    what the two verification scripts and any future cron use.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.get_user_entitlement(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_billing_period(uuid)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_all_billing_periods()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_search_sessions()   FROM anon, authenticated;

-- Revoke from PUBLIC too. A grant to PUBLIC would otherwise hand the privilege
-- straight back to anon, and `GRANT ... TO PUBLIC` is the default for new
-- functions unless the creating migration said otherwise.
REVOKE EXECUTE ON FUNCTION public.get_user_entitlement(uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_billing_period(uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_all_billing_periods()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_search_sessions()   FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Pin search_path on every SECURITY DEFINER function that lacked it.
--
--    A SECURITY DEFINER function with a mutable search_path resolves its
--    unqualified object references against whatever the CALLER's search_path
--    says — so a caller who can create an object in an earlier schema can make
--    the function run their code with the definer's privileges. The trigger
--    functions are included: they are not callable over the API, but they still
--    execute as the definer on every write to their table.
--
--    `public, pg_temp` rather than `''`: these bodies reference tables both
--    schema-qualified and bare, and an empty path would break the bare ones.
--    pg_temp is listed last so a temp object cannot shadow a real one.
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.get_user_entitlement(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_billing_period(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_all_billing_periods()             SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_idempotency_keys()      SET search_path = public, pg_temp;
ALTER FUNCTION public.create_user_entitlements()              SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_entitlements_from_profile()        SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_billing_period_from_profile()      SET search_path = public, pg_temp;
ALTER FUNCTION public.update_achiever_stats()                 SET search_path = public, pg_temp;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION — run after committing.
--
-- Expected:
--   anon_executable_admin_rpcs        0
--   authed_executable_admin_rpcs      0
--   secdef_without_search_path        0
--   service_role_still_has_access     5
-- ---------------------------------------------------------------------------

WITH targets AS (
  SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('get_user_entitlement', 'reset_billing_period',
                       'reset_all_billing_periods', 'cleanup_expired_idempotency_keys',
                       'cleanup_stale_search_sessions')
)
SELECT
  (SELECT count(*) FROM targets WHERE has_function_privilege('anon', oid, 'EXECUTE'))
    AS anon_executable_admin_rpcs,
  (SELECT count(*) FROM targets WHERE has_function_privilege('authenticated', oid, 'EXECUTE'))
    AS authed_executable_admin_rpcs,
  (SELECT count(*) FROM targets WHERE has_function_privilege('service_role', oid, 'EXECUTE'))
    AS service_role_still_has_access,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND (p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search\_path=%')))
    AS secdef_without_search_path;
