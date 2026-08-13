import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AchievementValues, ActivityValues, EvidenceSource } from '@/features/apply/domain';
import type { EvidenceDocument } from '@/features/apply/hooks';
import { ReflectionChrome } from '../../reflection-chrome';
import { ApplicationNavFromReturn } from '../application-nav-from-return';
import { ReflectionEvidenceForm } from './reflection-evidence-form';

type Row = Record<string, unknown>;
type Client = Awaited<ReturnType<typeof createClient>>;

const ACHIEVEMENT_BASE_COLUMNS =
  'id, category, title, competition, organisation, level, year, detail, evidence_key';
const ACTIVITY_BASE_COLUMNS = 'id, category, title, organisation, level, period, description';
/** Added by supabase-reflection-review-status.sql. */
const REVIEW_COLUMNS = 'review_status, source_type, sources';

/**
 * Select with the review-status columns, falling back to the base set alone.
 *
 * Same shape as `loadProfile` in the step-1 page: PostgREST fails the WHOLE
 * select on one unknown column, so a not-yet-migrated deployment would render
 * this page with none of a student's saved achievements rather than just
 * missing their review state.
 */
async function selectTolerant(
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
  // cannot parse the select column list into a precise row type here — same
  // reason `loadProfile` in the step-1 page keeps its column lists as
  // module-level `const`s instead. `Row` is deliberately loose (every field
  // read through it below is narrowed by hand), so the `unknown` step is safe.
  if (!full.error) return (full.data ?? []) as unknown as Row[];

  console.warn(
    `[reflection/achievements] could not read ${REVIEW_COLUMNS} on ${table} — run supabase-reflection-review-status.sql. Loading the rest.`,
    full.error.message,
  );
  const base = await supabase
    .from(table)
    .select(baseColumns)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (base.data ?? []) as unknown as Row[];
}

/** Row parses whatever shape `sources` was actually stored as into `EvidenceSource[]`. */
function sourcesFromRow(row: Row): EvidenceSource[] | undefined {
  return Array.isArray(row['sources']) ? (row['sources'] as EvidenceSource[]) : undefined;
}

/** NULL reads as 'reviewed' — see the migration's own comment on why. */
function reviewStatusFromRow(row: Row): AchievementValues['reviewStatus'] {
  return row['review_status'] === 'needs_review' ? 'needs_review' : 'reviewed';
}

/** NULL reads as 'manual' for the same reason. */
function sourceTypeFromRow(row: Row): AchievementValues['sourceType'] {
  return row['source_type'] === 'document' ? 'document' : 'manual';
}

/**
 * Reflection step 2 of 2 — achievements and activities.
 *
 * Reads back whatever the student saved last time so the form is editable
 * rather than append-only; the API replaces the set wholesale on save, which is
 * only safe because the form always posts the complete list.
 *
 * Both selects tolerate the tables not existing yet: supabase-reflection.sql is
 * a migration this project has a habit of shipping code ahead of, and an
 * unapplied one should cost the student their saved rows, not the page.
 */
export default async function ReflectionAchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { return: returnTo } = await searchParams;

  const [achievementRows, activityRows, documentsResult] = await Promise.all([
    selectTolerant(supabase, 'student_achievements', ACHIEVEMENT_BASE_COLUMNS, user.id),
    selectTolerant(supabase, 'student_activities', ACTIVITY_BASE_COLUMNS, user.id),
    // 'other' is the kind every uploader on this flow has always used — see
    // reflection-evidence-form.tsx's own `upload(files, 'other')` call.
    supabase
      .from('uploaded_documents')
      .select('id, file_name, storage_key, created_at')
      .eq('user_id', user.id)
      .eq('type', 'other')
      .order('created_at', { ascending: true }),
  ]);

  const documents: EvidenceDocument[] = (documentsResult.data ?? []).map((row) => ({
    id: row.id as string,
    fileName: row.file_name as string,
    storageKey: row.storage_key as string,
    // Not stored server-side — `formatBytes` is skipped for these, same as a
    // stored document already does in `DocumentRow`'s own optional `total`.
    uploadedAt: row.created_at as string,
  }));

  const achievements: AchievementValues[] = achievementRows.map((row) => ({
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
  }));

  const activities: ActivityValues[] = activityRows.map((row) => ({
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
  }));

  return (
    <ReflectionChrome user={user} nav={<ApplicationNavFromReturn returnTo={returnTo} />}>
      <ReflectionEvidenceForm
        initialAchievements={achievements}
        initialActivities={activities}
        initialDocuments={documents}
      />
    </ReflectionChrome>
  );
}
