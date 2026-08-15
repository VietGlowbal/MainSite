import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  MentorBrowseFilters,
  MentorWithUniversity,
  MentorAvailabilitySlot,
  MentorReviewWithReviewer,
  Currency,
} from '@/types/mentorship';

// ── Browse approved mentors ─────────────────────────────────────────────────

/**
 * The public shape of a mentor — what the directory at /mentors may show a
 * visitor who is not signed in.
 *
 * Deliberately not `MentorProfile`. That type mirrors the whole row, which also
 * carries `legal_name`, `date_of_birth`, the four verification storage keys and
 * `stripe_account_id`. Those are identity and payout details, and a public
 * directory has no business serialising them into the page.
 */
export type PublicMentor = Pick<
  MentorWithUniversity,
  | 'id'
  | 'display_name'
  | 'avatar_url'
  | 'university_id'
  | 'degree_level'
  | 'subject'
  | 'graduation_year'
  | 'currently_enrolled'
  | 'bio'
  | 'help_topics'
  | 'strengths'
  | 'languages'
  | 'total_sessions'
  | 'avg_rating'
  // A session rate is a public fact about a mentor, and the price sorts need it.
  | 'hourly_rate_amount'
  | 'hourly_rate_currency'
  | 'created_at'
  | 'university'
  /*
   * Both added for the profile page (Figma 375:21633), and both public facts a
   * student is choosing on: the header reads "2023 – 2025 · masters · …", and
   * the tick beside the name is gated on `verified_at` rather than on
   * `status === 'approved'`. Those are not the same claim — approval lets a
   * mentor take bookings, verification says Glowbal checked their documents —
   * and a trust marker must not be inferred from the weaker one.
   */
  | 'study_start_year'
  | 'verified_at'
>;

const PUBLIC_MENTOR_SELECT = `
  id, display_name, avatar_url, university_id, degree_level, subject,
  graduation_year, study_start_year, currently_enrolled, bio, help_topics, strengths,
  languages, total_sessions, avg_rating, hourly_rate_amount, hourly_rate_currency,
  verified_at, created_at,
  university:universities!achiever_profiles_university_id_fkey ( id, name, country, logo_url )
`;

export async function getApprovedMentors(
  filters?: MentorBrowseFilters,
): Promise<PublicMentor[]> {
  /*
   * Admin client, not the request-scoped one.
   *
   * `achiever_profiles` has no public-read RLS policy, so the anon role reads
   * back zero rows — which made /mentors render an empty directory to every
   * signed-out visitor, silently, because an RLS filter is not an error. The
   * mentor directory is public by design (it is in the marketing nav and the
   * footer), so the read is done with the service role and narrowed to
   * PUBLIC_MENTOR_SELECT instead.
   *
   * The durable fix is a `status = 'approved'` read policy on the table; until
   * that migration is run, this keeps the page honest. Nothing here is
   * user-scoped, so there is no per-user data to leak by bypassing RLS.
   */
  const supabase = createAdminClient();

  // Note: the legacy "achiever_*" tables are kept in place so existing
  // bookings, admin pages, and reviews continue to work. We just rebrand
  // the surface area as "mentor" everywhere new code touches.
  const { data, error } = await supabase
    .from('achiever_profiles')
    .select(PUBLIC_MENTOR_SELECT)
    .eq('status', 'approved');

  if (error) {
    console.error('Error fetching mentors:', error);
    return [];
  }

  let results = (data ?? []) as unknown as PublicMentor[];

  // Filtering
  if (filters?.query) {
    const q = filters.query.toLowerCase();
    results = results.filter(
      (m) =>
        m.display_name.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q) ||
        m.university?.name.toLowerCase().includes(q) ||
        m.university?.country.toLowerCase().includes(q) ||
        m.help_topics.some((t) => t.toLowerCase().includes(q)) ||
        m.strengths?.some((s) => s.toLowerCase().includes(q)),
    );
  }
  if (filters?.university_id) {
    results = results.filter((m) => m.university_id === filters.university_id);
  }
  if (filters?.country) {
    const c = filters.country.toLowerCase();
    results = results.filter((m) => m.university?.country.toLowerCase() === c);
  }
  if (filters?.subject) {
    const q = filters.subject.toLowerCase();
    results = results.filter((m) => m.subject.toLowerCase().includes(q));
  }
  if (filters?.languages && filters.languages.length > 0) {
    results = results.filter((m) =>
      filters.languages!.some((lang) => m.languages.includes(lang)),
    );
  }
  if (filters?.currently_enrolled !== undefined) {
    results = results.filter(
      (m) => m.currently_enrolled === filters.currently_enrolled,
    );
  }

  // available_from filter — only mentors with at least one open slot from
  // the chosen date onwards. Done as a follow-up query so we can keep the
  // first query cacheable.
  if (filters?.available_from) {
    const fromIso = new Date(`${filters.available_from}T00:00:00Z`).toISOString();
    const { data: openSlots } = await supabase
      .from('mentor_availability_slots')
      .select('mentor_id')
      .eq('status', 'open')
      .gte('starts_at', fromIso);

    const mentorIds = new Set((openSlots ?? []).map((s) => s.mentor_id as string));
    results = results.filter((m) => mentorIds.has(m.id));
  }

  // Sort
  switch (filters?.sort) {
    case 'newest':
      results.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      break;
    case 'price_asc':
      results.sort((a, b) => Number(a.hourly_rate_amount ?? 0) - Number(b.hourly_rate_amount ?? 0));
      break;
    case 'price_desc':
      results.sort((a, b) => Number(b.hourly_rate_amount ?? 0) - Number(a.hourly_rate_amount ?? 0));
      break;
    default:
      results.sort((a, b) => {
        const r = Number(b.avg_rating) - Number(a.avg_rating);
        if (r !== 0) return r;
        return b.total_sessions - a.total_sessions;
      });
  }

  return results;
}

