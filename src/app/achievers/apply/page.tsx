import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AchieverApplyForm } from './apply-form';

export default async function AchieverApplyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/achievers/apply');
  }

  // Check if user already has an achiever profile
  const { data: existing } = await supabase
    .from('achiever_profiles')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    redirect('/dashboard/achiever');
  }

  // Get universities for the dropdown
  const { data: universities } = await supabase
    .from('universities')
    .select('id, name, country')
    .order('name');

  const displayName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '';

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <span className="glow-pill">Global Station</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Become an Achiever
          </h1>
          <p className="mt-2 text-slate-500 leading-7 max-w-md mx-auto">
            Share your experience with students who want to follow in your footsteps. Set your own price and schedule.
          </p>
        </div>

        <AchieverApplyForm
          userId={user.id}
          defaultDisplayName={displayName}
          universities={universities ?? []}
        />
      </div>
    </main>
  );
}
