import type { SupabaseClient } from '@supabase/supabase-js';
import {
  activityReflectionSchema,
  reflectionCardSchema,
  reflectionFromProfile,
  type AchievementValues,
  type ActivityValues,
  type EvidenceSource,
  type ReflectionProfileRow,
  type ReflectionValues,
} from '../domain';
import type { EvidenceDocument } from '../hooks';

/**
 * The one place that reads a student's whole candidate-information record —
 * profile, achievements, activities, and documents.
 *
 * ─── WHY THIS IS NEW RATHER THAN A FOURTH COPY ───────────────────────────────
 *
 * `reflection/page.tsx` and `reflection/achievements/page.tsx` each already
 * had their own tolerant-select loader for their own slice. Review & Confirm
 * needs BOTH slices at once, and the two read-only views (rendered by those
 * same two pages once a student is confirmed) need exactly what their
 * editable counterparts already load. Rather than write a third
 * near-identical loader, this consolidates all three call sites onto one
 * repository function — `app/` orchestrates, `features/*∕api` is the only
 * slice allowed to touch the database, per this repo's Feature-Sliced
 * boundaries.
 *
 * ⚠️ EVERY SELECT HERE IS TOLERANT OF A COLUMN NOT EXISTING YET, the same
 * pattern each loader it replaces already used: PostgREST fails the WHOLE
 * select on one unknown column, so reading `confirmed_at` (or the review-
 * status columns, or the subject-motivation columns) unconditionally would
 * silently break the rest of the read on a deployment where the matching
 * migration has not run — not just the one new field.
 */

type Row = Record<string, unknown>;
type Client = SupabaseClient;

const PROFILE_BASE_COLUMNS =
  'nationality, current_qualification, study_level, target_subjects, preferred_countries, budget_range, funding_source, tuition_budget_usd, grades_summary, goals';
/** Added by supabase-reflection-questions.sql and supabase-reflection-subject-motivations.sql. */
const PROFILE_NEW_COLUMNS = 'study_motivation, subject_motivations, target_intake';
/** Added by supabase-application-experience-flow.sql. */
const PROFILE_PERSONAL_REFLECTION_COLUMN = 'personal_reflection_answers';
/**
 * Added by supabase-candidate-confirmation.sql. Read ONLY when no
 * `applicationId` is given — see `loadCandidateReflection`'s own doc comment
 * for why this is the global-fallback value, not the per-application one.
 */
const PROFILE_CONFIRM_COLUMN = 'confirmed_at';

