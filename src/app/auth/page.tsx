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

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
    title: 'Application plans',
    description: 'Personalised steps for every course.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Mentor support',
    description: 'Connect with students and alumni.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: 'Stronger applications',
    description: 'Get AI feedback and guidance.',
  },
];

export default function AuthPage() {
  return (
    <main className="auth-page-v2">
      <div className="auth-content-grid">
        {/* ─────────── Left: Hero with Globe ─────────── */}
        <div className="auth-hero">
          <div className="auth-hero-content">
            <h1 className="auth-hero-title">
              Your future is{' '}
              <span className="auth-hero-gradient">GLOBAL.</span>
            </h1>
            <p className="auth-hero-subtitle">
              Your all-in-one platform for global education.
            </p>

            {/* Feature list */}
            <ul className="auth-feature-list">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="auth-feature-item">
                  <div className="auth-feature-icon">{feature.icon}</div>
                  <div>
                    <p className="auth-feature-title">{feature.title}</p>
                    <p className="auth-feature-description">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 3D Globe — sits faintly behind the content */}
          <div className="auth-globe-container">
            <div className="auth-globe-wrapper">
              <LandingGlobe theme="marble" rotateSpeed={0.4} responsive />
            </div>
          </div>
        </div>

        {/* ─────────── Right: Auth Form ─────────── */}
        <div className="auth-form-container">
          <Suspense fallback={<AuthFormFallback />}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
