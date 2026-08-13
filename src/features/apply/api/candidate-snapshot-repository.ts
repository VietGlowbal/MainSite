import type { SupabaseClient } from '@supabase/supabase-js';
import {
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
/** Added by supabase-candidate-confirmation.sql. */
const PROFILE_CONFIRM_COLUMN = 'confirmed_at';

async function selectProfile(
  supabase: Client,
  userId: string,
): Promise<{ row: ReflectionProfileRow | null; confirmedAt: string | null }> {
  const full = await supabase
    .from('student_profiles')
    .select(`${PROFILE_BASE_COLUMNS}, ${PROFILE_NEW_COLUMNS}, ${PROFILE_CONFIRM_COLUMN}`)
    .eq('user_id', userId)
    .maybeSingle();

  if (!full.error) {
    const row = (full.data ?? null) as (ReflectionProfileRow & { confirmed_at?: string | null }) | null;
    return { row, confirmedAt: row?.confirmed_at ?? null };
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
    return { row: (withoutConfirm.data ?? null) as ReflectionProfileRow | null, confirmedAt: null };
  }

  const base = await supabase
    .from('student_profiles')
    .select(PROFILE_BASE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  return { row: (base.data ?? null) as ReflectionProfileRow | null, confirmedAt: null };
}

const ACHIEVEMENT_BASE_COLUMNS =
  'id, category, title, competition, organisation, level, year, detail, evidence_key';
const ACTIVITY_BASE_COLUMNS = 'id, category, title, organisation, level, period, description';
/** Added by supabase-reflection-review-status.sql. */
const REVIEW_COLUMNS = 'review_status, source_type, sources';

async function selectEvidenceRows(
  supabase: Client,
  table: 'student_achievements' | 'student_activities',
  baseColumns: string,
  userId: string,
): Promise<Row[]> {
  const full = await supabase
    .from(table)
    .select(`${baseColumns}, ${REVIEW_COLUMNS}`)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  // `baseColumns` is a runtime string, not a literal type, so supabase-js
  // cannot parse the select column list into a precise row type — `Row` is
  // deliberately loose, and every field read through it below is narrowed
  // by hand.
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
  };
}

export type CandidateReflectionRecord = {
  reflection: ReflectionValues;
  documents: EvidenceDocument[];
  /** ISO timestamp, or `null` while still editable. */
  confirmedAt: string | null;
};

export async function loadCandidateReflection(
  supabase: Client,
  userId: string,
): Promise<CandidateReflectionRecord> {
  const [profile, achievementRows, activityRows, documentsResult] = await Promise.all([
    selectProfile(supabase, userId),
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
