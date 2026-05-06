import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ApplicationTask, University } from '@/lib/types';
import { TaskList } from './task-list';
import Link from 'next/link';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function UniversityTasksPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const { data: userUniversity } = await supabase
    .from('user_universities')
    .select('*, university:universities(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!userUniversity) redirect('/my-universities');

  const { data: tasks } = await supabase
    .from('application_tasks')
    .select('*')
    .eq('user_university_id', userUniversity.id)
    .order('sort_order', { ascending: true });

  const university = userUniversity.university as University;

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-slate-800 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back link */}
        <Link
          href="/my-universities"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to my universities
        </Link>

        {/* Header */}
        <div className="glow-card space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {university.country} · {university.type ?? 'University'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            {university.name}
          </h1>
          <div className="flex flex-wrap gap-2 text-xs">
            {university.qs_rank && (
              <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 font-semibold text-sky-600">
                QS #{university.qs_rank}
              </span>
            )}
            {userUniversity.match_score != null && (
              <span className="rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 font-semibold text-pink-600">
                {userUniversity.match_score}% match
              </span>
            )}
            {university.application_deadline && (
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-600">
                Deadline: {university.application_deadline}
              </span>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <Link
              href={`/my-universities/${id}/writer`}
              className="rounded-xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-100 transition"
            >
              Open AI Writer
            </Link>
          </div>
        </div>

        {/* Tasks */}
        <TaskList tasks={(tasks ?? []) as ApplicationTask[]} userUniversityId={userUniversity.id} />

        {/* Mentoring stub */}
        <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 mb-1">Talk to someone who goes here</h3>
          <p className="text-sm text-slate-500 mb-4">
            Get real advice from current students and alumni at {university.name}.
          </p>
          <button
            type="button"
            className="border border-pink-300 text-pink-600 rounded-full px-6 py-2 text-sm font-semibold hover:bg-pink-50 transition-colors"
          >
            Notify me when mentors are available →
          </button>
        </div>
      </div>
    </main>
  );
}
