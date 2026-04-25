'use client';

import { FormEvent, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

export function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  // Animated dots while waiting
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    if (!emailSent) return;
    const id = setInterval(() => setDotCount((n: number) => (n % 3) + 1), 600);
    return () => clearInterval(id);
  }, [emailSent]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        setSentTo(email);
        setEmailSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push('/profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ── Confirmation screen ──────────────────────────────────────────────────
  if (emailSent) {
    const dots = '.'.repeat(dotCount);
    return (
      <section className="glow-form-shell glow-confirm-shell" aria-live="polite">
        <div className="glow-confirm-envelope" aria-hidden="true">
          <svg className="glow-confirm-envelope-svg" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* envelope body */}
            <rect className="glow-env-body" x="8" y="24" width="80" height="56" rx="6" />
            {/* envelope flap */}
            <path className="glow-env-flap" d="M8 30 L48 58 L88 30" />
            {/* animated check circle */}
            <circle className="glow-env-check-ring" cx="72" cy="28" r="14" />
            <path className="glow-env-check-tick" d="M65 28 L70 33 L79 22" />
          </svg>
          {/* floating dots */}
          <span className="glow-confirm-dot glow-confirm-dot-1" aria-hidden="true" />
          <span className="glow-confirm-dot glow-confirm-dot-2" aria-hidden="true" />
          <span className="glow-confirm-dot glow-confirm-dot-3" aria-hidden="true" />
        </div>

        <h2 className="glow-confirm-heading">Check your inbox{dots}</h2>
        <p className="glow-confirm-body">
          We sent a confirmation link to <strong>{sentTo}</strong>. Click it to activate your account and you&apos;ll land straight on your profile.
        </p>
        <p className="glow-confirm-hint">No email? Check spam or{' '}
          <button
            className="glow-confirm-retry"
            type="button"
            onClick={() => { setEmailSent(false); setError(null); }}
          >
            try again
          </button>.
        </p>
      </section>
    );
  }

  // ── Auth form ────────────────────────────────────────────────────────────
  return (
    <section className="glow-form-shell">
      <div className="glow-form-toggle-row">
        <button
          className={`glow-form-toggle ${mode === 'signup' ? 'glow-form-toggle-active' : ''}`}
          onClick={() => setMode('signup')}
          type="button"
        >
          Sign up
        </button>
        <button
          className={`glow-form-toggle ${mode === 'login' ? 'glow-form-toggle-active' : ''}`}
          onClick={() => setMode('login')}
          type="button"
        >
          Log in
        </button>
      </div>

      <form className="glow-form-stack" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <label className="glow-label">
            Full name
            <input
              className="glow-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="James"
            />
          </label>
        )}
        <label className="glow-label">
          Email
          <input
            className="glow-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="glow-label">
          Password
          <input
            className="glow-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>
        <button className="glow-button-primary glow-button-primary-wide" type="submit" disabled={loading}>
          {loading ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>

      <div className="glow-divider"><span>or</span></div>

      <button
        className="glow-button-google"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        aria-label="Sign in with Google"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      {error && <p className="glow-message" role="alert">{error}</p>}
    </section>
  );
}