// ── Single mentor, public ───────────────────────────────────────────────────

/**
 * The mentor behind `/mentors/<id>` — the public profile page.
 *
 * Deliberately NOT `getMentorById`, for two reasons that were both live bugs on
 * that page before this existed:
 *
 * 1. `getMentorById` reads through the request-scoped client, and every select
 *    policy on `achiever_profiles` is granted `to authenticated` (see
 *    supabase-global-station.sql). A signed-out visitor therefore read back
 *    zero rows, `getMentorById` returned null, and the page called notFound() —
 *    so every card in the public directory was a 404 for exactly the audience
 *    the directory is public for. RLS returning nothing is not an error, so
 *    nothing anywhere said so.
 *
 * 2. `getMentorById` selects `*`, and the page handed the whole row to a
 *    `'use client'` component. That serialises `legal_name`, `date_of_birth`,
 *    `stripe_account_id` and all four verification-document storage keys into
 *    the page payload, readable by anyone who opens the page source. The
 *    PublicMentor projection exists precisely to stop that, and this uses it.
 *
 * Same service-role reasoning as `getApprovedMentors`: nothing here is
 * user-scoped, so bypassing RLS leaks no per-user data — and the `approved`
 * filter is applied in the query, not by the caller, so a pending or suspended
 * mentor cannot be reached by guessing a URL.
 */
export async function getPublicMentorById(id: string): Promise<PublicMentor | null> {
  // A malformed id would make Postgres raise on the uuid cast rather than
  // return nothing, so filter it out before the round trip.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('achiever_profiles')
    .select(PUBLIC_MENTOR_SELECT)
    .eq('id', id)
    .eq('status', 'approved')
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as PublicMentor;
}

/**
 * The slots the booking calendar may offer, filtered to the ones checkout will
 * actually accept.
 *
 * `getMentorOpenSlots` is wrong for this surface twice over: it returns `held`
 * alongside `open`, and it starts at `now`. POST /api/mentorship/checkout
 * rejects both — a held slot 409s ("no longer available") and anything starting
 * within the hour 400s ("must be booked at least an hour in advance"). Offering
 * a time that cannot be booked is worse than not offering it, so the same two
 * rules are applied here rather than left for the student to discover at the
 * payment step.
 *
 * Service role for the same reason as the profile above — the read policy on
 * `mentor_availability_slots` is also `to authenticated`, so a signed-out
 * visitor saw an empty calendar and no explanation.
 */
export async function getPublicMentorSlots(
  mentorId: string,
  options?: { daysAhead?: number },
): Promise<MentorAvailabilitySlot[]> {
  const supabase = createAdminClient();

  // Release abandoned VNPay holds before rendering the public calendar. The
  // RPC is safe to re-run and is deliberately best-effort until the payment
  // migration has been deployed in every environment.
  await supabase.rpc('reclaim_vnpay_expired_holds');

  const leadTimeMs = 60 * 60 * 1000; // mirrors the checkout guard
  const fromIso = new Date(Date.now() + leadTimeMs).toISOString();
  const toIso = new Date(
    Date.now() + (options?.daysAhead ?? 90) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from('mentor_availability_slots')
    .select('id, mentor_id, starts_at, ends_at, status, booking_id, hold_expires_at, created_at')
    .eq('mentor_id', mentorId)
    .eq('status', 'open')
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Error fetching public slots:', error);
    return [];
  }

  return (data ?? []) as MentorAvailabilitySlot[];
}

