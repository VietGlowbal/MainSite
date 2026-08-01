import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Domain event recording, on the `application_events` table.
 *
 * WHY THIS EXISTS. `ApplicationEvent` has been modelled in apply-types.ts since
 * the apply v2 schema landed, and nothing in src/ has ever written to it. The
 * only instrumentation in the app is @vercel/analytics, which sees page views
 * and nothing about what a student actually did with a document. Feature 2 needs
 * twenty named events, so this is where they go rather than a new store.
 *
 * WHY THE NAMES ARE A UNION AND THE PAYLOAD IS PRIMITIVES-ONLY. The rule is that
 * no document content is ever recorded. A `Record<string, unknown>` metadata bag
 * makes that a matter of care at twenty call sites; restricting the value type
 * to primitives makes passing a CV section or a draft a type error. The closed
 * name union does the same job for typos — a misspelled event silently becoming
 * its own series is the classic analytics failure.
 *
 * WHY IT NEVER THROWS. An analytics write failing must not fail the request that
 * generated it. A student whose CV review succeeded should not see an error
 * because the event insert lost a race.
 */

/** Every event Feature 2 emits. Adding one means adding it here first. */
export type StrategyEventType =
  | 'strategy_opened'
  | 'cv_target_profile_generated'
  | 'cv_target_profile_edited'
  | 'cv_import_started'
  | 'cv_import_completed'
  | 'cv_import_failed'
  | 'cv_review_started'
  | 'cv_review_completed'
  | 'cv_review_failed'
  | 'cv_layout_selected'
  | 'cv_export_started'
  | 'cv_export_completed'
  | 'cv_export_failed'
  | 'statement_brief_generated'
  | 'statement_analysis_started'
  | 'statement_analysis_completed'
  | 'statement_analysis_failed'
  | 'statement_feedback_accepted'
  | 'statement_feedback_dismissed'
  | 'strategy_ready_for_audit';

/**
 * Metadata values are primitives only.
 *
 * This is the type that keeps document content out of analytics: a `CvSection`,
 * a `StatementFinding` or a raw draft string field cannot be assigned to it
 * without being deliberately flattened to a count or a label first.
 */
export type EventMetadataValue = string | number | boolean | null;

export type EventMetadata = Record<string, EventMetadataValue>;

export type TrackArgs = {
  supabase: SupabaseClient;
  applicationId: string;
  userId: string;
  eventType: StrategyEventType;
  /** Short human label for the admin timeline. Not free-form content. */
  eventLabel?: string;
  metadata?: EventMetadata;
};

/**
 * Fields that must never appear as a metadata key, whatever their value.
 *
 * A defence in depth rather than the primary one — the type already blocks
 * objects. This catches the case where someone stringifies first, which is
 * exactly how content leaks into an events table.
 */
const FORBIDDEN_KEYS = new Set([
  'content',
  'text',
  'draft',
  'statement',
  'statementText',
  'cv',
  'cvText',
  'sections',
  'bullets',
  'quote',
  'evidence',
  'suggestion',
  'suggestedRevision',
  'body',
  'prompt',
]);

/** Longest a label-ish metadata string may be. Past this it is content. */
const MAX_VALUE_LENGTH = 120;

export function sanitiseMetadata(metadata: EventMetadata | undefined): EventMetadata {
  if (!metadata) return {};
  const out: EventMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) continue;
    out[key] = value;
  }
  return out;
}

export async function trackApplicationEvent({
  supabase,
  applicationId,
  userId,
  eventType,
  eventLabel,
  metadata,
}: TrackArgs): Promise<void> {
  try {
    const { error } = await supabase.from('application_events').insert({
      application_id: applicationId,
      user_id: userId,
      event_type: eventType,
      event_label: eventLabel ?? null,
      metadata: sanitiseMetadata(metadata),
    });

    if (error) {
      // Console, not a thrown error. The caller's work already succeeded.
      console.error('[analytics] event insert failed', eventType, error.message);
    }
  } catch (err) {
    console.error('[analytics] event insert threw', eventType, err);
  }
}
