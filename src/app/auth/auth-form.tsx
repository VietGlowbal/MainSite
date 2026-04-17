'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Mode = 'login' | 'signup';

export function AuthForm() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;
        setMessage('Account created. Check your email if Supabase confirmation is enabled.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        setMessage('Signed in successfully. Next we will connect this to the dashboard flow.');
      }
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Something went wrong';
      setMessage(description);
    } finally {
      setLoading(false);
    }
  };

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
              onChange={(event) => setFullName(event.target.value)}
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
            onChange={(event) => setEmail(event.target.value)}
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
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <button className="glow-button-primary" type="submit" disabled={loading}>
          {loading ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>

      {message && <p className="glow-message">{message}</p>}
    </section>
  );
}