async function selectProfile(
  supabase: Client,
  userId: string,
  applicationId: string | undefined,
): Promise<{ row: ReflectionProfileRow | null; confirmedAt: string | null }> {
  // Per-application confirmation only exists once
  // supabase-per-application-onboarding.sql has run; this is read separately
  // (not merged into the profile select below) because it comes from a
  // different table (`course_applications`, not `student_profiles`).
  const applicationConfirmedAt = applicationId
    ? await selectApplicationConfirmedAt(supabase, userId, applicationId)
    : undefined;

  const withPersonalReflection = await supabase
    .from('student_profiles')
    .select(
      `${PROFILE_BASE_COLUMNS}, ${PROFILE_NEW_COLUMNS}, ${PROFILE_PERSONAL_REFLECTION_COLUMN}, ${PROFILE_CONFIRM_COLUMN}`,
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (!withPersonalReflection.error) {
    const row = (withPersonalReflection.data ?? null) as
      | (ReflectionProfileRow & { confirmed_at?: string | null })
      | null;
    return {
      row,
      confirmedAt: applicationId ? (applicationConfirmedAt ?? null) : (row?.confirmed_at ?? null),
    };
  }

  console.warn(
    '[candidate-snapshot-repository] could not read personal_reflection_answers — run supabase-application-experience-flow.sql. Loading the rest.',
    withPersonalReflection.error.message,
  );

  const full = await supabase
    .from('student_profiles')
    .select(`${PROFILE_BASE_COLUMNS}, ${PROFILE_NEW_COLUMNS}, ${PROFILE_CONFIRM_COLUMN}`)
    .eq('user_id', userId)
    .maybeSingle();

  if (!full.error) {
    const row = (full.data ?? null) as (ReflectionProfileRow & { confirmed_at?: string | null }) | null;
    return {
      row,
      confirmedAt: applicationId ? (applicationConfirmedAt ?? null) : (row?.confirmed_at ?? null),
    };
  }

  console.warn(
    '[candidate-snapshot-repository] could not read confirmed_at/newer profile columns — run supabase-reflection-questions.sql, supabase-reflection-subject-motivations.sql, and supabase-candidate-confirmation.sql. Loading the rest.',
    full.error.message,
  );

  const withoutConfirm = await supabase
    .from('student_profiles')
    .select(`${PROFILE_BASE_COLUMNS}, ${PROFILE_NEW_COLUMNS}`)
    .eq('user_id', userId)
    .maybeSingle();
  if (!withoutConfirm.error) {
    return {
      row: (withoutConfirm.data ?? null) as ReflectionProfileRow | null,
      confirmedAt: applicationId ? (applicationConfirmedAt ?? null) : null,
    };
  }

  const base = await supabase
    .from('student_profiles')
    .select(PROFILE_BASE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  return {
    row: (base.data ?? null) as ReflectionProfileRow | null,
    confirmedAt: applicationId ? (applicationConfirmedAt ?? null) : null,
  };
}

/**
 * `course_applications.candidate_confirmed_at` for one application, tolerant
 * of `supabase-per-application-onboarding.sql` not having run yet (degrades
 * to `null`, i.e. "not confirmed for this application" — the safe default,
 * never a false "already reviewed").
 */
async function selectApplicationConfirmedAt(
  supabase: Client,
  userId: string,
  applicationId: string,
): Promise<string | null> {
  const result = await supabase
    .from('course_applications')
    .select('candidate_confirmed_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (result.error) {
    console.warn(
      '[candidate-snapshot-repository] could not read candidate_confirmed_at — run supabase-per-application-onboarding.sql.',
      result.error.message,
    );
    return null;
  }
  return (result.data as { candidate_confirmed_at?: string | null } | null)?.candidate_confirmed_at ?? null;
}

const ACHIEVEMENT_BASE_COLUMNS =
  'id, category, title, competition, organisation, level, year, detail, evidence_key';
const ACTIVITY_BASE_COLUMNS = 'id, category, title, organisation, level, period, description';
/** Added by supabase-reflection-review-status.sql. */
const REVIEW_COLUMNS = 'review_status, source_type, sources';
/** Added by supabase-application-experience-flow.sql. */
const REFLECTION_COLUMNS =
  'reflection, reflection_card, reflection_card_status, reflection_updated_at, reflection_card_generated_at';

async function selectEvidenceRows(
  supabase: Client,
  table: 'student_achievements' | 'student_activities',
  baseColumns: string,
  userId: string,
): Promise<Row[]> {
  const withReflection = await supabase
    .from(table)
    .select(`${baseColumns}, ${REVIEW_COLUMNS}, ${REFLECTION_COLUMNS}`)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  // `baseColumns` is a runtime string, not a literal type, so supabase-js
  // cannot parse the select column list into a precise row type — `Row` is
  // deliberately loose, and every field read through it below is narrowed
  // by hand.
  if (!withReflection.error) return (withReflection.data ?? []) as unknown as Row[];

  console.warn(
    `[candidate-snapshot-repository] could not read ${REFLECTION_COLUMNS} on ${table} — run supabase-application-experience-flow.sql. Loading the rest.`,
    withReflection.error.message,
  );

  const full = await supabase
    .from(table)
    .select(`${baseColumns}, ${REVIEW_COLUMNS}`)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (!full.error) return (full.data ?? []) as unknown as Row[];

  console.warn(
    `[candidate-snapshot-repository] could not read ${REVIEW_COLUMNS} on ${table} — run supabase-reflection-review-status.sql. Loading the rest.`,
    full.error.message,
  );
  const base = await supabase
    .from(table)
    .select(baseColumns)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (base.data ?? []) as unknown as Row[];
}

function sourcesFromRow(row: Row): EvidenceSource[] | undefined {
  return Array.isArray(row['sources']) ? (row['sources'] as EvidenceSource[]) : undefined;
}

/** NULL reads as 'reviewed' — see supabase-reflection-review-status.sql's own comment on why. */
function reviewStatusFromRow(row: Row): AchievementValues['reviewStatus'] {
  return row['review_status'] === 'needs_review' ? 'needs_review' : 'reviewed';
}

/** NULL reads as 'manual' for the same reason. */
function sourceTypeFromRow(row: Row): AchievementValues['sourceType'] {
  return row['source_type'] === 'document' ? 'document' : 'manual';
}

/**
 * `reflection`/`reflection_card` on a row — parsed leniently (an invalid or
 * partial stored shape drops the offending field rather than failing the
 * whole record) since these are AI/user-authored JSONB, not a validated
 * write path guaranteed to match the current schema shape.
 */
function reflectionFieldsFromRow(row: Row): Pick<AchievementValues, 'reflection' | 'reflectionCard'> {
  const reflectionParsed = activityReflectionSchema.safeParse(row['reflection'] ?? {});
  const cardRaw = row['reflection_card'];
  const card =
    cardRaw && typeof cardRaw === 'object'
      ? reflectionCardSchema.safeParse({
          ...(cardRaw as Record<string, unknown>),
          status: row['reflection_card_status'] ?? (cardRaw as Record<string, unknown>)['status'],
        })
      : undefined;

  return {
    ...(reflectionParsed.success && Object.keys(reflectionParsed.data).length > 0
      ? { reflection: reflectionParsed.data }
      : {}),
    ...(card?.success ? { reflectionCard: card.data } : {}),
  };
}

function achievementFromRow(row: Row): AchievementValues {
  return {
    id: row['id'] as string,
    category: row['category'] as AchievementValues['category'],
    title: (row['title'] as string) ?? '',
    ...(row['competition'] ? { competition: row['competition'] as string } : {}),
    ...(row['organisation'] ? { organisation: row['organisation'] as string } : {}),
    ...(row['level'] ? { level: row['level'] as string } : {}),
    ...(row['year'] != null ? { year: row['year'] as number } : {}),
    ...(row['detail'] ? { detail: row['detail'] as string } : {}),
    ...(row['evidence_key'] ? { evidenceKey: row['evidence_key'] as string } : {}),
    reviewStatus: reviewStatusFromRow(row),
    sourceType: sourceTypeFromRow(row),
    ...(sourcesFromRow(row) ? { sources: sourcesFromRow(row) } : {}),
    ...reflectionFieldsFromRow(row),
  };
}

function activityFromRow(row: Row): ActivityValues {
  return {
    id: row['id'] as string,
    category: row['category'] as ActivityValues['category'],
    title: (row['title'] as string) ?? '',
    ...(row['organisation'] ? { organisation: row['organisation'] as string } : {}),
    ...(row['level'] ? { level: row['level'] as string } : {}),
    ...(row['period'] ? { period: row['period'] as string } : {}),
    ...(row['description'] ? { description: row['description'] as string } : {}),
    reviewStatus: reviewStatusFromRow(row),
    sourceType: sourceTypeFromRow(row),
    ...(sourcesFromRow(row) ? { sources: sourcesFromRow(row) } : {}),
    ...reflectionFieldsFromRow(row),
  };
}

export type CandidateReflectionRecord = {
  reflection: ReflectionValues;
  documents: EvidenceDocument[];
  /**
   * ISO timestamp, or `null` while still editable.
   *
   * When `applicationId` is passed to `loadCandidateReflection`, this is
   * THAT application's own `course_applications.candidate_confirmed_at` —
   * whether the student has confirmed candidate information for this
   * specific application, independent of any other application. When
   * `applicationId` is omitted (the legacy, no-application-context entry
   * points), this is the global `student_profiles.confirmed_at` — has the
   * student EVER confirmed, for any application — unchanged from before this
   * field became per-application.
   */
  confirmedAt: string | null;
};

/**
 * The one place that reads a student's whole candidate-information record.
 * See the file-level comment for the general shape; `applicationId` is
 * optional specifically so the legacy, non-application-scoped callers (the
 * old standalone `/ai-strategy/report` generation) keep reading the global
 * `confirmed_at` they always have — passing it is what makes `confirmedAt`
 * (and therefore every read-only/locked-view decision downstream) scoped to
 * ONE application instead of leaking a different application's confirmation
 * onto this one. See `docs/known-issues.md` for the incident this fixed.
 */
export async function loadCandidateReflection(
  supabase: Client,
  userId: string,
  applicationId?: string,
): Promise<CandidateReflectionRecord> {
  const [profile, achievementRows, activityRows, documentsResult] = await Promise.all([
    selectProfile(supabase, userId, applicationId),
    selectEvidenceRows(supabase, 'student_achievements', ACHIEVEMENT_BASE_COLUMNS, userId),
    selectEvidenceRows(supabase, 'student_activities', ACTIVITY_BASE_COLUMNS, userId),
    // 'other' is the kind every uploader on this flow has always used — see
    // reflection-evidence-form.tsx's own `upload(files, 'other')` call.
    supabase
      .from('uploaded_documents')
      .select('id, file_name, storage_key, created_at')
      .eq('user_id', userId)
      .eq('type', 'other')
      .order('created_at', { ascending: true }),
  ]);

  const achievements = achievementRows.map(achievementFromRow);
  const activities = activityRows.map(activityFromRow);

  const documents: EvidenceDocument[] = (documentsResult.data ?? []).map((row) => ({
    id: row.id as string,
    fileName: row.file_name as string,
    storageKey: row.storage_key as string,
    uploadedAt: row.created_at as string,
  }));

  return {
    reflection: reflectionFromProfile(profile.row, achievements, activities),
    documents,
    confirmedAt: profile.confirmedAt,
  };
}
