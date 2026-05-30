import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ApplyDashboard } from './apply-dashboard';
import {
  MOCK_APPLICATIONS,
  MOCK_SHORTLISTED,
  MOCK_UPCOMING_DEADLINES,
  MOCK_OVERVIEW,
} from '@/lib/apply-mock-data';

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <ApplyDashboard
          applications={MOCK_APPLICATIONS}
          shortlisted={MOCK_SHORTLISTED}
          upcomingDeadlines={MOCK_UPCOMING_DEADLINES}
          overview={MOCK_OVERVIEW}
        />
      </div>
    </main>
  );
}
