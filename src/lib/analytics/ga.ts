import { sendGAEvent } from '@next/third-parties/google';
import { CONSENT_STORAGE_KEY, parseStoredConsent } from '@/components/privacy/consent-boundary';
import { sanitiseMetadata, type EventMetadata } from './track';

/**
 * Google Analytics 4 product events.
 *
 * WHY THIS SITS BESIDE track.ts RATHER THAN REPLACING IT. `track.ts` writes
 * `application_events` rows in Supabase: first-party, row-level-secured, keyed
 * to a user and an application, and queryable by the team. That is the record
 * of what a given student did. GA4 answers a different question — how many
 * people reached a funnel step, from which channel — and must therefore stay
 * anonymous. The two are not substitutes and neither should be dropped for the
 * other.
 *
 * ⚠️ EVERY EVENT IS GATED ON CONSENT. Non-essential analytics only runs for a
 * visitor who accepted it in `ConsentBoundary`; a rejecting visitor, or one
 * sending Global Privacy Control / DNT, produces no GA traffic at all. Nothing
 * here may be called in a way that bypasses `emit`.
 *
 * ⚠️ THIS MODULE IS CLIENT-ONLY. `sendGAEvent` pushes onto `window.dataLayer`;
 * there is no server transport. A Server Component, an API route, a cron job or
 * a Stripe/VNPay webhook CANNOT emit a GA event by calling these functions —
 * the push has to happen in the browser. Server-side milestones belong in
 * `trackApplicationEvent`, and reach GA only if a page the student actually
 * loads observes the state change and calls one of these. Every guard below is
 * written so that importing this from the server is inert rather than a crash.
 *
 * WHY THE PAYLOAD GOES THROUGH sanitiseMetadata. GA is a third party, so the
 * no-document-content rule from track.ts binds harder here, not less. Reusing
 * that function keeps one definition of "PII-shaped" instead of two that drift:
 * primitives only, a forbidden-key list, and a length ceiling past which a
 * string is prose rather than a label. Institution names and amounts are fine;
 * a student's name, email, user id, SOP text or CV text are not, and must never
 * be passed to these functions.
 */

/**
 * Inlined by Next at build time. Absent locally until someone fills it in, and
 * absent in CI, which is exactly the case the guard below exists for.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** True when a Measurement ID is configured, so `<GoogleAnalytics />` renders. */
export const gaEnabled = Boolean(GA_ID);

/**
 * The GA4 event names this app emits. Closed union for the same reason
 * `StrategyEventType` is one: a typo becomes its own series in GA and nobody
 * notices for a quarter.
 *
 * snake_case and under 40 characters, per GA4's own naming limits.
 */
export type GaEventName =
  | 'course_import_completed'
  | 'sop_feedback_generated'
  | 'tier_list_viewed'
  | 'mentor_booking_started'
  | 'mentor_payment_completed';

/**
 * Single choke point for every GA event.
 *
 * Never throws and never warns when GA is simply not configured: analytics must
 * not break a student's flow, and a dev without a Measurement ID should not get
 * a console warning on every interaction. (`sendGAEvent` itself warns when the
 * dataLayer is missing, which is why the `gaEnabled` check comes first.)
 */
function emit(name: GaEventName, params: EventMetadata = {}): void {
  if (!GA_ID) return;
  if (typeof window === 'undefined') return;
  if (!analyticsConsented()) return;
  try {
    sendGAEvent('event', name, sanitiseMetadata(params));
  } catch (err) {
    console.error('[ga] event failed', name, err);
  }
}

/**
 * Whether the visitor has accepted non-essential analytics.
 *
 * Checked on every event, not once at module load, and this is not belt-and-
 * braces. `ConsentBoundary` unmounting `<GoogleAnalytics />` on revocation does
 * NOT undo the load: gtag.js has already run, `window.dataLayer` still exists,
 * and `sendGAEvent` would happily keep pushing to it for the rest of the
 * session. Reading the stored record per call is what actually makes "Reject
 * non-essential" take effect immediately for someone who changes their mind.
 *
 * Reads the same localStorage record `ConsentBoundary` writes, through its own
 * parser, so a policy-version bump invalidates consent here exactly as it does
 * there rather than through a second copy of the rule that could drift.
 */
function analyticsConsented(): boolean {
  try {
    return parseStoredConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))?.analytics === true;
  } catch {
    // Storage blocked (private mode, embedded webview). No stored consent means
    // no consent — analytics is the thing that must fail closed here.
    return false;
  }
}

/**
 * A course URL was pasted and the importer produced an application.
 *
 * `university` is an institution name, not student data. Pass the display label
 * already on screen — never the pasted URL, which can carry query parameters
 * that identify the student's session on the university's site.
 */
export function trackCourseImportCompleted(university: string): void {
  emit('course_import_completed', { university });
}

/**
 * An SOP / personal statement analysis came back.
 *
 * The target university is optional because the generic writer has no target.
 * The draft, the score breakdown and the quoted suggestions stay out — those
 * live in `application_events` and the database, not in GA.
 */
export function trackSopFeedbackGenerated(university?: string): void {
  emit('sop_feedback_generated', university ? { university } : {});
}

/**
 * Which tier-list screen was viewed.
 *
 * Two exist in the product's intent and they group on different axes, so they
 * are one event with a parameter rather than two events — the funnel question
 * ("did the student ever reach a tier list?") is the same for both, and GA can
 * still split them by `surface` when that matters.
 *
 * - `match_results` — /universities/matches, grouping by recommendation band
 *   (top_pick / good_fit / worth_exploring). This is the one that ships today.
 * - `admission_fit` — the reach/recommend/safe grouping on /universities.
 *   NOT WIRED, because as of 2026-09-08 it does not exist: `admissionUnlocked`
 *   is threaded through `explorer-context` and passed `false` by the only
 *   caller, and no component reads it to render anything. The value is declared
 *   here so that turning that screen on is a one-line call, not a schema change
 *   that splits the metric in two halves nobody can compare.
 */
export type TierListSurface = 'match_results' | 'admission_fit';

/** A tier-grouped university list was shown to a signed-in student. */
export function trackTierListViewed(surface: TierListSurface): void {
  emit('tier_list_viewed', { surface });
}

/**
 * A student submitted the booking form and a checkout was created.
 *
 * Deliberately takes no arguments: the two things the form collects that would
 * identify the session — `help_topic` and `help_questions` — are free text the
 * student wrote, and neither belongs in GA.
 */
export function trackMentorBookingStarted(): void {
  emit('mentor_booking_started');
}

/**
 * A mentorship payment was confirmed.
 *
 * `value` and `currency` are GA4's conventional monetary parameter names, so
 * the event reports as revenue rather than as an opaque count. The live
 * checkout prices in VND; pass the dong amount, not a converted one.
 *
 * Manual bank transfer is the only payment method that reaches this — the
 * Stripe and VNPay routes still exist in the repo but nothing in the booking UI
 * calls them (`PaymentMethodSelector` offers exactly one option). Callers must
 * check `product_type === 'mentorship'`, because the same transfer flow also
 * sells Plus subscriptions and counting those here would inflate the number.
 */
export function trackMentorPaymentCompleted(amount: number): void {
  emit('mentor_payment_completed', { value: amount, currency: 'VND' });
}
