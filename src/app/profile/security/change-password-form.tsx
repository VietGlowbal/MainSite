'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button, controlClasses, EyeMark, ICONS, KitIcon, Panel } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { useT } from '@/lib/i18n';
import {
  authErrorFromResponse,
  authErrorText,
  PASSWORD_MIN_LENGTH,
  type AuthErrorState,
} from '@/features/auth/domain';

/**
 * The password controls on /profile/security.
 *
 * No Figma frame — the reset flow was missing from the design entirely
 * (`docs/known-issues.md §0i`) and this is the signed-in half of it. The layout
 * borrows the profile editors' `Panel`, and the fields use the same
 * `controlClasses` as the /auth card, so the two password forms a student can
 * meet look like the same product.
 */

/** One labelled password box. The reveal toggle is optional so only one field carries it. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  reveal,
  hint,
  onToggleReveal,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  reveal: boolean;
  hint?: string | undefined;
  onToggleReveal?: (() => void) | undefined;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-gb-sm">
      <label htmlFor={id} className="text-gb-sm font-medium text-fg-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          {...(autoComplete === 'new-password' ? { minLength: PASSWORD_MIN_LENGTH } : {})}
          autoComplete={autoComplete}
          className={controlClasses(false, onToggleReveal ? 'pr-gb-6xl' : undefined)}
        />
        {onToggleReveal ? (
          <button
            type="button"
            onClick={onToggleReveal}
            aria-label={reveal ? t('Hide password') : t('Show password')}
            className="absolute inset-y-0 right-gb-input-x flex items-center text-fg-muted transition-colors hover:text-fg-secondary"
          >
            <EyeMark off={reveal} />
          </button>
        ) : null}
      </div>
      {hint ? <p className="text-gb-xs text-fg-tertiary">{hint}</p> : null}
    </div>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  const t = useT();
  const [current, setCurrent] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Updating your password');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Local typo guard. `confirm` is never sent — the server has no opinion
    // about it, and posting it would put a third copy of the password on the
    // wire for nothing.
    if (nextPassword !== confirm) {
      setError({ text: 'Those passwords do not match.' });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: nextPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(authErrorFromResponse(data, 'Could not update your password.'));
        return;
      }
      // Clear all three before switching view: the component stays mounted
      // behind the success panel and would otherwise keep both passwords in
      // state for as long as the page is open.
      setCurrent('');
      setNextPassword('');
      setConfirm('');
      setDone(true);
    } catch {
      setError({ text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Panel padding="sm" className="flex flex-col gap-gb-lg">
        <div className="flex items-center gap-gb-md">
          <span className="text-fg-brand">
            <KitIcon art={ICONS.checkCircle} frame={24} />
          </span>
          <h2 className="font-display text-gb-lg font-semibold text-fg">
            {t('Your password has been updated')}
          </h2>
        </div>
        <p className="text-gb-sm text-fg-tertiary">
          {t(
            'Every other device that was signed in has been signed out. You are still signed in here.',
          )}
        </p>
        <p className="text-gb-sm text-fg-tertiary">
          {t('We emailed {email} to confirm the change.', { email })}
        </p>
        <Link href="/profile" className="w-fit font-semibold text-fg-brand hover:underline">
          {t('Back to profile')}
        </Link>
      </Panel>
    );
  }

  return (
    <Panel padding="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-gb-xl">
        {/*
          Password managers need to know WHICH account these fields belong to.
          With no username field in the form they either skip the update prompt
          or offer to save the new password under the wrong entry. Hidden
          because the address is already stated above the form.
        */}
        <input type="text" name="username" value={email} autoComplete="username" readOnly hidden />

        <PasswordField
          id="current-password"
          label={t('Current password')}
          value={current}
          onChange={setCurrent}
          placeholder={t('Enter your current password')}
          autoComplete="current-password"
          reveal={reveal}
        />

        <PasswordField
          id="new-password"
          label={t('New password')}
          value={nextPassword}
          onChange={setNextPassword}
          placeholder={t('Create a password')}
          autoComplete="new-password"
          reveal={reveal}
          onToggleReveal={() => setReveal((v) => !v)}
          hint={t('At least {min} characters. Checked against known data breaches.', {
            min: PASSWORD_MIN_LENGTH,
          })}
        />

        <PasswordField
          id="confirm-password"
          label={t('Confirm new password')}
          value={confirm}
          onChange={setConfirm}
          placeholder={t('Re-enter your password')}
          autoComplete="new-password"
          reveal={reveal}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error"
          >
            {authErrorText(error, t)}
          </p>
        ) : null}

        <p className="text-gb-xs text-fg-tertiary">
          {t('Changing your password signs you out everywhere else.')}
        </p>

        <Button type="submit" size="lg" disabled={loading} className="w-fit">
          {loading ? t('Please wait…') : t('Update password')}
        </Button>
      </form>
    </Panel>
  );
}

/**
 * The Google-only branch: no password exists, so there is no current one to ask
 * for and the form above cannot be used.
 *
 * This deliberately does NOT call `updateUser({ password })` on the live
 * session, even though that would work and would be one click. Doing so would
 * let anyone at an unlocked machine mint a password for the account and from
 * then on sign in without the Google prompt — turning borrowed access into
 * permanent access, which is the exact escalation the current-password prompt
 * exists to block. The emailed link re-proves control of the mailbox instead.
 */
export function SetPasswordCard({ email }: { email: string }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AuthErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Sending your link');

  async function requestLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(authErrorFromResponse(data, 'Could not send the reset link.'));
        return;
      }
      setSent(true);
    } catch {
      setError({ text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel padding="sm" className="flex flex-col gap-gb-lg">
      <h2 className="font-display text-gb-lg font-semibold text-fg">
        {t('You sign in with Google')}
      </h2>
      <p className="text-gb-sm text-fg-tertiary">
        {t(
          'This account has no password yet, so there is nothing to change. Add one and you can sign in either way.',
        )}
      </p>

      {sent ? (
        <p className="rounded-gb-md bg-brand-subtle px-gb-lg py-gb-md text-gb-sm text-fg-brand">
          {t('We sent a link to {email}. Open it to choose your password.', { email })}
        </p>
      ) : (
        <>
          {error ? (
            <p
              role="alert"
              className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error"
            >
              {authErrorText(error, t)}
            </p>
          ) : null}
          <Button type="button" onClick={requestLink} disabled={loading} size="lg" className="w-fit">
            {loading ? t('Please wait…') : t('Email me a link to set a password')}
          </Button>
        </>
      )}
    </Panel>
  );
}
