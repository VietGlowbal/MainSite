import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserUniversity, ApplicationTask } from '@/lib/types';
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

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="glow-pill">My universities</span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Your application tracker
            </h1>
            <p className="max-w-2xl text-slate-500 leading-7">
              {(userUniversities ?? []).length > 0
                ? 'Track your applications, complete tasks, and stay on top of deadlines.'
                : 'You haven\'t saved any universities yet. Search and add some to get started.'}
            </p>
          </div>
          {(userUniversities ?? []).length === 0 && (
            <a
              href="/universities"
              className="shrink-0 rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)]"
            >
              Search universities
            </a>
          )}
        </div>

        <MyUniversitiesClient
          userUniversities={(userUniversities ?? []) as (UserUniversity & { university: NonNullable<UserUniversity['university']> })[]}
          allTasks={allTasks}
        />
      </div>
    </main>
  );
}
