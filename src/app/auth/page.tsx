import { Suspense } from 'react';
import { AuthForm } from './auth-form';
import { LandingGlobe } from '@/components/landing-globe';

function AuthFormFallback() {
  return (
    <div className="auth-card">
      <div className="auth-skeleton" aria-hidden />
      <p className="text-center text-sm text-slate-500">Loading sign-in…</p>
    </div>
  );
}

const PERKS = [
  {
    title: 'Personal university matches',
    body: 'Save your shortlist, track deadlines, and re-rank schools as your goals shift.',
  },
  {
    title: 'Talk to Achievers',
    body: 'Book 1-2-1 sessions with students who got into your dream universities.',
  },
  {
    title: 'AI statement writer',
    body: 'Turn rough notes into compelling personal statements — drafts saved to your profile.',
  },
];

export default function AuthPage() {
  return (
    <main className="auth-page">
      {/* Decorative gradient/orbs in the page background */}
      <div className="auth-page-bg" aria-hidden>
        <span className="auth-orb auth-orb-pink" />
        <span className="auth-orb auth-orb-aqua" />
        <span className="auth-orb auth-orb-navy" />
      </div>

      <div className="auth-page-grid">
        {/* ─────────── Aside (large screens) ─────────── */}
        <aside className="auth-aside">
          <span className="auth-eyebrow">Welcome back</span>
          <h2 className="auth-aside-title">
            Your future is{' '}
            <span className="glowbal-wordmark">global.</span>
          </h2>
          <p className="auth-aside-body">
            Glowbal is the calmer way to find, apply to, and get into universities
            anywhere in the world. Sign in to pick up where you left off.
          </p>

          <div className="auth-aside-globe">
            <LandingGlobe theme="marble" rotateSpeed={0.32} responsive />
            <span className="auth-aside-halo" aria-hidden />
          </div>

          <ul className="auth-aside-perks">
            {PERKS.map((perk) => (
              <li key={perk.title} className="auth-aside-perk">
                <span className="auth-aside-perk-dot" aria-hidden />
                <div>
                  <p className="auth-aside-perk-title">{perk.title}</p>
                  <p className="auth-aside-perk-body">{perk.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ─────────── Form column ─────────── */}
        <Suspense fallback={<AuthFormFallback />}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