/**
 * Visible reviews for the public profile.
 *
 * Narrowed by hand rather than `select('*')`: the row also carries
 * `reviewer_id` and `booking_id`, which identify the student who wrote it and
 * the session they bought. Neither is rendered, and neither belongs in a public
 * payload.
 *
 * ⚠️ There is no author name to show. `MentorReviewWithReviewer` declares a
 * `reviewer_name`, but `session_reviews` has no such column (see
 * supabase-global-station.sql) — so `select('*')` has always returned
 * undefined for it and the existing profile has always rendered reviews
 * unattributed. Rather than carry the fiction forward, this returns only the
 * columns that exist; the caller labels them accordingly.
 */
export type PublicMentorReview = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
};

export async function getPublicMentorReviews(
  mentorId: string,
  limit = 20,
): Promise<{ reviews: PublicMentorReview[]; count: number }> {
  const supabase = createAdminClient();

  const { data, error, count } = await supabase
    .from('session_reviews')
    .select('id, rating, comment, created_at', { count: 'exact' })
    .eq('achiever_id', mentorId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching public reviews:', error);
    return { reviews: [], count: 0 };
  }

  return { reviews: (data ?? []) as PublicMentorReview[], count: count ?? 0 };
}

// ── Single mentor ───────────────────────────────────────────────────────────

export async function getMentorById(
  id: string,
): Promise<MentorWithUniversity | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('achiever_profiles')
    .select(`
      *,
      university:universities!achiever_profiles_university_id_fkey (
        id,
        name,
        country
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as MentorWithUniversity;
}

// ── Availability slots — calendar style ─────────────────────────────────────

export async function getMentorOpenSlots(
  mentorId: string,
  options?: { fromIso?: string; toIso?: string },
): Promise<MentorAvailabilitySlot[]> {
  const supabase = await createClient();

  // Default: from now, looking 90 days ahead (the booking grid shows months).
  const fromIso = options?.fromIso ?? new Date().toISOString();
  const toIso =
    options?.toIso ??
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('mentor_availability_slots')
    .select('*')
    .eq('mentor_id', mentorId)
    .in('status', ['open', 'held'])
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Error fetching slots:', error);
    return [];
  }

  return (data ?? []) as MentorAvailabilitySlot[];
}

// All slots regardless of status — used in mentor's own dashboard editor.
export async function getMentorAllSlots(
  mentorId: string,
): Promise<MentorAvailabilitySlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mentor_availability_slots')
    .select('*')
    .eq('mentor_id', mentorId)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Error fetching slots:', error);
    return [];
  }
  return (data ?? []) as MentorAvailabilitySlot[];
}

// ── Reviews ────────────────────────────────────────────────────────────────

export async function getMentorReviews(
  mentorId: string,
  limit = 20,
): Promise<{ reviews: MentorReviewWithReviewer[]; count: number }> {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from('session_reviews')
    .select('*', { count: 'exact' })
    .eq('achiever_id', mentorId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching reviews:', error);
    return { reviews: [], count: 0 };
  }

  return {
    reviews: (data ?? []) as MentorReviewWithReviewer[],
    count: count ?? 0,
  };
}

// ── Mentors at university (for cross-page integration) ─────────────────────

export async function getMentorsByUniversity(
  universityId: number,
  limit = 3,
): Promise<MentorWithUniversity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('achiever_profiles')
    .select(`
      *,
      university:universities!achiever_profiles_university_id_fkey (
        id,
        name,
        country
      )
    `)
    .eq('status', 'approved')
    .eq('university_id', universityId)
    .order('avg_rating', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching mentors by university:', error);
    return [];
  }

  return (data ?? []) as MentorWithUniversity[];
}

// ── Slot management helpers (server-side only) ─────────────────────────────

/**
 * Hold a slot for `holdMinutes` while we create a Stripe Checkout session.
 * The Stripe webhook flips it to 'booked' on success; otherwise an expiry
 * cron should reset stale holds back to 'open'.
 *
 * We use the admin client here because the slot belongs to a different user
 * (the mentor), so the booking applicant can't update it under their own
 * RLS policy.
 */
export async function holdMentorSlot(
  slotId: number,
  holdMinutes = 30,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const expires = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString();

  // Atomically transition open → held. If the slot's already held/booked,
  // the update returns 0 rows affected.
  const { data, error } = await admin
    .from('mentor_availability_slots')
    .update({ status: 'held', hold_expires_at: expires })
    .eq('id', slotId)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Slot is no longer available' };
  return { ok: true };
}

/**
 * Validate that a currency string is one we support.
 */
export function isSupportedCurrency(value: unknown): value is Currency {
  return value === 'USD' || value === 'GBP' || value === 'VND';
}
