const featureCards = [
  {
    title: 'Guided onboarding',
    description:
      'Students build a profile around goals, countries, budget, and academic fit in a way that feels supportive and easy to follow.',
  },
  {
    title: 'Explainable shortlist',
    description:
      'Every recommendation should feel human, clear, and reassuring, with strong reasons behind each suggestion.',
  },
  {
    title: 'Save and compare',
    description:
      'Students can collect great options, compare them side by side, and come back later without losing momentum.',
  },
];

const nextSteps = [
  'Sign in and build your profile',
  'Explore countries and course directions',
  'Save standout options and compare them',
  'Get to a confident shortlist faster',
];

export default function Home() {
  return (
    <main className="min-h-screen bg-transparent text-slate-800">
      <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-14 md:px-10 lg:px-12">
        <div className="rounded-[2rem] border border-black/5 bg-white/78 p-8 shadow-[0_16px_50px_rgba(22,33,62,0.08)] backdrop-blur md:p-10">
          <span className="inline-flex w-fit rounded-full border border-pink-200 bg-pink-50 px-4 py-1 text-sm font-semibold text-pink-600">
            Glowbal, light and student-first
          </span>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-5">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
                Find the right course, country, and next step with a little more clarity and joy.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                Glowbal is being rebuilt as a brighter, friendlier student experience, one that feels guided,
                modern, and genuinely encouraging instead of overwhelming.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/onboarding"
                  className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-6 py-3 font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
                >
                  Start onboarding
                </a>
                <a
                  href="/dashboard"
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50"
                >
                  View dashboard
                </a>
              </div>
            </div>
            <div className="rounded-[2rem] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(144,224,239,0.18))] p-6 shadow-[0_14px_40px_rgba(0,180,216,0.08)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-500">The Glowbal feel</p>
              <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
                <li>Pink and mint accents instead of heavy dark chrome</li>
                <li>Soft glass cards and lighter, optimistic surfaces</li>
                <li>More warmth, more clarity, less intimidating UI density</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-[1.75rem] border border-black/5 bg-white/80 p-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur"
            >
              <h2 className="text-xl font-bold text-slate-900">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-pink-200 bg-[linear-gradient(135deg,rgba(255,77,140,0.1),rgba(0,180,216,0.08))] p-8 shadow-[0_14px_36px_rgba(255,77,140,0.08)]">
            <h2 className="text-2xl font-bold text-slate-900">What we are building next</h2>
            <p className="mt-3 max-w-2xl leading-7 text-slate-700">
              First we make the student journey feel real and delightful, from onboarding to shortlist to saved options.
              Then we keep improving trust, quality, and recommendation depth.
            </p>
          </section>

          <section className="rounded-[2rem] border border-black/5 bg-white/80 p-8 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur">
            <h2 className="text-xl font-bold text-slate-900">Immediate build queue</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {nextSteps.map((step) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,#FF4D8C,#00B4D8)]" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
