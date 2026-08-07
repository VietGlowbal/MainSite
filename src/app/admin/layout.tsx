import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth-helpers';
import { Badge } from '@/shared/ui';
import { AdminTabs } from './admin-tabs';

/**
 * Shared shell for /admin/*.
 *
 * Verifies admin status once, then renders the tabbed sub-nav and the
 * page content. Individual pages can still re-check if they need the
 * user object, but the gate here keeps unauthenticated requests off
 * every admin route.
 *
 * ⚠️ NO FIGMA FRAME EXISTS FOR THIS CONSOLE. Rebuilt on the token scale at the
 * owner's request — see the note at the top of src/shared/ui/panel.tsx. The
 * dark header band is the footer/top-nav vocabulary (`surface-inverse-deep`
 * plus the `fg-on-inverse-*` ramp), which is what ties an internal tool to the
 * product it administers. The old header used `.glow-pill`, one of the legacy
 * class families CLAUDE.md quarantines.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/admin');
  if (!(await isAdmin(user.id))) redirect('/apply');

  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl">
      <div className="mx-auto flex max-w-gb-desktop flex-col gap-gb-4xl">
        <header className="flex flex-col gap-gb-3xl rounded-gb-2xl bg-surface-inverse-deep p-gb-3xl md:p-gb-5xl">
          <div className="flex flex-col gap-gb-lg">
            <Badge variant="outline" className="w-fit">
              Admin console
            </Badge>
            <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg-on-inverse">
              Manage GlowBal
            </h1>
            <p className="max-w-gb-width-xl text-gb-md text-fg-on-inverse-muted">
              Approve advisors, confirm bookings, and manage the user base.
            </p>
          </div>

          <AdminTabs />
        </header>

        {children}
      </div>
    </main>
  );
}
