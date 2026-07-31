import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';
import { createClient } from '@/lib/supabase/server';
import { NewsClient } from './news-client';

export const metadata = {
  title: 'GLOWBAL News & Guides',
  description:
    'Study-abroad news, generated guides, trending topics, and scholarship stories from Glowbal.',
};

// Re-render at most every 5 minutes; admin edits trigger on-demand
// revalidation (see /api/admin/news) so changes appear within seconds.
export const revalidate = 300;

export default async function NewsPage() {
  const supabase = await createClient();
  // The redesigned page carries its own header (Figma 153:18267), which shows
  // either the signed-in user or a "Sign in" action — hence the auth read.
  const [allGuides, topics, { data: { user } }] = await Promise.all([
    listGeoGuides(),
    listGeoTopics(),
    supabase.auth.getUser(),
  ]);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split('@')[0] || null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <NewsClient
      allGuides={allGuides}
      topics={topics}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
