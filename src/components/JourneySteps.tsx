'use client';

import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────────
   STEP ICONS — inline SVGs matching the screenshot's icon style
───────────────────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ApplyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function FundIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STEPS DATA
───────────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    number: 1,
    title: 'Search',
    description: 'Find universities that match your goals',
    href: '/universities',
    icon: SearchIcon,
    bgColor: 'bg-pink-500',
    lineColor: 'bg-pink-400',
    titleColor: 'text-pink-600',
  },
  {
    number: 2,
    title: 'Explore',
    description: 'Discover programs and compare options',
    href: '/how-it-works',
    icon: ExploreIcon,
    bgColor: 'bg-violet-500',
    lineColor: 'bg-violet-400',
    titleColor: 'text-violet-600',
  },
  {
    number: 3,
    title: 'Apply',
    description: 'Prepare and submit your application',
    href: '/apply',
    icon: ApplyIcon,
    bgColor: 'bg-cyan-500',
    lineColor: 'bg-cyan-400',
    titleColor: 'text-cyan-600',
  },
  {
    number: 4,
    title: 'Fund',
    description: 'Plan your finances and explore funding',
    href: '/scholarships',
    icon: FundIcon,
    bgColor: 'bg-emerald-500',
    lineColor: 'bg-emerald-400',
    titleColor: 'text-emerald-600',
  },
  {
    number: 5,
    title: 'Connect',
    description: 'Connect with advisors and prepare for success',
    href: '/advisors',
    icon: ConnectIcon,
    bgColor: 'bg-amber-500',
    lineColor: 'bg-amber-400',
    titleColor: 'text-amber-600',
  },
];

type Props = {
  /** Which step (1–5) is currently active based on the page */
  activeStep?: number;
};

export function JourneySteps({ activeStep }: Props) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white px-5 py-5 shadow-[0_4px_16px_rgba(22,33,62,0.04)] sm:px-8 sm:py-6">
      {/* Header */}
      <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:mb-6">
        Your journey to studying abroad
      </p>

      {/* Steps with connecting lines */}
      <div className="flex items-start justify-between overflow-x-auto">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = activeStep === step.number;
          const isPast = activeStep ? step.number < activeStep : false;

          return (
            <div key={step.number} className="flex flex-1 items-start">
              {/* Step column */}
              <Link
                href={step.href}
                className="group flex min-w-[100px] flex-col items-center text-center sm:min-w-[120px]"
              >
                {/* Icon circle */}
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 sm:h-12 sm:w-12 ${step.bgColor} ${
                    isActive ? 'ring-4 ring-offset-2 ring-opacity-30 ring-current scale-110' : ''
                  } ${isPast ? 'opacity-70' : ''}`}
                >
                  <Icon />
                </span>
                {/* Title */}
                <span
                  className={`mt-2 text-xs font-semibold sm:text-sm ${
                    isActive ? step.titleColor : 'text-slate-700'
                  }`}
                >
                  {step.title}
                </span>
                {/* Description */}
                <span className="mt-0.5 max-w-[130px] text-[10px] leading-tight text-slate-400 sm:text-[11px]">
                  {step.description}
                </span>
              </Link>

              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div className="mt-[22px] flex flex-1 items-center px-1 sm:mt-[22px] sm:px-2">
                  <span
                    className={`h-[3px] w-full rounded-full ${
                      isPast ? STEPS[i + 1].lineColor : 'bg-slate-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
