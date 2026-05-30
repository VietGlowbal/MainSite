import { Suspense } from 'react';
import { AuthForm } from './auth-form';
import { LandingGlobe } from '@/components/landing-globe';
import { GlowbalLogo } from '@/components/glowbal-logo';

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
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: 'Course-specific application plans',
    description: 'Import any course page and get a personalised checklist with deadlines, requirements & tasks.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    title: 'Stay organised & never miss a deadline',
    description: 'Track your applications, documents, and key dates in one place.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Learn from real students & mentors',
    description: 'Book sessions with current students and alumni from your dream universities.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Improve your application',
    description: 'Get AI-powered feedback on your personal statement, prepare for interviews, and strengthen your profile.',
  },
];

const TRUST_STATS = [
  { icon: '🌍', value: '10,000+', label: 'Universities worldwide' },
  { icon: '👥', value: '150K+', label: 'Students already on Glowbal' },
  { icon: '⭐', value: '4.8/5', label: 'Average student rating' },
  { icon: '🎓', value: '24/7', label: "We're here to help you succeed" },
];

export default function AuthPage() {
  return (
    <main className="auth-page-v2">
      {/* Top header with logo */}
      <header className="auth-header">
        <GlowbalLogo height={32} alt="Glowbal" />
        <div className="auth-header-actions">
          <span className="text-sm text-slate-600">New to Glowbal?</span>
          <a href="#signup" className="auth-header-link">Create account</a>
        </div>
      </header>

      <div className="auth-content-grid">
        {/* ─────────── Left: Hero with Globe ─────────── */}
        <div className="auth-hero">
          <div className="auth-hero-content">
            <h1 className="auth-hero-title">
              Your future is{' '}
              <span className="auth-hero-gradient">GLOBAL.</span>
            </h1>
            <p className="auth-hero-subtitle">
              The all-in-one platform to discover universities, track applications, get mentor support, and get into your dream school.
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

          {/* 3D Globe */}
          <div className="auth-globe-container">
            <div className="auth-globe-wrapper">
              <LandingGlobe theme="marble" rotateSpeed={0.4} responsive />
            </div>
          </div>

          {/* Trust indicators at bottom */}
          <div className="auth-trust-bar">
            <p className="auth-trust-label">TRUSTED BY STUDENTS WORLDWIDE</p>
            <div className="auth-trust-stats">
              {TRUST_STATS.map((stat) => (
                <div key={stat.label} className="auth-trust-stat">
                  <span className="auth-trust-icon">{stat.icon}</span>
                  <div>
                    <p className="auth-trust-value">{stat.value}</p>
                    <p className="auth-trust-text">{stat.label}</p>
                  </div>
                </div>
              ))}
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
