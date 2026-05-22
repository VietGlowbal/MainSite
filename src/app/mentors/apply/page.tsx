import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MentorSignupForm } from '@/components/mentorship/MentorSignupForm';

export default async function MentorApplyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/mentors/apply');
  }

  // If they already have a mentor profile, send them to their dashboard.
  const { data: existing } = await supabase
    .from('achiever_profiles')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle();
  if (existing) {
    redirect('/dashboard/mentor');
  }

  // Universities for the picker — names + countries only, public read OK.
  const { data: universities } = await supabase
    .from('universities')
    .select('id, name, country')
    .order('name');

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    '';

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <span className="glow-pill">Become a mentor</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Help the next generation of students
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Share your experience, set your hourly rate, and earn money helping applicants
            get into your university. We verify every mentor manually.
          </p>
        </div>

        <MentorSignupForm
          userId={user.id}
          defaultDisplayName={displayName}
          universities={universities ?? []}
        />
      </div>
    </main>
  );
}
