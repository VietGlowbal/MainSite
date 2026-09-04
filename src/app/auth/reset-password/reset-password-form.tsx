'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { Button, controlClasses } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { useT } from '@/lib/i18n';
import {
  authErrorFromResponse,
  authErrorText,
  PASSWORD_MIN_LENGTH,
  type AuthErrorState,
} from '@/features/auth/domain';

function IconEye({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

/**
 * Sets a new password using the recovery token from the emailed link.
 *
 * The token is NOT redeemed on arrival — it is posted together with the new
 * password and spent by the confirm route, so the change is bound to possession
 * of the email rather than to whoever happens to be signed in on this browser.
 * See `src/app/api/auth/reset-password/confirm/route.ts`.
 */
export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get('token'), [searchParams]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Updating your password');

  /*
   * Drop the token from the address bar once React has it in state.
   * `replaceState` rather than a router navigation so the component does not
   * remount and lose it. It stays in the email either way, but this keeps it
   * out of the visible URL, out of forward history, and out of the `Referer`
   * header on any link the user clicks from this page.
   */
  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    // Checked here only so the user is not told about it by a round trip. The
    // server does not receive `confirm` at all — it is a typo guard, not a rule.
    if (password !== confirm) {
      setError({ text: 'Those passwords do not match.' });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(authErrorFromResponse(data, 'Could not update your password.'));
        return;
      }
      // The confirm route left a valid session behind, so go straight in.
      router.push('/profile');
      router.refresh();
    } catch {
      setError({ text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full text-center">
        <GlowbalLogo height={28} />
        <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold text-fg">
          {t('This reset link is not valid')}
        </h1>
        <p className="mt-gb-md text-gb-md text-fg-tertiary">
          {t('The link may have expired or already been used. Request a new one to continue.')}
        </p>
        <Link
          href="/auth"
          className="mt-gb-3xl inline-block font-semibold text-fg-brand hover:underline"
        >
          {t('Back to sign in')}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-gb-3xl flex flex-col items-center gap-gb-lg text-center">
        <GlowbalLogo height={28} />
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-xs font-semibold text-fg">
            {t('Choose a new password')}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {t('You will be signed in once your new password is saved.')}
          </p>
        </div>
      </div>

      {/* POST for the same reason as /auth: a pre-hydration native submit must
          not put a password in the query string. There is no POST handler here. */}
      <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-gb-xl">
        <div className="flex flex-col gap-gb-sm">
          <label htmlFor="new-password" className="text-gb-sm font-medium text-fg-secondary">
            {t('New password')}
          </label>
          <div className="relative">
            <input
              id="new-password"
              name="new-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('Create a password')}
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
              className={controlClasses(false, 'pr-gb-6xl')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('Hide password') : t('Show password')}
              className="absolute inset-y-0 right-gb-input-x flex items-center text-fg-muted transition-colors hover:text-fg-secondary"
            >
              <IconEye off={showPassword} />
            </button>
          </div>
          <p className="text-gb-xs text-fg-tertiary">
            {t('At least {min} characters. Checked against known data breaches.', {
              min: PASSWORD_MIN_LENGTH,
            })}
          </p>
        </div>

        <div className="flex flex-col gap-gb-sm">
          <label htmlFor="confirm-password" className="text-gb-sm font-medium text-fg-secondary">
            {t('Confirm new password')}
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t('Re-enter your password')}
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className={controlClasses(false)}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {authErrorText(error, t)}
          </p>
        ) : null}

        <Button type="submit" size="xl" disabled={loading} className="w-full">
          {loading ? t('Please wait…') : t('Save new password')}
        </Button>
      </form>

      <p className="mt-gb-3xl text-center text-gb-sm text-fg-tertiary">
        <Link href="/auth" className="font-semibold text-fg-brand hover:underline">
          {t('Back to sign in')}
        </Link>
      </p>
    </div>
  );
}
