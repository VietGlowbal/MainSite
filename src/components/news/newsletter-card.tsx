'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * The newsletter sign-up card in the article sidebar.
 *
 * All that survives of `news-page-client.tsx`, the pre-redesign /news layout.
 * That page and /guides rendered the same `listGeoGuides()` data through two
 * different designs; they were merged into one route on 31/07 — the redesign is
 * the UI and /news is the URL (see src/app/news/news-client.tsx). This card held
 * the only working code in the old file, and /news/[slug] still renders it.
 *
 * ⚠️ Styled for the LEGACY chrome the article page is still on (pink ramp,
 * 1.8rem radii), not the token system in src/styles/tokens.css. Retire it with
 * that page when Figma 153:20197 is built; the list page's `SubscribeRow` is
 * the same POST wearing the design system.
 */
export function NewsletterCard() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  useLoadingIndicator(status === 'loading', 'Signing you up');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'news_article' }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.alreadySubscribed ? 'You\'re already subscribed!' : 'Successfully subscribed! Check your email.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to subscribe. Please try again.');
    }
  };
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-pink-100 bg-[linear-gradient(135deg,rgba(255,77,140,0.12),rgba(0,180,216,0.08))] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="pointer-events-none absolute -right-3 -top-3 text-3xl opacity-80" aria-hidden>✦</div>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <svg className="h-6 w-6 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('Stay updated')}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{t('Get the latest study abroad tips, scholarships and guides straight to your inbox.')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading' || status === 'success'}
            className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm outline-none disabled:opacity-50"
            placeholder={t('Enter your email')}
            required
          />
          <button
            type="submit"
            disabled={status === 'loading' || status === 'success'}
            className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? t('Subscribing...') : status === 'success' ? t('✓ Subscribed') : t('Subscribe')}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-xs ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
