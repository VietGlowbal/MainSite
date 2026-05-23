import { createClient } from '@/lib/supabase/server';
import type { MentorStatus } from '@/types/mentorship';

export type MentorSummary = {
  id: string;
  status: MentorStatus;
  display_name: string | null;
};

/**
 * Server-side helper: returns the current user's mentor profile summary,
 * or null if they don't have one. Used by the header, sidebar, and profile
 * page so we can show a "Mentor dashboard" link to people who already
 * applied (regardless of approval state).
 *
 * Pending mentors still see the link so they can check their status; only
 * approved mentors get the prominent CTA in the profile hero.
 */
export async function getMentorSummary(): Promise<MentorSummary | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('achiever_profiles')
    .select('id, status, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;
  return data as MentorSummary;
}
