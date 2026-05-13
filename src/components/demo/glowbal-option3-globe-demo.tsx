'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  onboardingSteps,
  studyLevels,
  subjectFamilies,
  supportNeeds,
} from '@/lib/onboarding-options';

const SearchWorldSelector = dynamic(
  () => import('@/app/onboarding/world-picker').then((mod) => mod.SearchWorldSelector),
  { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-white/40" /> },
);

type StepKey = (typeof onboardingSteps)[number]['key'];
type Answers = Partial<Record<StepKey, string | string[]>>;

type GeoFeature = {
  properties?: {
    NAME?: string;
    name?: string;
    CONTINENT?: string;
    continent?: string;
  };
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
};

const geoJsonUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
const budgetOptions = ['Under $15k', 'Up to $25k', 'Up to $50k', '$50k+'];
const campusOptions = ['Big city', 'Campus town', 'Quiet / green', 'Flexible'];
const goalIdeas = [
  'Build a global AI career with strong scholarship support.',
  'Study computer science abroad and launch a startup one day.',
  'Find a university that opens doors into product and innovation.',
  'Move into a big international city and grow my confidence.',
  'Get a practical degree that leads to strong job options worldwide.',
  'Study somewhere exciting, modern, and internationally connected.',
  'Find a university that balances affordability with strong outcomes.',
  'Grow into a future engineer who can work on world-changing problems.',
  'Build a career in finance or business with global mobility.',
  'Study in a place where I can meet ambitious people from everywhere.',
  'Discover the best-fit route into medicine or health science abroad.',
  'Find a creative degree with strong industry links and real momentum.',
  'Use university as a launchpad into a meaningful global career.',
  'Study abroad somewhere that feels safe, energising, and full of opportunity.',
  'Find a university where I can build skills, network, and long-term options.',
  'Choose a path that helps me become independent and globally minded.',
  'Study somewhere with strong internships and a clear career pipeline.',
  'Build a future around technology, creativity, and international experience.',
];

const stepContinents = [
  { key: 'north-america', label: 'North America' },
  { key: 'south-america', label: 'South America' },
  { key: 'europe', label: 'Europe' },
  { key: 'africa', label: 'Africa' },
  { key: 'asia', label: 'Asia' },
  { key: 'oceania', label: 'Oceania' },
  { key: 'antarctica', label: 'Antarctica' },
] as const;

type ContinentKey = (typeof stepContinents)[number]['key'];

const continentAliases: Record<string, ContinentKey> = {
  europe: 'europe',
  'north america': 'north-america',
  'south america': 'south-america',
  africa: 'africa',
  asia: 'asia',
  oceania: 'oceania',
  antarctica: 'antarctica',
};

function getFeatureName(feature: GeoFeature) {
  return feature.properties?.NAME || feature.properties?.name || '';
}

function getFeatureCentroid(feature: GeoFeature) {
  if (!feature.geometry) return null;
  const coords = (feature.geometry.type === 'Polygon'
    ? feature.geometry.coordinates[0]
    : feature.geometry.coordinates[0]?.[0]) as number[][] | undefined;
  if (!coords?.length) return null;

  const total = coords.reduce(
    (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / coords.length,
    lng: total.lng / coords.length,
  };
}

function classifyContinent(feature: GeoFeature): ContinentKey | null {
  const raw = feature.properties?.CONTINENT || feature.properties?.continent;
  if (raw) return continentAliases[String(raw).trim().toLowerCase()] ?? null;

  const centroid = getFeatureCentroid(feature);
  if (!centroid) return null;
  const { lat, lng } = centroid;

  if (lat < -55) return 'antarctica';
  if (lng >= 110 && lat < 5) return 'oceania';
  if (lng >= -20 && lng <= 55 && lat >= -35 && lat <= 37) return 'africa';
  if (lng >= -12 && lng <= 45 && lat >= 35) return 'europe';
  if (lng >= 25 && lng <= 180 && lat >= 0) return 'asia';
  if (lng >= 110 && lat >= 5) return 'asia';
  if (lng <= -30 && lat >= 12) return 'north-america';
  if (lng <= -30 && lat < 12) return 'south-america';
  if (lng > -30 && lng < 25 && lat >= 0) return 'europe';
  if (lng > -30 && lng < 25 && lat < 0) return 'africa';
  return null;
}

function getInitialAnswers(): Answers {
  return {
    study_level: 'undergraduate',
    subjects: 'Computer Science',
    countries: 'North America',
    budget: 'Up to $25k',
    campus: 'Big city',
    support: 'Scholarships and funding',
    goals: '',
  };
}

export function GlowbalOption3GlobeDemo() {
  const router = useRouter();
  const [countriesGeo, setCountriesGeo] = useState<GeoFeature[]>([]);
  const [answers, setAnswers] = useState<Answers>(getInitialAnswers());
  const [activeIndex, setActiveIndex] = useState(0);
  const [goalSeed, setGoalSeed] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(geoJsonUrl)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCountriesGeo(data.features || []);
      })
      .catch(() => {
        if (!cancelled) setCountriesGeo([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeStep = onboardingSteps[activeIndex];
  const currentContinent = stepContinents[activeIndex];

  const completedCount = useMemo(
    () => onboardingSteps.filter((step) => {
      const value = answers[step.key];
      return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
    }).length,
    [answers],
  );

  const litContinents = useMemo(
    () => new Set(stepContinents.slice(0, Math.max(completedCount, activeIndex + 1)).map((item) => item.key)),
    [activeIndex, completedCount],
  );

  const selectedCountries = useMemo(
    () => countriesGeo
      .filter((feature) => {
        const continent = classifyContinent(feature);
        return Boolean(continent && litContinents.has(continent));
      })
      .map(getFeatureName)
      .filter(Boolean),
    [countriesGeo, litContinents],
  );

  const previewCountry = useMemo(
    () => countriesGeo.find((feature) => classifyContinent(feature) === currentContinent.key && getFeatureName(feature)) ? getFeatureName(countriesGeo.find((feature) => classifyContinent(feature) === currentContinent.key && getFeatureName(feature)) as GeoFeature) : null,
    [countriesGeo, currentContinent.key],
  );

  const generatedGoal = useMemo(() => goalIdeas[goalSeed % goalIdeas.length], [goalSeed]);

  function updateAnswer(value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [activeStep.key]: value }));
  }

  function goNext() {
    setActiveIndex((prev) => Math.min(prev + 1, onboardingSteps.length - 1));
  }

  function goBack() {
    setActiveIndex((prev) => Math.max(prev - 1, 0));
  }

  function chooseAndAdvance(value: string) {
    updateAnswer(value);
    if (activeIndex < onboardingSteps.length - 1) {
      window.setTimeout(goNext, 120);
    }
  }

  function finishDemo() {
    setIsSubmitting(true);
    window.setTimeout(() => {
      setShowCompletion(true);
      setIsSubmitting(false);
    }, 1800);
  }

  function renderStepOptions() {
    switch (activeStep.key) {
      case 'study_level':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {studyLevels.map((level) => (
              <ChoiceCard
                key={level.value}
                title={level.label}
                subtitle=""
                selected={answers.study_level === level.value}
                onClick={() => chooseAndAdvance(level.value)}
              />
            ))}
          </div>
        );

      case 'subjects':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjectFamilies.map((family) => (
              <ChoiceCard
                key={family.key}
                title={family.label}
                subtitle={family.children[0]}
                selected={answers.subjects === family.children[0]}
                onClick={() => chooseAndAdvance(family.children[0])}
              />
            ))}
          </div>
        );

      case 'countries':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: 'UK & Ireland', hint: 'United Kingdom, Ireland' },
              { label: 'Europe', hint: 'Germany, France, Netherlands' },
              { label: 'North America', hint: 'United States, Canada' },
              { label: 'Asia-Pacific', hint: 'Singapore, Australia, Japan' },
              { label: 'Middle East', hint: 'UAE, Qatar' },
              { label: 'Open to ideas', hint: 'Show best-fit places first' },
            ].map((region) => (
              <ChoiceCard
                key={region.label}
                title={region.label}
                subtitle={region.hint}
                selected={answers.countries === region.label}
                onClick={() => chooseAndAdvance(region.label)}
              />
            ))}
          </div>
        );

      case 'budget':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {budgetOptions.map((option) => (
              <ChoiceCard
                key={option}
                title={option}
                subtitle=""
                selected={answers.budget === option}
                onClick={() => chooseAndAdvance(option)}
              />
            ))}
          </div>
        );

      case 'campus':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {campusOptions.map((option) => (
              <ChoiceCard
                key={option}
                title={option}
                subtitle=""
                selected={answers.campus === option}
                onClick={() => chooseAndAdvance(option)}
              />
            ))}
          </div>
        );

      case 'support':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {supportNeeds.map((need) => (
              <ChoiceCard
                key={need}
                title={need}
                subtitle=""
                selected={answers.support === need}
                onClick={() => chooseAndAdvance(need)}
              />
            ))}
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-4">
            <textarea
              value={String(answers.goals ?? '')}
              onChange={(event) => updateAnswer(event.target.value)}
              placeholder="Tap generate to create a future goal"
              className="min-h-44 w-full rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)] outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const nextSeed = (goalSeed + 1) % goalIdeas.length;
                  setGoalSeed(nextSeed);
                  updateAnswer(goalIdeas[nextSeed]);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:-translate-y-0.5 hover:text-slate-700"
              >
                {answers.goals ? 'Generate another response' : 'Generate a response'}
              </button>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              {String(answers.goals ?? '').trim() || generatedGoal}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top_left,rgba(255,61,154,0.10),transparent_20%),radial-gradient(circle_at_92%_8%,rgba(0,194,255,0.12),transparent_18%),linear-gradient(180deg,#f6f7ff_0%,#fff9fb_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.68))] p-6 shadow-[0_28px_80px_rgba(125,125,255,0.12)] backdrop-blur-xl sm:p-8">
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-pink-200/30 blur-3xl" />
            <div className="absolute right-0 top-16 h-44 w-44 rounded-full bg-cyan-200/35 blur-3xl" />

            <div className="relative flex min-h-[780px] flex-col items-center justify-between gap-6">
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-600">Glowbal</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">7 continents · 7 questions</div>
                </div>
                <div className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-500">
                  {currentContinent.label}
                </div>
              </div>

              <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-[32px]">
                <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[radial-gradient(circle,rgba(255,255,255,0.6),transparent_60%)]" />
                <div className="pointer-events-none absolute inset-[14%] rounded-full border border-cyan-200/55 shadow-[0_0_0_1px_rgba(255,255,255,0.72),0_0_38px_rgba(125,211,252,0.16)]" />
                <div className="pointer-events-none absolute inset-[19%] rounded-full border border-white/30" />
                <div className="relative h-[560px] w-full">
                  <SearchWorldSelector
                    selectedCountries={selectedCountries}
                    onToggleCountry={() => {}}
                    previewCountry={previewCountry}
                  />
                </div>
              </div>

              <div className="w-full rounded-[24px] border border-white/70 bg-white/60 px-4 py-3 text-center text-sm text-slate-500 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                This uses the same country-highlighting globe behaviour as search — it just fills automatically after each answer.
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-white/70 bg-white/82 p-6 shadow-[0_28px_80px_rgba(255,105,180,0.10)] backdrop-blur-xl sm:p-8">
            <div className="flex min-h-[780px] flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-pink-500">
                    {activeStep.eyebrow}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={activeIndex === 0}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>
                  {activeStep.key === 'goals' ? (
                    <button
                      type="button"
                      onClick={finishDemo}
                      disabled={isSubmitting}
                      className="rounded-full bg-[linear-gradient(135deg,#ff4d8c,#ff92c7)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(255,77,140,0.22)] transition hover:-translate-y-0.5 disabled:opacity-70"
                    >
                      {isSubmitting ? 'Launching...' : 'Finish'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-full bg-[linear-gradient(135deg,#00c2ff,#90e0ef)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(0,194,255,0.22)] transition hover:-translate-y-0.5"
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>

              <h2 className="mt-6 max-w-[14ch] text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
                {activeStep.title}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">{activeStep.description}</p>

              <div className="mt-8">{renderStepOptions()}</div>
            </div>
          </section>
        </div>

        {showCompletion ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[36px] border border-white/70 bg-white/92 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff4d8c,#00c2ff)] text-4xl text-white shadow-[0_16px_40px_rgba(255,77,140,0.24)]">
                🌍
              </div>
              <h3 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-900">You’re out of this world</h3>
              <p className="mt-4 text-lg text-slate-600">Ready to go glowbal?</p>
              <button
                type="button"
                onClick={() => router.push('/universities')}
                className="mt-8 rounded-full bg-[linear-gradient(135deg,#00c2ff,#90e0ef)] px-8 py-3 text-base font-semibold text-white shadow-[0_16px_30px_rgba(0,194,255,0.22)] transition hover:-translate-y-0.5"
              >
                yeah
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[28px] border px-5 py-5 text-left transition duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: selected ? '#67e8f9' : 'rgba(226,232,240,0.9)',
        background: selected
          ? 'linear-gradient(180deg, rgba(240,255,250,1), rgba(255,246,251,0.96))'
          : 'rgba(255,255,255,0.88)',
        boxShadow: selected
          ? '0 18px 34px rgba(103,232,249,0.16)'
          : '0 12px 24px rgba(15,23,42,0.05)',
      }}
    >
      <div className="text-xl font-semibold tracking-[-0.02em] text-slate-900">{title}</div>
      {subtitle ? <div className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</div> : null}
    </button>
  );
}
