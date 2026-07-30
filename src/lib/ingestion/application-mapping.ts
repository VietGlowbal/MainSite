/**
 * Application Mapping — Ingestion Results to course_applications
 *
 * Maps product-safe fields from crawl_programmes / crawl_field_assertions
 * onto a course_applications row after a successful ingestion run.
 *
 * Rules:
 * - Only RULE_VALIDATED / HUMAN_VERIFIED assertions update structured fields
 * - REJECTED assertions are never applied
 * - NEEDS_REVIEW assertions may be stored as excerpts only (use_for_eligibility=false)
 * - Deadline only mapped when structured (YYYY-MM-DD) and not null_reason
 * - Admission requirements never drive eligibility unless HUMAN_VERIFIED
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface IngestionMappingInput {
  applicationId: string;
  runId: string;
  programmeId: string;
  cacheHit: boolean;
  jobId: string;
}

const SAFE_VERIFICATION_STATUSES = new Set([
  'HUMAN_VERIFIED',
  'RULE_VALIDATED',
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VERIFICATION_RANK: Record<string, number> = {
  HUMAN_VERIFIED: 2,
  RULE_VALIDATED: 1,
};

interface AssertionRow {
  field_name: string;
  value_json: unknown;
  null_reason: string | null;
  source_url: string | null;
  verification_status: string;
  confidence: number | null;
  academic_cycle: string | null;
  audience: string | null;
}

/**
 * Fetch product-safe programme data from crawl tables and apply to the
 * course_applications row.
 */
export async function mapIngestionResultToApplication(
  input: IngestionMappingInput
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Fetch programme row
  const { data: programme, error: programmeError } = await supabase
    .from('crawl_programmes')
    .select(
      'programme_name, degree_level, delivery_mode, programme_status, official_url, verification_status'
    )
    .eq('run_id', input.runId)
    .eq('programme_id', input.programmeId)
    .neq('verification_status', 'REJECTED')
    .maybeSingle();

  if (programmeError || !programme) {
    console.error(
      '[app-mapping] Could not fetch programme:',
      programmeError?.message
    );
    return;
  }

  // 2. Fetch effective field-level assertions for this programme
  const { data: assertions } = await supabase
    .from('crawl_field_assertions')
    .select(
      'field_name, value_json, null_reason, source_url, verification_status, confidence, academic_cycle, audience'
    )
    .eq('run_id', input.runId)
    .eq('entity_type', 'programme')
    .eq('entity_id', input.programmeId)
    .eq('is_effective', true)
    .neq('verification_status', 'REJECTED')
    .order('confidence', { ascending: false });

  const assertionMap = new Map<string, AssertionRow>();
  for (const a of (assertions ?? []) as AssertionRow[]) {
    const current = assertionMap.get(a.field_name);
    const isBetter =
      !current ||
      (VERIFICATION_RANK[a.verification_status] ?? 0) >
        (VERIFICATION_RANK[current.verification_status] ?? 0) ||
      ((VERIFICATION_RANK[a.verification_status] ?? 0) ===
        (VERIFICATION_RANK[current.verification_status] ?? 0) &&
        (a.confidence ?? 0) > (current.confidence ?? 0));
    if (isBetter) {
      assertionMap.set(a.field_name, a);
    }
  }

  // 3. Build the application update — product-safe fields only
  const appUpdate: Record<string, unknown> = {
    parse_status: 'complete',
    progress_percentage: 100,
    import_status: 'complete',
    // Link back to ingestion system
    crawl_run_id: input.runId,
    crawl_programme_id: input.programmeId,
    ingestion_job_id: input.jobId,
    updated_at: new Date().toISOString(),
  };

  // Programme name from assertion or programme row
  const nameAssertion = assertionMap.get('programme_name');
  if (
    nameAssertion &&
    SAFE_VERIFICATION_STATUSES.has(nameAssertion.verification_status) &&
    nameAssertion.value_json
  ) {
    appUpdate.course_name = String(nameAssertion.value_json).replace(/^"|"$/g, '');
  } else if (programme.programme_name) {
    appUpdate.course_name = programme.programme_name;
  }

  // Degree level
  const degreeAssertion = assertionMap.get('degree_level');
  if (
    degreeAssertion &&
    SAFE_VERIFICATION_STATUSES.has(degreeAssertion.verification_status) &&
    degreeAssertion.value_json
  ) {
    appUpdate.degree_level = String(degreeAssertion.value_json).replace(/^"|"$/g, '');
  } else if (programme.degree_level) {
    appUpdate.degree_level = programme.degree_level;
  }

  // Study/delivery mode
  const modeAssertion = assertionMap.get('delivery_mode');
  if (
    modeAssertion &&
    SAFE_VERIFICATION_STATUSES.has(modeAssertion.verification_status) &&
    modeAssertion.value_json
  ) {
    appUpdate.study_mode = String(modeAssertion.value_json).replace(/^"|"$/g, '');
  } else if (programme.delivery_mode) {
    appUpdate.study_mode = programme.delivery_mode;
  }

  // Application deadline — structured date only, no null_reason
  for (const fieldName of [
    'international_deadline',
    'final_deadline',
    'priority_deadline',
  ]) {
    const deadlineAssertion = assertionMap.get(fieldName);
    if (
      deadlineAssertion &&
      SAFE_VERIFICATION_STATUSES.has(deadlineAssertion.verification_status) &&
      deadlineAssertion.value_json &&
      !deadlineAssertion.null_reason
    ) {
      const rawDate = String(deadlineAssertion.value_json).replace(
        /^"|"$/g,
        ''
      );
      if (DATE_REGEX.test(rawDate)) {
        appUpdate.deadline = rawDate;
        appUpdate.deadline_source =
          deadlineAssertion.source_url ?? programme.official_url;
        break;
      }
    }
  }

  // 4. Apply update
  const { error: updateError } = await supabase
    .from('course_applications')
    .update(appUpdate)
    .eq('id', input.applicationId);

  if (updateError) {
    console.error(
      '[app-mapping] Failed to update application:',
      updateError.message
    );
    throw updateError;
  }
}

/**
 * Minimal update when a cache hit is resolved.
 * Only sets parse_status + link columns; does not overwrite user-entered fields.
 */
export async function applyCacheHitToApplication(opts: {
  applicationId: string;
  runId: string;
  programmeId: string;
  jobId: string;
  programmeName: string | null;
  degreeLevel: string | null;
  deliveryMode: string | null;
}): Promise<void> {
  const supabase = createAdminClient();

  const appUpdate: Record<string, unknown> = {
    parse_status: 'complete',
    progress_percentage: 100,
    import_status: 'complete',
    crawl_run_id: opts.runId,
    crawl_programme_id: opts.programmeId,
    ingestion_job_id: opts.jobId,
    updated_at: new Date().toISOString(),
  };

  if (opts.programmeName) appUpdate.course_name = opts.programmeName;
  if (opts.degreeLevel) appUpdate.degree_level = opts.degreeLevel;
  if (opts.deliveryMode) appUpdate.study_mode = opts.deliveryMode;

  const { error } = await supabase
    .from('course_applications')
    .update(appUpdate)
    .eq('id', opts.applicationId);

  if (error) {
    console.error('[app-mapping] Cache hit update failed:', error.message);
    throw error;
  }
}
