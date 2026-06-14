'use client';

import Link from 'next/link';

const STEPS = [
  {
    number: 1,
    title: 'Search',
    description: 'Find universities you\'ll love',
    href: '/universities',
    color: 'from-pink-500 to-rose-500',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-200',
  },
  {
    number: 2,
    title: 'Explore',
    description: 'Find the courses that build your future',
    href: '/universities',
    color: 'from-violet-500 to-purple-500',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-200',
  },
  {
    number: 3,
    title: 'Apply',
    description: 'Paste the course URL & get easy steps to apply',
    href: '/apply',
    color: 'from-cyan-500 to-blue-500',
    bgLight: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    borderColor: 'border-cyan-200',
  },
  {
    number: 4,
    title: 'Fund',
    description: 'Get the scholarships that make it real',
    href: '/apply',
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  {
    number: 5,
    title: 'Connect',
    description: 'Talk to mentors to seal your place',
    href: '/mentors',
    color: 'from-amber-500 to-orange-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-200',
  },
];

type Props = {
  /** Which step (1–5) is currently active based on the page */
  activeStep?: number;
};

export function JourneySteps({ activeStep }: Props) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-black/5 bg-white/95 px-4 py-4 shadow-[0_8px_24px_rgba(22,33,62,0.05)] backdrop-blur sm:px-6 sm:py-5">
      {/* Decorative blurs */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,77,140,0.14), transparent 60%)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.12), transparent 60%)' }}
      />

      <div className="relative">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Your journey to studying abroad
        </p>

        {/* Steps row */}
        <div className="flex items-start gap-2 overflow-x-auto pb-1 sm:gap-3">
          {STEPS.map((step, i) => {
            const isActive = activeStep === step.number;
            return (
              <Link
                key={step.number}
                href={step.href}
                className={`group relative flex min-w-[130px] flex-1 flex-col items-center rounded-xl border px-2 py-3 text-center transition-all sm:min-w-[140px] sm:px-3 ${
                  isActive
                    ? `${step.bgLight} ${step.borderColor} shadow-sm`
                    : 'border-transparent hover:border-slate-100 hover:bg-slate-50/60'
                }`}
              >
                {/* Step number circle */}
                <span
                  className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm bg-gradient-to-br ${step.color}`}
                >
                  {step.number}
                </span>
                {/* Title */}
                <span
                  className={`text-xs font-semibold ${
                    isActive ? step.textColor : 'text-slate-700 group-hover:text-slate-900'
                  }`}
                >
                  {step.title}
                </span>
                {/* Description */}
                <span className="mt-0.5 text-[11px] leading-tight text-slate-400 line-clamp-2">
                  {step.description}
                </span>

                {/* Connector line (between steps) */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -right-1.5 top-[22px] hidden h-[2px] w-3 bg-slate-200 sm:block"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
