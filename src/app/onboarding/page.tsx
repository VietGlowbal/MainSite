import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './profile-form';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (await supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle()).data
    : null;

  return (
    <main className="onboarding-page-shell bg-transparent px-4 py-6 text-slate-800 md:px-8 lg:px-10">
      <div className="onboarding-page-inner mx-auto">
        <OnboardingForm initialProfile={profile} />
      </div>
    </main>
  );
}
