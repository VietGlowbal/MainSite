'use client';

import { useMemo, useState } from 'react';

type Step = {
  key: string;
  region: 'north-america' | 'south-america' | 'europe' | 'africa' | 'asia';
  eyebrow: string;
  title: string;
  description: string;
  options: Array<{ label: string; hint: string }>;
};

const steps: Step[] = [
  {
    key: 'destination',
    region: 'north-america',
    eyebrow: 'Start with place',
    title: 'Where do you want to study?',
    description: 'Pick the region that feels most exciting right now. You can refine countries later.',
    options: [
      { label: 'North America', hint: 'USA, Canada, big campus energy' },
      { label: 'Europe', hint: 'Diverse cities, strong academics, lots of choice' },
      { label: 'Asia', hint: 'Fast-moving, global, exciting hubs' },
      { label: 'I’m open', hint: 'Show me the best-fit options anywhere' },
    ],
  },
  {
    key: 'subject',
    region: 'south-america',
    eyebrow: 'Choose your lane',
    title: 'What do you want to study?',
    description: 'Keep it broad for now — the goal is clarity, not perfection.',
    options: [
      { label: 'Computer Science', hint: 'Software, AI, systems, data' },
      { label: 'Business', hint: 'Finance, startups, strategy, leadership' },
      { label: 'Health & Medicine', hint: 'Clinical, biomedical, life sciences' },
      { label: 'Still exploring', hint: 'Help me narrow it down' },
    ],
  },
  {
    key: 'priority',
    region: 'europe',
    eyebrow: 'Find your fit',
    title: 'What matters most to you?',
    description: 'Choose the thing that will make a university feel right, not just impressive.',
    options: [
      { label: 'Affordable tuition', hint: 'Better value, less pressure' },
      { label: 'Career outcomes', hint: 'Internships, reputation, job prospects' },
      { label: 'Big city life', hint: 'Energy, culture, opportunities' },
      { label: 'Student community', hint: 'Belonging, support, good people' },
    ],
  },
  {
    key: 'budget',
    region: 'africa',
    eyebrow: 'Set the comfort zone',
    title: 'What budget vibe fits best?',
    description: 'This helps Glowbal steer you toward options that feel realistic and exciting.',
    options: [
      { label: 'Keep costs low', hint: 'Budget-conscious options first' },
      { label: 'Balanced', hint: 'Strong fit without overspending' },
      { label: 'Open to premium', hint: 'Top fit matters more than cost' },
      { label: 'Not sure yet', hint: 'Show the spectrum and let me compare' },
    ],
  },
  {
    key: 'vibe',
    region: 'asia',
    eyebrow: 'Shape the shortlist',
    title: 'What kind of experience do you want?',
    description: 'This is the personality layer — the part that makes the shortlist feel like you.',
    options: [
      { label: 'Ambitious and fast-paced', hint: 'Big opportunities, dynamic feel' },
      { label: 'Friendly and balanced', hint: 'Supportive, social, well-rounded' },
      { label: 'Creative and global', hint: 'Open-minded, international energy' },
      { label: 'Calm and focused', hint: 'Less noise, more study flow' },
    ],
  },
];

type Answers = Record<string, string | undefined>;

const regionCopy: Record<Step['region'], { label: string; tone: string; fill: string; glow: string }> = {
  'north-america': { label: 'North America', tone: '#65D9C1', fill: '#C8FFF1', glow: 'rgba(101, 217, 193, 0.45)' },
  'south-america': { label: 'South America', tone: '#FFCC8B', fill: '#FFE8C7', glow: 'rgba(255, 204, 139, 0.45)' },
  europe: { label: 'Europe', tone: '#FF8FBE', fill: '#FFD4E7', glow: 'rgba(255, 143, 190, 0.45)' },
  africa: { label: 'Africa', tone: '#FFE16B', fill: '#FFF3B7', glow: 'rgba(255, 225, 107, 0.45)' },
  asia: { label: 'Asia', tone: '#AA9CFF', fill: '#E0DBFF', glow: 'rgba(170, 156, 255, 0.45)' },
};

