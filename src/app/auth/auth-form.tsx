'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

// Animated envelope SVG paths
function EnvelopeIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      {/* body */}
      <motion.rect
        x="6" y="20" width="68" height="48" rx="6"
        fill="#fff0f6" stroke="#ff4d8c" strokeWidth="2.5"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      />
      {/* flap */}
      <motion.path
        stroke="#ff4d8c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ d: 'M6 26 L40 50 L74 26' }}
        animate={{ d: 'M6 26 L40 14 L74 26' }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* check circle */}
      <motion.circle
        cx="62" cy="22" fill="#ff4d8c"
        initial={{ r: 0 }}
        animate={{ r: 13 }}
        transition={{ duration: 0.4, delay: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
      />
      {/* check tick */}
      <motion.path
        stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        d="M56 22 L61 27 L69 15"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 1.1, ease: 'easeOut' }}
      />
    </svg>
  );
}

function FloatingOrbs() {
  const orbs = [
    { size: 10, x: -38, y: -30, color: '#ff4d8c', delay: 0.9 },
    { size: 7,  x:  42, y: -18, color: '#00b4d8', delay: 1.1 },
    { size: 6,  x: -20, y:  38, color: '#ff85b3', delay: 1.3 },
    { size: 8,  x:  36, y:  32, color: '#90e0ef', delay: 1.0 },
  ];
  return (
    <>
      {orbs.map((orb, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: orb.color,
            top: '50%',
            left: '50%',
            marginTop: orb.y,
            marginLeft: orb.x,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0.7] }}
          transition={{ duration: 0.5, delay: orb.delay, ease: [0.34, 1.56, 0.64, 1] }}
        />
      ))}
    </>
  );
}

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

  return (
    <AnimatePresence mode="wait">
      {emailSent ? (
        // ── Confirmation screen ──────────────────────────────────────────
        <motion.section
          key="confirm"
          className="glow-form-shell"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem', padding: '2.5rem 2rem' }}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          aria-live="polite"
        >
          {/* Envelope with floating orbs */}
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <EnvelopeIcon />
            <FloatingOrbs />
          </div>

          {/* Gradient heading */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            style={{
              margin: 0,
              fontSize: '1.6rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Check your inbox
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: 'rgb(71 85 105)', maxWidth: '28ch' }}
          >
            We sent a confirmation link to{' '}
            <strong style={{ color: 'rgb(15 23 42)' }}>{sentTo}</strong>.
            Click it to activate your account and land on your profile.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            style={{ margin: 0, fontSize: '0.85rem', color: 'rgb(148 163 184)' }}
          >
            No email? Check spam or{' '}
            <button
              type="button"
              onClick={() => { setEmailSent(false); setError(null); }}
              style={{ background: 'none', border: 'none', padding: 0, color: '#ff4d8c', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              try again
            </button>.
          </motion.p>
        </motion.section>

      ) : (
        // ── Auth form ────────────────────────────────────────────────────
        <motion.section
          key="form"
          className="glow-form-shell"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="glow-form-toggle-row">
            <button className={`glow-form-toggle ${mode === 'signup' ? 'glow-form-toggle-active' : ''}`} onClick={() => setMode('signup')} type="button">Sign up</button>
            <button className={`glow-form-toggle ${mode === 'login' ? 'glow-form-toggle-active' : ''}`} onClick={() => setMode('login')} type="button">Log in</button>
          </div>

          <form className="glow-form-stack" onSubmit={handleSubmit}>
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.label
                  key="fullname"
                  className="glow-label"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  Full name
                  <input className="glow-input" value={fullName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} placeholder="James" />
                </motion.label>
              )}
            </AnimatePresence>

            <label className="glow-label">
              Email
              <input className="glow-input" type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </label>
            <label className="glow-label">
              Password
              <input className="glow-input" type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="••••••••" required />
            </label>
            <button className="glow-button-primary glow-button-primary-wide" type="submit" disabled={loading}>
              {loading ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </form>

          <div className="glow-divider"><span>or</span></div>

          <button className="glow-button-google" type="button" onClick={handleGoogleSignIn} disabled={loading} aria-label="Sign in with Google">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {error && (
            <motion.p
              className="glow-message"
              role="alert"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
