import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { Badge, Button, Input } from '@/shared/ui';
import { recordWaitlistSignup } from '@/features/marketing/api';
import { sendEmail } from '@/lib/send-email';
import { waitlistConfirmationEmail } from '@/lib/emails/waitlist-confirmation';
import { SITE_GATE_COOKIE, checkGatePassword, computeGateToken, isSiteLockEnabled } from '@/lib/site-gate';
import type { WaitlistState } from '@/lib/types';
import { ComingSoonWaitlistForm } from './coming-soon-waitlist-form';

export const metadata: Metadata = {
  title: 'GLOWBAL — Launching soon',
  description: 'GLOWBAL is offline for a short redesign. Leave your email and we’ll let you know when we’re back.',
  robots: { index: false, follow: false },
};

/**
 * The pre-launch site lock's public face — see LAUNCH_PLAN.md and
 * src/lib/site-gate.ts. src/proxy.ts sends every visitor here while
 * SITE_LOCK_ENABLED=1 and they don't have a valid gate cookie yet.
 *
 * Two halves on one page, like a standard staging password screen:
 *   - a real waitlist signup (same `waitlist_signups` table + confirmation
 *     email as the live "/" form), so the lock doubles as lead capture
 *   - a collapsed "team access code" form that sets the cookie proxy.ts
 *     checks, built as a plain <form action> so it works with zero client JS
 *
 * No Figma frame covers this screen — it's ops infrastructure, not a
 * redesigned product page — so it borrows /auth's bare-centered-card
 * treatment (`gb-page-full-bleed`, own chrome) rather than inventing a look.
 */

async function joinWaitlist(_prevState: WaitlistState, formData: FormData): Promise<WaitlistState> {
  'use server';

  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  try {
    const result = await recordWaitlistSignup({ email, firstName, notes });

    if (result.outcome === 'table-missing') {
      return { status: 'error', message: 'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase.' };
    }
    if (result.outcome === 'error') {
      return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
    }

    if (result.outcome === 'inserted') {
      await sendEmail({
        to: email,
        subject: "You're on the GLOWBAL waitlist",
        html: waitlistConfirmationEmail(firstName),
      });
    }

    return { status: 'ok', message: "You're on the list. We'll email you the moment we're back." };
  } catch {
    return { status: 'error', message: 'Something went wrong saving your signup. Please try again.' };
  }
}

async function unlockGate(formData: FormData): Promise<void> {
  'use server';

  const password = String(formData.get('password') || '');
  const fromRaw = String(formData.get('from') || '/');
  const from = fromRaw.startsWith('/') ? fromRaw : '/';

  const token = checkGatePassword(password) ? computeGateToken() : null;
  if (!token) {
    redirect(`/coming-soon?from=${encodeURIComponent(from)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SITE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Team re-enters the code roughly monthly, not every session.
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(from);
}

type Props = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function ComingSoonPage({ searchParams }: Props) {
  const params = await searchParams;
  const from = params.from && params.from.startsWith('/') ? params.from : '/';
  const wrongCode = params.error === '1';

  // The lock might already be off, or this browser might already hold a
  // valid cookie (e.g. a bookmarked /coming-soon link) — either way there's
  // nothing to gate, send them on to where they were headed.
  if (!isSiteLockEnabled()) {
    redirect('/');
  }
  const cookieStore = await cookies();
  const alreadyUnlocked = computeGateToken() === cookieStore.get(SITE_GATE_COOKIE)?.value;
  if (alreadyUnlocked) {
    redirect(from);
  }

  return (
    <div className="gb-page-full-bleed flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-gb-xl py-gb-6xl">
        <div className="w-full max-w-gb-width-sm">
          <GlowbalLogo height={28} className="mx-auto" priority alt="Glowbal" />

          <div className="mt-gb-4xl text-center">
            <Badge variant="brand-subtle">Launching soon</Badge>
            <h1 className="mt-gb-lg font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
              We&rsquo;re building something new
            </h1>
            <p className="mt-gb-md text-gb-md text-fg-tertiary">
              GLOWBAL is offline for a short redesign. Leave your email and we&rsquo;ll let you
              know the moment we&rsquo;re back.
            </p>
          </div>

          <div className="mt-gb-4xl rounded-gb-xl border border-line bg-surface p-gb-3xl shadow-gb-xs">
            <ComingSoonWaitlistForm action={joinWaitlist} />
          </div>

          {/* `open` only when arriving with `?error=1` — an unset attribute still
              toggles freely from the user's own click; forcing it every render
              would fight that. Without this, a wrong access code collapses
              back to closed on redirect and hides the very error it just set. */}
          <details open={wrongCode || undefined} className="mt-gb-3xl text-center">
            <summary className="cursor-pointer list-none text-gb-sm font-medium text-fg-muted hover:text-fg-secondary">
              GLOWBAL team? Enter your access code
            </summary>
            <form action={unlockGate} method="post" className="mx-auto mt-gb-lg flex flex-col gap-gb-md text-left">
              <input type="hidden" name="from" value={from} />
              <Input
                name="password"
                type="password"
                label="Access code"
                required
                autoComplete="off"
                error={wrongCode ? 'Incorrect access code.' : undefined}
              />
              <Button type="submit" variant="secondary" size="md">
                Unlock
              </Button>
            </form>
          </details>
        </div>
      </main>
    </div>
  );
}
