import { listGeoGuides, listGeoTopics } from '@/lib/geo-content';
import { createClient } from '@/lib/supabase/server';
import { GuidesClient } from './guides-client';

export const metadata = {
  title: 'Glowbal Guides - Study-abroad guides & insights',
  description: 'Expert insights, real student stories, and practical guides to help you plan, apply and succeed.',
};

export const revalidate = 300;

export default async function GuidesIndexPage() {
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
    <GuidesClient
      allGuides={allGuides}
      topics={topics}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
