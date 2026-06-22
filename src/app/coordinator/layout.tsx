import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isCoordinator } from '@/lib/auth-helpers';

/**
 * Shell for /coordinator/*.
 *
 * Verifies coordinator status once and gates the whole area, mirroring the
 * /admin layout. Non-coordinators are bounced to the student app.
 */
export default async function CoordinatorLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/coordinator');
  if (!(await isCoordinator(user.id))) redirect('/apply');

  return (
    <main className="min-h-screen bg-transparent px-6 py-12 md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-3">
          <span className="glow-pill">Coordinator</span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Ambassadors
          </h1>
          <p className="text-sm text-slate-500">
            Create a share link for each ambassador and track how much traffic each one drives.
          </p>
        </header>

        <div>{children}</div>
      </div>
    </main>
  );
}
