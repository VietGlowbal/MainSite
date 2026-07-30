'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { Button, Input } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { controlClasses } from '@/shared/ui';
import { createClient } from '@/lib/supabase/client';
import { TID, testId } from '@/shared/lib';

/**
 * Auth form — rebuilt from Figma 105:8004 (login) and 105:8037 (sign up).
 *
 * A single centered card, no globe hero and no legacy `auth-*` classes. Only the
 * PRESENTATION changed: every branch of the Supabase flow is preserved exactly —
 *   login   → signInWithPassword, then ?redirect or /profile
 *   sign up → POST /api/auth/signup (Resend confirmation), then the inbox screen
 *   Google  → signInWithOAuth, callback carries ?next
 * and the testid contract (authEmailInput / authPasswordInput / authSubmit) is
 * unchanged, which is what tests/e2e/signed-in.spec.ts signs in through.
 *
 * The sign-up frame's fields map 1:1 onto what the signup route already stored:
 * full name, phone, email, password, date of birth. Two dead controls the old
 * markup carried — "Remember me" (never read) and "Forgot password" (a no-op) —
 * are dropped rather than restyled; the design omits them too.
 */

type Mode = 'login' | 'signup';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" focusable="false" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

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

/** Shown after a successful sign-up: the confirmation email is on its way. */
function CheckInbox({ email }: { email: string }) {
  return (
    <div className="text-center" aria-live="polite">
      <span className="mx-auto mb-gb-xl flex size-gb-7xl items-center justify-center rounded-gb-full bg-brand-subtle text-fg-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 5L2 7" />
        </svg>
      </span>
      <h2 className="font-display text-gb-display-xs font-semibold text-fg">Check your inbox</h2>
      <p className="mt-gb-md text-gb-md text-fg-tertiary">
        We sent a confirmation link to <strong className="text-fg">{email}</strong>. Click it to
        activate your account and pick up where you left off.
      </p>
    </div>
  );
}

export function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Checking your details');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const redirectPath = useMemo(() => {
    const raw = searchParams.get('redirect');
    return raw && raw.startsWith('/') ? raw : null;
  }, [searchParams]);

  function buildCallbackUrl() {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (redirectPath) callbackUrl.searchParams.set('next', redirectPath);
    return callbackUrl.toString();
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: buildCallbackUrl() },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        // Sign up via our own route so the confirmation email goes through
        // Resend (Supabase's built-in email is rate-limited on the free tier).
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            phone,
            date_of_birth: dob,
            next: redirectPath ?? undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Could not create your account.');
        setSentTo(email);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        // Full navigation when a redirect is set: it may point at a route
        // handler that 302s onward, which the client router doesn't follow.
        if (redirectPath) {
          window.location.assign(redirectPath);
          return;
        }
        router.push('/profile');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div className="w-full">
      <div className="mb-gb-3xl flex flex-col items-center gap-gb-lg text-center">
        <GlowbalLogo height={28} />
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-xs font-semibold text-fg">
            {isSignup ? 'Create an account' : 'Welcome back 👋'}
          </h1>
          <p className="text-gb-md text-fg-tertiary">
            {isSignup
              ? 'Join thousands of students finding their dream university.'
              : 'Sign in to continue your journey.'}
          </p>
        </div>
      </div>

      {sentTo ? (
        <CheckInbox email={sentTo} />
      ) : (
        <>
          {/*
            `method="post"` is a safety net, not a route. Submission is handled
            entirely by `handleSubmit`, but a click that lands before React has
            hydrated (or with JS broken) falls through to a NATIVE submit — and a
            native GET on a form whose fields are named `email` and `password`
            writes the password into the URL, browser history and every access
            log on the way. POST keeps it in the body. There is no POST handler
            at /auth, so such a submit fails visibly instead of leaking.
          */}
          <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-gb-xl">
            {isSignup ? (
              <Input
                name="fullName"
                label="Name"
                placeholder="Enter your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            ) : null}

            {isSignup ? (
              <Input
                name="phone"
                type="tel"
                label="Phone number"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoComplete="tel"
                hint="Include your country code. We'll use it for account updates."
              />
            ) : null}

            <Input
              name="email"
              type="email"
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              {...testId(TID.authEmailInput)}
            />

            {/* Password with a show/hide toggle — built inline because Input has
                no trailing-slot API. Shares controlClasses so it matches the
                other fields exactly. */}
            <div className="flex flex-col gap-gb-sm">
              <label htmlFor="password" className="text-gb-sm font-medium text-fg-secondary">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                  required
                  minLength={6}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className={controlClasses(false, 'pr-gb-6xl')}
                  {...testId(TID.authPasswordInput)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-gb-input-x flex items-center text-fg-muted transition-colors hover:text-fg-secondary"
                >
                  <IconEye off={showPassword} />
                </button>
              </div>
            </div>

            {isSignup ? (
              <Input
                name="dob"
                type="date"
                label="Date of birth"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={todayDate}
                required
                autoComplete="bday"
              />
            ) : null}

            {error ? (
              <p role="alert" className="rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="xl" disabled={loading} className="w-full" {...testId(TID.authSubmit)}>
              {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="xl"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full"
            >
              <GoogleMark />
              Continue with Google
            </Button>
          </form>

          <p className="mt-gb-3xl text-center text-gb-sm text-fg-tertiary">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'login' : 'signup');
                setError(null);
              }}
              className="font-semibold text-fg-brand hover:underline"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
