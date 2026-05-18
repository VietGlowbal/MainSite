import { createClient } from '@/lib/supabase/server';
import type {
  AchieverWithUniversity,
  AchieverAvailability,
  AchieverFilters,
  ReviewWithReviewer,
} from '@/types/achievers';

// ── Browse: get approved achievers with university info ─────────────────────

export async function getApprovedAchievers(
  filters?: AchieverFilters,
): Promise<AchieverWithUniversity[]> {
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
    .eq('status', 'approved');

  if (error) {
    console.error('Error fetching achievers:', error);
    return [];
  }

  let results = (data ?? []) as AchieverWithUniversity[];

  // Client-side filtering (spec says filters are client-side, but we can also
  // apply server-side for the initial university filter from URL params)
  if (filters?.university_id) {
    results = results.filter((a) => a.university_id === filters.university_id);
  }
  if (filters?.subject) {
    const q = filters.subject.toLowerCase();
    results = results.filter((a) => a.subject.toLowerCase().includes(q));
  }
  if (filters?.min_price) {
    results = results.filter((a) => a.session_price_vnd >= filters.min_price!);
  }
  if (filters?.max_price) {
    results = results.filter((a) => a.session_price_vnd <= filters.max_price!);
  }
  if (filters?.languages && filters.languages.length > 0) {
    results = results.filter((a) =>
      filters.languages!.some((lang) => a.languages.includes(lang)),
    );
  }
  if (filters?.currently_enrolled !== undefined) {
    results = results.filter((a) => a.currently_enrolled === filters.currently_enrolled);
  }

  // Sort
  switch (filters?.sort) {
    case 'newest':
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'price_asc':
      results.sort((a, b) => a.session_price_vnd - b.session_price_vnd);
      break;
    case 'price_desc':
      results.sort((a, b) => b.session_price_vnd - a.session_price_vnd);
      break;
    default:
      // Default: rating DESC, then total_sessions DESC
      results.sort((a, b) => {
        if (b.avg_rating !== a.avg_rating) return Number(b.avg_rating) - Number(a.avg_rating);
        return b.total_sessions - a.total_sessions;
      });
  }

  return results;
}

// ── Single achiever by ID ───────────────────────────────────────────────────

export async function getAchieverById(id: string): Promise<AchieverWithUniversity | null> {
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
  return data as AchieverWithUniversity;
}

// ── Availability slots for an achiever ──────────────────────────────────────

export async function getAvailableSlots(achieverId: string): Promise<AchieverAvailability[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('achiever_availability')
    .select('*')
    .eq('achiever_id', achieverId)
    .eq('is_active', true)
    .order('day_of_week')
    .order('start_time');

  if (error) {
    console.error('Error fetching availability:', error);
    return [];
  }

  return (data ?? []) as AchieverAvailability[];
}

// ── Reviews for an achiever ─────────────────────────────────────────────────

export async function getAchieverReviews(
  achieverId: string,
  limit = 10,
  offset = 0,
): Promise<{ reviews: ReviewWithReviewer[]; count: number }> {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from('session_reviews')
    .select('*', { count: 'exact' })
    .eq('achiever_id', achieverId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching reviews:', error);
    return { reviews: [], count: 0 };
  }

  return {
    reviews: (data ?? []) as ReviewWithReviewer[],
    count: count ?? 0,
  };
}

// ── Achievers by university (for integration cards) ─────────────────────────

export async function getAchieversByUniversity(
  universityId: number,
  limit = 3,
): Promise<AchieverWithUniversity[]> {
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
    console.error('Error fetching achievers by university:', error);
    return [];
  }

  return (data ?? []) as AchieverWithUniversity[];
}
