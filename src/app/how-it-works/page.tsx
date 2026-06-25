import Link from 'next/link';

const GUIDE_STEPS = [
  {
    number: 1,
    title: 'Search for universities',
    description:
      'Go to Glowbal Search and view the profile of a university. Browse by country, ranking, subject, or use our matching quiz to find your best fits.',
    cta: { label: 'Go to Search', href: '/universities' },
    color: 'border-l-pink-500',
    iconBg: 'bg-pink-50 text-pink-600',
  },
  {
    number: 2,
    title: 'Find courses',
    description:
      'Click "Find Courses" on any university profile to go to that university\'s course search page. Use their search to find the courses that spark your passion.',
    color: 'border-l-violet-500',
    iconBg: 'bg-violet-50 text-violet-600',
  },
  {
    number: 3,
    title: 'Copy the course URL',
    description:
      'On the course page — not the general search page, but the page that has details about the course — copy the URL from your browser\'s address bar.',
    color: 'border-l-cyan-500',
    iconBg: 'bg-cyan-50 text-cyan-600',
  },
  {
    number: 4,
    title: 'Paste it on Glowbal Apply',
    description:
      'Paste the URL on Glowbal Apply and we\'ll pull in all the course information and make a personalised plan for you to apply. Deadlines, requirements, documents — all broken down into simple steps.',
    cta: { label: 'Go to Apply', href: '/apply' },
    color: 'border-l-cyan-500',
    iconBg: 'bg-cyan-50 text-cyan-600',
  },
  {
    number: 5,
    title: 'Discover scholarships',
    description:
      'We\'ll then pull in all available scholarships from across the web — and some that only we have access to. Matched to your profile, your course, and your circumstances.',
    color: 'border-l-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  {
    number: 6,
    title: 'Connect with a mentor',
    description:
      'To help you get onto the course and scholarship, we\'ll connect you with someone who\'s done it before. Real students and graduates at your target universities.',
    cta: { label: 'Browse Mentors', href: '/mentors' },
    color: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  {
    number: 7,
    title: 'Follow their advice',
    description:
      'Follow their advice and you\'ll be where you want to be in no time. Personal statements, interviews, visa applications — they\'ve walked the path before you.',
    color: 'border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600',
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-3xl">

        {/* Page header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            How Glowbal works
          </h1>
          <p className="mt-2 text-base text-slate-500">
            From finding your dream university to landing your place — here&apos;s how to use the platform step by step.
          </p>
        </div>

        {/* Steps list */}
        <div className="space-y-4">
          {GUIDE_STEPS.map((step) => (
            <div
              key={step.number}
              className={`rounded-xl border border-slate-100 border-l-4 ${step.color} bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6`}
            >
              <div className="flex items-start gap-4">
                {/* Number badge */}
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.iconBg}`}
                >
                  {step.number}
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                  {step.cta && (
                    <Link
                      href={step.cta.href}
                      className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                    >
                      {step.cta.label}
                      <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA footer */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 p-[2px]">
          <div className="rounded-[14px] bg-white px-6 py-8 text-center">
            <p className="text-2xl font-bold text-slate-900">
              Go Glow<span className="text-pink-500">.</span> Go Glowbal<span className="text-pink-500">.</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ready to start your journey?
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/universities"
                className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-pink-600"
              >
                Start searching
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                Take the matching quiz
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
