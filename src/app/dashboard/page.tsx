import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen bg-transparent px-6 py-16 text-slate-800 md:px-10">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-4 leading-7 text-slate-600">
            Sign in first to see your profile, recommendation runs, and saved options.
          </p>
          <Link href="/auth" className="mt-6 inline-flex rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-5 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)]">
            Go to auth
          </Link>
        </div>
      </main>
    );
  }

  const [profileResult, runsResult, savedResult, documentsResult] = await Promise.all([
    supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('recommendation_runs').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('saved_options').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('uploaded_documents').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const profile = profileResult.data;
  const metrics = [
    { label: 'Recommendation runs', value: runsResult.count ?? 0 },
    { label: 'Saved options', value: savedResult.count ?? 0 },
    { label: 'Uploaded documents', value: documentsResult.count ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 text-slate-800 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-600">
            Student dashboard
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900">Welcome back, {user.user_metadata?.full_name || user.email}</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            This is becoming the student home base for profile progress, document uploads,
            recommendation runs, and saved options.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[1.5rem] border border-black/5 bg-white/80 p-6 shadow-[0_10px_24px_rgba(22,33,62,0.05)] backdrop-blur">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{metric.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <article className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
            <h2 className="text-2xl font-semibold text-slate-900">Current profile snapshot</h2>
            {profile ? (
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <p><strong className="text-slate-900">Study level:</strong> {profile.study_level || 'Not set'}</p>
                <p><strong className="text-slate-900">Target subjects:</strong> {(profile.target_subjects || []).join(', ') || 'Not set'}</p>
                <p><strong className="text-slate-900">Preferred countries:</strong> {(profile.preferred_countries || []).join(', ') || 'Not set'}</p>
                <p><strong className="text-slate-900">Budget:</strong> {profile.budget_range || 'Not set'}</p>
              </div>
            ) : (
              <p className="mt-4 text-slate-600">No profile saved yet. Head to onboarding to create one.</p>
            )}
          </article>

          <article className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
            <h2 className="text-2xl font-semibold text-slate-900">Next recommended actions</h2>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li>Finish or refine onboarding profile</li>
              <li>Upload a CV or personal statement</li>
              <li>Generate the first real shortlist</li>
              <li>Save and compare strong options</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
