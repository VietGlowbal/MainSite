/**
 * Team data access — powers the team sections on Home and About.
 *
 * DB schema: supabase-team.sql (public.team_members + public.team_achievements).
 *
 * The team roster is identical for every visitor, so we read it through the
 * admin client inside `unstable_cache` — exactly like getAllUniversities — to
 * keep both routes statically prerendered (ISR) instead of forcing them
 * dynamic via the cookie-bound server client.
 *
 * Every reader is fail-soft: if the migration hasn't been run yet (missing
 * table) or the query errors, we return an empty list and the UIs fall back to
 * their built-in empty states.
 */
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Team photos are sometimes stored as Google Drive *share* links
 * (`drive.google.com/file/d/<ID>/view`), which `next/image` can't render — that
 * URL is an HTML viewer page, not an image, so it throws "Invalid src prop".
 * Rewrite any Drive link to the thumbnail endpoint, which returns a real image
 * (and redirects to googleusercontent for delivery). Non-Drive URLs pass
 * through untouched. The file must be shared "anyone with the link".
 */
export function normalizeDriveImageUrl(url: string | null): string | null {
  if (!url || !/drive\.google\.com/i.test(url)) return url;
  const id =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    null;
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : url;
}

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
    for (const m of members) {
      // Drive share links can't be rendered by next/image — normalize them.
      m.photo_url = normalizeDriveImageUrl(m.photo_url);
      // Order each member's achievements by display_order for stable rendering.
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
  /* The `?? null` on both reads is not dead code under the length check above:
     this module is now imported from src/features (the About team mosaic), so it
     is typechecked under tsconfig.strict.json, where noUncheckedIndexedAccess
     types an index read as `T | undefined` and the return type says `| null`. */
  if (featuredIndex === -1) {
    return { featured: members[0] ?? null, rest: members.slice(1) };
  }
  const featured = members[featuredIndex] ?? null;
  const rest = members.filter((_, i) => i !== featuredIndex);
  return { featured, rest };
}
