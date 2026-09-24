-- AI Strategy Dashboard — genUI content blocks for the recommendation detail
-- page. Run after supabase-strategy-recommendation-fields.sql.
--
-- WHY A SEPARATE FILE. Same reasoning as supabase-strategy-recommendation-fields.sql's
-- own header: supabase-strategy-dashboard.sql and that file have already
-- shipped and may already be applied against a live database, so editing
-- either after the fact risks the same "what ran, when" drift
-- docs/known-issues.md §0 warns about. A new file keeps this traceable.
--
-- WHAT THIS ADDS. Every AI-generated recommendation now also declares a
-- `content_schema` — one of three fixed shapes (structured_table / long_text
-- / checklist, see `ContentBlock` in src/lib/match-insights.ts) describing
-- what the detail page's body should look like for that specific task, plus
-- `submit_checklist` ("What to submit"), `tips`, and `suggested_questions`
-- (starter chips for the AI Coach). `content_value` is where the student's
-- own answer to `content_schema` is saved.
--
-- `content_schema`/`submit_checklist`/`tips`/`suggested_questions` are
-- AI-authored and refreshed whenever a Strategy is regenerated, same as
-- `action_label`/`action_type`/`action_target` already are.
-- `content_value` is NEVER touched by regeneration — see
-- `reconcileRecommendations`'s doc comment in
-- src/features/ai-strategy-dashboard/domain/recommendation.ts. It is student
-- progress, exactly like `status`, and a regenerate must not be able to wipe
-- out what a student already typed into a table or a textarea.
--
-- NO NEW RLS POLICY. The existing "Users can update recommendations for
-- their applications" UPDATE policy (supabase-apply-v2.sql) is row-scoped,
-- not column-scoped — a student who may already PATCH `status`/`deadline` on
-- their own row may PATCH these new columns too.

ALTER TABLE application_recommendations
  ADD COLUMN IF NOT EXISTS content_schema      JSONB,
  ADD COLUMN IF NOT EXISTS content_value       JSONB,
  ADD COLUMN IF NOT EXISTS submit_checklist    JSONB,
  ADD COLUMN IF NOT EXISTS tips                JSONB,
  ADD COLUMN IF NOT EXISTS suggested_questions JSONB;