function GlowbalGlobe({ currentStep, completedSteps }: { currentStep: number; completedSteps: number }) {
  const currentRegion = steps[currentStep]?.region;

  return (
    <div className="relative flex aspect-square w-full max-w-[470px] items-center justify-center">
      <div className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,_rgba(255,61,154,0.10),_transparent_60%)] blur-2xl" />
      <div className="absolute inset-[17%] rounded-full bg-[radial-gradient(circle,_rgba(0,194,255,0.12),_transparent_62%)] blur-2xl" />

      <div className="relative h-[420px] w-[420px] overflow-hidden rounded-full border border-white/70 bg-[linear-gradient(180deg,#9AD8FF_0%,#78B9FF_48%,#8BDFF1_100%)] shadow-[0_30px_80px_rgba(123,160,255,0.20)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.55),transparent_18%),radial-gradient(circle_at_65%_75%,rgba(255,255,255,0.12),transparent_24%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(90deg,transparent_0_17%,rgba(255,255,255,0.5)_17%_18%,transparent_18%_34%,rgba(255,255,255,0.5)_34%_35%,transparent_35%_52%,rgba(255,255,255,0.5)_52%_53%,transparent_53%_70%,rgba(255,255,255,0.5)_70%_71%,transparent_71%_100%),linear-gradient(180deg,transparent_0_22%,rgba(255,255,255,0.5)_22%_23%,transparent_23%_43%,rgba(255,255,255,0.5)_43%_44%,transparent_44%_64%,rgba(255,255,255,0.5)_64%_65%,transparent_65%_85%,rgba(255,255,255,0.5)_85%_86%,transparent_86%_100%)]" />

        <svg viewBox="0 0 420 420" className="absolute inset-0 h-full w-full">
          <defs>
            <filter id="continentGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ContinentPath
            d="M74 111c14-22 34-37 58-42 22-5 42-2 57 8 10 7 17 16 17 25 0 14-9 26-26 35-17 9-29 13-35 25-5 10-1 25-13 31-13 6-31-4-40-18-10-15-31-20-35-40-3-8 3-17 17-24z"
            region="north-america"
            active={completedSteps > 0 || currentRegion === 'north-america'}
            current={currentRegion === 'north-america'}
          />
          <ContinentPath
            d="M147 208c11-7 24-6 34 1 9 7 12 18 10 30-2 10-2 22 4 31 6 9 8 20 4 31-4 10-12 18-22 22-12 5-23 0-30-10-8-11-11-24-12-37-1-10-9-19-10-29-1-15 10-31 22-39z"
            region="south-america"
            active={completedSteps > 1 || currentRegion === 'south-america'}
            current={currentRegion === 'south-america'}
          />
          <ContinentPath
            d="M212 119c14-11 31-17 46-14 9 2 16 8 16 16 0 8-8 14-16 17-12 4-20 3-27 11-8 8-18 12-29 9-10-3-15-12-14-22 1-7 8-12 24-17z"
            region="europe"
            active={completedSteps > 2 || currentRegion === 'europe'}
            current={currentRegion === 'europe'}
          />
          <ContinentPath
            d="M232 166c12-6 29-3 40 8 10 10 11 24 6 38-4 11-4 23 0 34 4 12 1 24-7 33-8 9-20 12-31 10-15-2-27-15-29-29-2-13 3-25 2-38-2-14-8-32 2-42 4-5 9-9 17-14z"
            region="africa"
            active={completedSteps > 3 || currentRegion === 'africa'}
            current={currentRegion === 'africa'}
          />
          <ContinentPath
            d="M257 102c16-20 42-31 72-31 24 0 47 9 60 23 10 10 11 22 2 30-9 8-22 10-34 12-14 1-28 1-39 11-10 9-23 15-38 14-12-1-21-8-24-18-4-14-9-28 1-41z"
            region="asia"
            active={completedSteps > 4 || currentRegion === 'asia'}
            current={currentRegion === 'asia'}
          />
          <ContinentPath
            d="M318 262c9-5 20-6 29-2 8 4 13 11 14 19 1 8-2 14-9 18-9 5-19 6-28 2-8-4-13-11-13-19 0-8 2-13 7-18z"
            region="asia"
            active={completedSteps > 4}
            current={false}
            small
          />
        </svg>

        <div className="absolute inset-x-10 bottom-6 flex items-center justify-between rounded-full border border-white/70 bg-white/58 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 backdrop-blur-md">
          {steps.map((step, index) => {
            const isDone = index < completedSteps;
            const isCurrent = index === currentStep;
            const region = regionCopy[step.region];
            return (
              <span key={step.key} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full transition-all"
                  style={{
                    background: isDone || isCurrent ? region.tone : 'rgba(148, 163, 184, 0.25)',
                    boxShadow: isDone || isCurrent ? `0 0 0 6px ${region.glow}` : 'none',
                    transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
                <span className={isCurrent ? 'text-slate-700' : ''}>{region.label.split(' ')[0]}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContinentPath({
  d,
  region,
  active,
  current,
  small = false,
}: {
  d: string;
  region: Step['region'];
  active: boolean;
  current: boolean;
  small?: boolean;
}) {
  const colors = regionCopy[region];

  return (
    <path
      d={d}
      fill={active ? colors.fill : 'rgba(255,255,255,0.58)'}
      stroke={active ? colors.tone : 'rgba(255,255,255,0.5)'}
      strokeWidth={small ? 1.5 : 2}
      filter={active ? 'url(#continentGlow)' : undefined}
      style={{
        opacity: active ? 1 : 0.78,
        transformOrigin: 'center',
        transformBox: 'fill-box',
        transform: current ? 'scale(1.02)' : 'scale(1)',
      }}
    />
  );
}

export function GlowbalOption3GlobeDemo() {
  const [answers, setAnswers] = useState<Answers>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const completedSteps = useMemo(
    () => steps.filter((step) => Boolean(answers[step.key])).length,
    [answers],
  );

  const currentIndex = activeIndex;
  const currentStep = steps[currentIndex];
  const selected = answers[currentStep.key];

  const isComplete = completedSteps === steps.length;

  function choose(label: string) {
    setAnswers((prev) => ({ ...prev, [currentStep.key]: label }));
    if (currentIndex < steps.length - 1) {
      window.setTimeout(() => {
        setActiveIndex((prev) => Math.min(prev + 1, steps.length - 1));
      }, 160);
    }
  }

  function goBack() {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  }

  function reset() {
    setAnswers({});
    setActiveIndex(0);
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top_left,rgba(255,61,154,0.10),transparent_18%),radial-gradient(circle_at_90%_10%,rgba(0,194,255,0.12),transparent_20%),linear-gradient(180deg,#f8f8ff_0%,#fff9fb_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[32px] border border-white/70 bg-white/75 px-6 py-6 shadow-[0_20px_60px_rgba(29,78,216,0.08)] backdrop-blur-md sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/70 bg-pink-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-500">
            Glowbal demo · option 3 evolved
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
                Big choices, softer branding, and the globe as the only progress signal.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                This version drops the top progress bars and lets the glowing globe tell the story instead.
                Each answer lights up a new region and nudges the flow forward.
              </p>
            </div>
            <div className="rounded-[24px] border border-sky-100 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-[0_12px_30px_rgba(14,165,233,0.08)]">
              <span className="font-semibold text-slate-800">Current demo focus:</span> light, fun, student-first Glowbal energy
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,255,255,0.72))] p-6 shadow-[0_28px_80px_rgba(125,125,255,0.12)] backdrop-blur-xl sm:p-8">
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-pink-200/30 blur-3xl" />
            <div className="absolute right-0 top-20 h-44 w-44 rounded-full bg-cyan-200/35 blur-3xl" />

            <div className="relative flex min-h-[780px] flex-col items-center justify-between gap-6">
              <div className="w-full">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-600">Glowbal</div>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-500 transition hover:-translate-y-0.5 hover:text-slate-700"
                  >
                    Reset demo
                  </button>
                </div>
                <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
                  The globe fills in as your shortlist takes shape. No bars, no clutter — just one clear question at a time.
                </p>
              </div>

              <GlowbalGlobe currentStep={currentIndex} completedSteps={completedSteps} />

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {steps.map((step, index) => {
                  const region = regionCopy[step.region];
                  const done = Boolean(answers[step.key]);
                  const current = index === currentIndex;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => {
                        if (index <= completedSteps) setActiveIndex(index);
                      }}
                      className="rounded-[24px] border px-4 py-4 text-left transition duration-200"
                      style={{
                        borderColor: current ? region.tone : 'rgba(226,232,240,0.9)',
                        background: current
                          ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,248,252,0.92))'
                          : 'rgba(255,255,255,0.72)',
                        boxShadow: current ? `0 16px 30px ${region.glow}` : '0 10px 22px rgba(15,23,42,0.04)',
                        opacity: index > completedSteps ? 0.55 : 1,
                      }}
                    >
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: done || current ? region.tone : 'rgba(148,163,184,0.35)' }}
                        />
                        {region.label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-800">{step.title}</div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">
                        {answers[step.key] || (current ? 'Current question' : done ? 'Completed' : 'Up next')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-white/70 bg-white/82 p-6 shadow-[0_28px_80px_rgba(255,105,180,0.10)] backdrop-blur-xl sm:p-8">
            {!isComplete ? (
              <div className="flex min-h-[780px] flex-col">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-500">
                  {currentStep.eyebrow}
                </div>
                <h2 className="mt-6 max-w-[14ch] text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
                  {currentStep.title}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                  {currentStep.description}
                </p>

                <div className="mt-8 grid gap-4">
                  {currentStep.options.map((option) => {
                    const active = selected === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => choose(option.label)}
                        className="rounded-[28px] border px-5 py-5 text-left transition duration-200 hover:-translate-y-0.5"
                        style={{
                          borderColor: active ? '#65D9C1' : 'rgba(226,232,240,0.9)',
                          background: active
                            ? 'linear-gradient(180deg, rgba(240,255,250,1), rgba(255,246,251,0.96))'
                            : 'rgba(255,255,255,0.88)',
                          boxShadow: active
                            ? '0 18px 34px rgba(101,217,193,0.16)'
                            : '0 12px 24px rgba(15,23,42,0.05)',
                        }}
                      >
                        <div className="text-xl font-semibold tracking-[-0.02em] text-slate-900">{option.label}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">{option.hint}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-auto flex items-center justify-between gap-4 pt-8">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={currentIndex === 0}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  <div className="text-right text-sm text-slate-500">
                    <div className="font-medium text-slate-700">The globe is doing the progress job.</div>
                    <div>No extra bars needed.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[780px] flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-500">
                    Shortlist energy set
                  </div>
                  <h2 className="mt-6 max-w-[12ch] text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
                    Nice. This feels much more Glowbal.
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                    The demo ends with a soft summary instead of another heavy form. From here the real product could transition into live university matches.
                  </p>
                </div>

                <div className="mt-8 grid gap-4">
                  {steps.map((step) => (
                    <div key={step.key} className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-5 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{step.title}</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">{answers[step.key]}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveIndex(steps.length - 1)}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition hover:-translate-y-0.5"
                  >
                    Edit answers
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-full bg-[linear-gradient(135deg,#ff4d8c,#ff92c7)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(255,77,140,0.22)] transition hover:-translate-y-0.5"
                  >
                    Start again
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
