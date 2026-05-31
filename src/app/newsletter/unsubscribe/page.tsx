'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');
  
  const [email, setEmail] = React.useState(emailParam || '');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('You have been successfully unsubscribed from our newsletter.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to unsubscribe. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-cyan-50 px-4 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-100">
              <svg className="h-8 w-8 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Unsubscribe from Newsletter</h1>
            <p className="mt-2 text-sm text-slate-600">
              We're sorry to see you go. You can unsubscribe from our newsletter below.
            </p>
          </div>

          {status === 'success' ? (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="mb-2 text-4xl">✓</div>
              <p className="font-semibold text-green-900">{message}</p>
              <p className="mt-2 text-sm text-green-700">
                You won't receive any more emails from us.
              </p>
              <a
                href="/"
                className="mt-4 inline-block rounded-lg bg-pink-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-pink-600"
              >
                Return to Homepage
              </a>
            </div>
          ) : (
            <form onSubmit={handleUnsubscribe} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === 'loading'}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100 disabled:opacity-50"
                  placeholder="your@email.com"
                  required
                />
              </div>

              {message && status === 'error' && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-lg bg-pink-500 px-4 py-3 font-semibold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading' ? 'Unsubscribing...' : 'Unsubscribe'}
              </button>

              <p className="text-center text-xs text-slate-500">
                Changed your mind?{' '}
                <a href="/" className="text-pink-600 hover:text-pink-700">
                  Go back to homepage
                </a>
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          <p>
            If you're having trouble unsubscribing, please contact us at{' '}
            <a href="mailto:hello@glowbal.com" className="text-pink-600 hover:text-pink-700">
              hello@glowbal.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
