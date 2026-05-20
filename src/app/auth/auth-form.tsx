'use client';

/**
 * AuthForm
 * ────────
 * Reimagined sign-in / sign-up flow that matches the team's design ref:
 *
 *   ▰▰▰  animated brand gradient strip
 *   WELCOME BACK TO [Glowbal logo]
 *
 *   ┌──────────────── Sign In with G ────────────────┐  (gradient-ringed pill)
 *
 *   [Email]    Enter your email or phone number
 *   [Password] Enter your password
 *
 *   ────────────── OR ──────────────
 *   ┌── Create New Account ────────────────┐  (sits on a brand-gradient bar)
 *
 * Visually impressive without being noisy: animated brand gradient on the
 * key surfaces, big confident type, calm form rows, and an optional aside
 * with the rotating Glowbal globe + a glowing testimonial badge so the
 * page is anchored in the brand world.
 */

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { GlowbalLogo } from '@/components/glowbal-logo';

type Mode = 'login' | 'signup';

function GoogleMark() {
  return (
    <span className="auth-google-mark" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 18 18" focusable="false">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
    </span>
  );
}

function EnvelopeSent({ email }: { email: string }) {
  return (
    <motion.div
      key="confirm"
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="auth-confirm"
      aria-live="polite"
    >
      <div className="auth-confirm-orb">
        {/* Tiny earth-themed envelope */}
        <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
          <defs>
            <linearGradient id="auth-env-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff4d8c" />
              <stop offset="40%" stopColor="#ff3b3b" />
              <stop offset="75%" stopColor="#00c8e6" />
              <stop offset="100%" stopColor="#1e2a78" />
            </linearGradient>
          </defs>
          <motion.rect
            x="6" y="22" width="72" height="50" rx="8"
            fill="#fff" stroke="url(#auth-env-grad)" strokeWidth="2.5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          />
          <motion.path
            stroke="url(#auth-env-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
            initial={{ d: 'M6 28 L42 56 L78 28' }}
            animate={{ d: 'M6 28 L42 14 L78 28' }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.circle
            cx="64" cy="22" fill="url(#auth-env-grad)"
            initial={{ r: 0 }}
            animate={{ r: 14 }}
            transition={{ duration: 0.4, delay: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
          />
          <motion.path
            stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
            d="M58 22 L63 27 L71 15"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 1.1, ease: 'easeOut' }}
          />
        </svg>
      </div>
      <h3 className="auth-confirm-title">Check your inbox</h3>
      <p className="auth-confirm-body">
        We sent a confirmation link to <strong>{email}</strong>. Click it to activate
        your account and pick up where you left off.
      </p>
    </motion.div>
  );
}

export function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const redirectPath = useMemo(() => {
    const raw = searchParams.get('redirect');
    return raw && raw.startsWith('/') ? raw : null;
  }, [searchParams]);

  const buildCallbackUrl = () => {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (redirectPath) callbackUrl.searchParams.set('next', redirectPath);
    return callbackUrl.toString();
  };

  const handleGoogleSignIn = async () => {
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
            emailRedirectTo: buildCallbackUrl(),
          },
        });
        if (signUpError) throw signUpError;
        setSentTo(email);
        setEmailSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(redirectPath ?? '/profile');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const heading = mode === 'login' ? 'Welcome back to' : 'Welcome to';

  return (
    <div className="auth-card">
      <AnimatePresence mode="wait">
        {emailSent ? (
          <EnvelopeSent key="confirm" email={sentTo} />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Heading + logo */}
            <div className="auth-heading">
              <h1 className="auth-heading-text">
                {heading.split(' ').map((word, i) => (
                  <span key={i}>{word} </span>
                ))}
                <span className="auth-heading-logo">
                  <GlowbalLogo height={48} alt="Glowbal" />
                </span>
              </h1>
            </div>

            {/* Mode toggle */}
            <div className="auth-mode-toggle" role="tablist" aria-label="Sign in mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-mode-pill${mode === 'login' ? ' is-active' : ''}`}
                onClick={() => { setMode('login'); setError(null); }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-mode-pill${mode === 'signup' ? ' is-active' : ''}`}
                onClick={() => { setMode('signup'); setError(null); }}
              >
                Create account
              </button>
            </div>

            {/* Google CTA — gradient-ringed pill */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="auth-google-pill"
              aria-label={mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
            >
              <span className="auth-google-pill-inner">
                <span className="auth-google-pill-text">
                  {mode === 'login' ? 'Sign in with' : 'Sign up with'}
                </span>
                <GoogleMark />
              </span>
            </button>

            {/* Form rows — pink pill label + outlined input */}
            <form onSubmit={handleSubmit} className="auth-fields">
              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="fullname"
                    className="auth-row"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <span className="auth-row-label">Full name</span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="auth-row-input"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="auth-row">
                <span className="auth-row-label">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your Email or Phone Number here"
                  className="auth-row-input"
                  required
                />
              </div>

              <div className="auth-row">
                <span className="auth-row-label">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your Password here"
                  className="auth-row-input"
                  required
                  minLength={6}
                />
              </div>

              {mode === 'login' ? (
                <div className="auth-forgot-row">
                  <button type="button" className="auth-forgot-link">Forgot password?</button>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="auth-submit"
              >
                {loading
                  ? 'Working…'
                  : mode === 'login'
                  ? 'Sign in'
                  : 'Create my account'}
              </button>

              {error && (
                <motion.p
                  className="auth-error"
                  role="alert"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OR / Create New Account bar — sits on the animated brand gradient */}
      {!emailSent && (
        <div className="auth-bottom-bar">
          <div className="auth-or-text">OR</div>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="auth-bottom-pill"
          >
            {mode === 'login' ? 'Create New Account' : 'I already have an account'}
          </button>
        </div>
      )}
    </div>
  );
}
