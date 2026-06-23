'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

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

  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Phone number collected at sign-up (stored, not verified).
  const [phone, setPhone] = useState('');
  // Date of birth collected at sign-up, persisted to the contact (profile) record.
  const [dob, setDob] = useState('');

  // Latest selectable DOB is today — no future birthdays.
  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
        // Sign up via our own route so the confirmation email is sent through
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
        if (!res.ok) {
          throw new Error(data.error ?? 'Could not create your account.');
        }

        setSentTo(email);
        setEmailSent(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        // Full navigation when a redirect is set: it may point at a route
        // handler (e.g. /api/home/save-university) that 302s onward, which the
        // client router doesn't follow on its own.
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
  };

  const heading = mode === 'login' ? 'Welcome back 👋' : 'Create your account';
  const subheading = mode === 'login' 
    ? 'Sign in to continue your journey.' 
    : 'Join thousands of students finding their dream university.';

  return (
    <div className="auth-form-card">
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
            {/* Heading */}
            <div className="auth-form-header">
              <h2 className="auth-form-title">{heading}</h2>
              <p className="auth-form-subtitle">{subheading}</p>
            </div>

            {/* Google CTA */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="auth-google-button"
              aria-label={mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
            >
              <GoogleMark />
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="auth-divider">
              <span className="auth-divider-line" />
              <span className="auth-divider-text">OR</span>
              <span className="auth-divider-line" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className={`auth-form${mode === 'signup' ? ' auth-form--signup' : ''}`}>
              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="fullname"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="auth-input-group">
                      <label htmlFor="fullname" className="auth-label">Full name</label>
                      <input
                        id="fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="auth-input"
                        required={mode === 'signup'}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="auth-input-group">
                <label htmlFor="email" className="auth-label">Email address</label>
                <div className="auth-input-wrapper">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="auth-input auth-input-with-icon"
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label htmlFor="password" className="auth-label">Password</label>
                <div className="auth-input-wrapper">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="auth-input auth-input-with-icon"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="auth-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="auth-input-group">
                      <label htmlFor="phone" className="auth-label">Phone number</label>
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                        <input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+44 7700 900000"
                          className="auth-input auth-input-with-icon"
                          autoComplete="tel"
                          required={mode === 'signup'}
                        />
                      </div>
                      <p className="auth-input-hint">
                        Include your country code (e.g. +44). We’ll use this for account updates and occasional offers.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {mode === 'signup' && (
                  <motion.div
                    key="dob"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="auth-input-group">
                      <label htmlFor="dob" className="auth-label">Date of birth</label>
                      <div className="auth-input-wrapper">
                        <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <input
                          id="dob"
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          max={todayDate}
                          className="auth-input auth-input-with-icon"
                          autoComplete="bday"
                          required={mode === 'signup'}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'login' && (
                <div className="auth-form-options">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="auth-checkbox"
                    />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="auth-forgot-link">
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <motion.div
                  className="auth-error"
                  role="alert"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="auth-submit-button"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>

              <div className="auth-secure-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Your data is secure and encrypted</span>
              </div>
            </form>

            {/* Switch mode */}
            <div className="auth-switch-mode">
              <span className="auth-switch-text">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
                className="auth-switch-button"
              >
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
