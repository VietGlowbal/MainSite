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
>;

const PUBLIC_MENTOR_SELECT = `
  id, display_name, avatar_url, university_id, degree_level, subject,
  graduation_year, currently_enrolled, bio, help_topics, strengths, languages,
  total_sessions, avg_rating, hourly_rate_amount, hourly_rate_currency, created_at,
  university:universities!achiever_profiles_university_id_fkey ( id, name, country )
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
