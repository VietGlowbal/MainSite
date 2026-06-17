/**
 * Team data access — powers the homepage "Team behind GlowBal" section.
 *
 * DB schema: supabase-team.sql (public.team_members + public.team_achievements).
 *
 * The team roster is identical for every visitor, so we read it through the
 * admin client inside `unstable_cache` — exactly like getAllUniversities — to
 * keep the home route statically prerendered (ISR) instead of forcing it
 * dynamic via the cookie-bound server client.
 *
 * Every reader is fail-soft: if the migration hasn't been run yet (missing
 * table) or the query errors, we return an empty list and the UI falls back to
 * its built-in static founder card.
 */
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export type TeamAchievementCategory =
  | 'scholarship'
  | 'mentoring'
  | 'education'
  | 'leadership'
  | 'award'
  | 'debate'
  | 'international_experience'
  | 'product'
  | 'quote';

export type TeamAchievement = {
  id: string;
  category: TeamAchievementCategory;
  title: string;
  description: string | null;
  year: number | null;
  display_order: number;
};

export type TeamMember = {
  id: string;
  full_name: string;
  slug: string;
  role: string;
  short_bio: string | null;
  photo_url: string | null;
  university: string | null;
  degree: string | null;
  major: string | null;
  exchange_university: string | null;
  favourite_quote: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  email: string | null;
  display_order: number;
  is_featured: boolean;
  is_visible: boolean;
  achievements: TeamAchievement[];
};

export const getTeamMembers = unstable_cache(
  async (): Promise<TeamMember[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('team_members')
      .select(
        `
        id, full_name, slug, role, short_bio, photo_url,
        university, degree, major, exchange_university,
        favourite_quote, linkedin_url, instagram_url, email,
        display_order, is_featured, is_visible,
        achievements:team_achievements (
          id, category, title, description, year, display_order
        )
      `,
      )
      .eq('is_visible', true)
      .order('display_order', { ascending: true });

    if (error || !data) {
      // Table missing (pre-migration) or transient error — let the UI fall back.
      if (error) console.error('Error fetching team members:', error.message);
      return [];
    }

    const members = data as unknown as TeamMember[];
    // Order each member's achievements by display_order for stable rendering.
    for (const m of members) {
      m.achievements = (m.achievements ?? []).sort(
        (a, b) => a.display_order - b.display_order,
      );
    }
    return members;
  },
  ['team-members'],
  { revalidate: 43200, tags: ['team'] },
);

/** Splits the roster into the featured founder spotlight + the remaining grid. */
export function splitTeam(members: TeamMember[]): {
  featured: TeamMember | null;
  rest: TeamMember[];
} {
  if (members.length === 0) return { featured: null, rest: [] };
  const featuredIndex = members.findIndex((m) => m.is_featured);
  if (featuredIndex === -1) {
    return { featured: members[0], rest: members.slice(1) };
  }
  const featured = members[featuredIndex];
  const rest = members.filter((_, i) => i !== featuredIndex);
  return { featured, rest };
}
