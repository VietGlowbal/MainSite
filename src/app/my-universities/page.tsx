import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveWikiImages } from '@/lib/wiki-images';
import type { UserUniversity, ApplicationTask, University } from '@/lib/types';
import { MyUniversitiesClient } from './my-universities-client';

export default async function MyUniversitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  // Fetch user's saved universities with university details
  const { data: userUniversities } = await supabase
    .from('user_universities')
    .select('*, university:universities(*)')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  // Fetch all tasks for these universities
  const uuIds = (userUniversities ?? []).map((uu: UserUniversity) => uu.id);
  let allTasks: ApplicationTask[] = [];

  if (uuIds.length > 0) {
    const { data: tasks } = await supabase
      .from('application_tasks')
      .select('*')
      .in('user_university_id', uuIds)
      .order('sort_order', { ascending: true });
    allTasks = (tasks ?? []) as ApplicationTask[];
  }

  // Resolve Wikipedia thumbnail images for saved universities
  const wikiTitles = (userUniversities ?? [])
    .map((uu: UserUniversity & { university?: University }) => uu.university?.name)
    .filter((n): n is string => !!n)
    .map((n: string) => n.replace(/\s+/g, '_'));

  const wikiImages = await resolveWikiImages(wikiTitles);

  // Inject image_url into each university
  const enriched = (userUniversities ?? []).map(
    (uu: UserUniversity & { university?: University }) => ({
      ...uu,
      university: uu.university
        ? {
            ...uu.university,
            image_url: wikiImages.get(uu.university.name.replace(/\s+/g, '_')) ?? null,
          }
        : uu.university,
    }),
  );

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <MyUniversitiesClient
          userUniversities={enriched as (UserUniversity & { university: NonNullable<UserUniversity['university']> })[]}
          allTasks={allTasks}
        />
      </div>
    </main>
  );
}
