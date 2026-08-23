import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COMPONENT_KEYS,
  computeReadiness,
  parseFinalCheckRow,
  type ComponentState,
  type ComponentStatus,
  type FinalCheckRecord,
} from '../domain';

/**
 * Final Check — data access.
 *
 * ─── THE INVENTORY IS OBSERVED, NEVER ASSUMED ────────────────────────────────
 *
 * `loadComponentStates` answers one question per component: is there anything
 * attached, and has it been reviewed? Both come from real rows. Nothing is
 * inferred from the student's progress elsewhere in the journey — a student who
 * has a Strategy Report has not thereby written an essay.
 *
 * `lor` can only reach `draft`. We hold a recommender STRATEGY
 * (`application_lor_strategies`), not the letter itself, and a strategy is not
 * a letter. Marking it `reviewed` would tell a student their recommendation is
 * handled when nobody has read one.
 *
 * `supporting` is `not_required` when the student has uploaded nothing, not
 * `missing`. Most programmes ask for no supporting materials, so an absence is
 * usually correct, and scoring it as a hole would push every student to add
 * files they were never asked for. See COMPONENT_WEIGHTS.
 */

async function exists(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<{ id: string; updatedAt: string | null } | null> {
  const { data, error } = await supabase
    .from(table)
    .select('id, updated_at')
    .eq(column, value)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id as string, updatedAt: (data.updated_at as string | null) ?? null };
}

async function hasRow(
  supabase: SupabaseClient,
  table: string,
  column: string,
  value: string,
): Promise<boolean> {
  const { data, error } = await supabase.from(table).select('id').eq(column, value).limit(1);
  if (error || !data) return false;
  return data.length > 0;
}

export async function loadComponentStates(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<ComponentState[]> {
  const strategy = await exists(supabase, 'application_strategies', 'application_id', applicationId);

  const cv = strategy ? await exists(supabase, 'structured_cvs', 'strategy_id', strategy.id) : null;
  const cvReviewed = cv ? await hasRow(supabase, 'cv_reviews', 'cv_id', cv.id) : false;

  const statement = await exists(supabase, 'personal_statements', 'application_id', applicationId);
  const statementReviewed = strategy
    ? await hasRow(supabase, 'statement_analyses', 'strategy_id', strategy.id)
    : false;

  const lor = await exists(supabase, 'application_lor_strategies', 'application_id', applicationId);
  const uploads = await hasRow(supabase, 'uploaded_documents', 'user_id', userId);

  const cvStatus: ComponentStatus = cv ? (cvReviewed ? 'reviewed' : 'draft') : 'missing';
  const essayStatus: ComponentStatus = statement
    ? statementReviewed
      ? 'reviewed'
      : 'draft'
    : 'missing';
  // A recommender strategy is not the letter. Never `reviewed`.
  const lorStatus: ComponentStatus = lor ? 'draft' : 'missing';
  const supportingStatus: ComponentStatus = uploads ? 'draft' : 'not_required';

  const byKey: Record<(typeof COMPONENT_KEYS)[number], ComponentState> = {
    cv: { key: 'cv', status: cvStatus, updatedAt: cv?.updatedAt ?? null },
    essay: { key: 'essay', status: essayStatus, updatedAt: statement?.updatedAt ?? null },
    lor: { key: 'lor', status: lorStatus, updatedAt: lor?.updatedAt ?? null },
    supporting: { key: 'supporting', status: supportingStatus, updatedAt: null },
  };

  return COMPONENT_KEYS.map((key) => byKey[key]);
}

export type FinalCheckPageData = {
  applicationId: string;
  universityName: string;
  courseName: string;
  components: ComponentState[];
  /** Readiness against the CURRENT documents, even when no check has been run. */
  liveReadiness: ReturnType<typeof computeReadiness>;
  check: FinalCheckRecord | null;
};

export async function getFinalCheckPageData(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{ data: FinalCheckPageData | null; migrationMissing: boolean }> {
  const { data: application, error } = await supabase
    .from('course_applications')
    .select('id, course_name, university_name, universities(name)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !application) return { data: null, migrationMissing: false };

  const components = await loadComponentStates(supabase, userId, applicationId);

  const { data: row, error: checkError } = await supabase
    .from('application_final_checks')
    .select('id, components, document_reviews, narrative_audit, limitations, created_at, prompt_version')
    .eq('application_id', applicationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // PGRST205 / 42P01 — the table is not deployed. The page still renders the
  // live inventory and readiness; only the generated review is unavailable.
  // Same degrade-rather-than-500 pattern as match-insights (known-issues §0e).
  const migrationMissing =
    Boolean(checkError) &&
    /PGRST205|42P01|schema cache|does not exist/i.test(
      `${checkError?.code ?? ''} ${checkError?.message ?? ''}`,
    );

  const universities = application.universities as { name?: string } | null;

  return {
    data: {
      applicationId,
      universityName:
        universities?.name ?? (application.university_name as string | null) ?? 'This university',
      courseName: (application.course_name as string | null) ?? 'This course',
      components,
      liveReadiness: computeReadiness(components, []),
      check: row && !checkError ? parseFinalCheckRow(row) : null,
    },
    migrationMissing,
  };
}

/**
 * Raw document content for the review.
 *
 * Rows are selected with `*` and serialised whole rather than picking named
 * content columns. `docs/README.md` is emphatic that column names must be
 * enumerated rather than guessed, and this repository has no need to know the
 * internal shape of a CV or a recommender strategy — the model is reviewing the
 * content, and JSON of the row is content. Volatile bookkeeping fields are
 * dropped so they cannot be mistaken for something the applicant wrote.
 */
const NON_CONTENT_FIELDS = new Set([
  'id',
  'user_id',
  'application_id',
  'strategy_id',
  'cv_id',
  'created_at',
  'updated_at',
  'content_version',
  'version',
  'input_hash',
  'prompt_version',
  'model_name',
]);

function rowToText(row: Record<string, unknown> | null): string | undefined {
  if (!row) return undefined;
  const entries = Object.entries(row).filter(
    ([key, value]) => !NON_CONTENT_FIELDS.has(key) && value !== null && value !== '',
  );
  if (entries.length === 0) return undefined;
  return JSON.stringify(Object.fromEntries(entries));
}

export async function loadDocumentTexts(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<Partial<Record<'cv' | 'essay' | 'lor', string>>> {
  const strategy = await exists(supabase, 'application_strategies', 'application_id', applicationId);

  const [cvRow, statementRow, lorRow] = await Promise.all([
    strategy
      ? supabase.from('structured_cvs').select('*').eq('strategy_id', strategy.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('personal_statements')
      .select('*')
      .eq('application_id', applicationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('application_lor_strategies')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle(),
  ]);

  const documents: Partial<Record<'cv' | 'essay' | 'lor', string>> = {};
  const cv = rowToText(cvRow.data as Record<string, unknown> | null);
  const essay = rowToText(statementRow.data as Record<string, unknown> | null);
  const lor = rowToText(lorRow.data as Record<string, unknown> | null);
  if (cv) documents.cv = cv;
  if (essay) documents.essay = essay;
  if (lor) documents.lor = lor;
  return documents;
}
