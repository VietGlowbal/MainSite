import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth-helpers';
import { AdminTabs } from './admin-tabs';

/**
 * Shared shell for /admin/*.
 *
 * Verifies admin status once, then renders the tabbed sub-nav and the
 * page content. Individual pages can still re-check if they need the
 * user object, but the gate here keeps unauthenticated requests off
 * every admin route.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/admin');
  if (!(await isAdmin(user.id))) redirect('/my-universities');

  return (
    <main className="min-h-screen bg-transparent px-6 py-12 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <span className="glow-pill">Admin Console</span>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Manage Glowbal
          </h1>
          <p className="text-sm text-slate-500">
            Approve mentors, confirm bookings, and manage the user base.
          </p>
        </header>

        <AdminTabs />

        <div>{children}</div>
      </div>
    </main>
  );
}
