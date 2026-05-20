'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  onboardingSteps,
  regions,
  studyLevels,
  subjectFamilies,
  supportNeeds,
} from '@/lib/onboarding-options';
import type { StudentProfile } from '@/lib/types';

const SearchWorldSelector = dynamic(
  () => import('@/app/onboarding/world-picker').then((mod) => mod.SearchWorldSelector),
  { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-white/40" /> },
);

type StepKey = (typeof onboardingSteps)[number]['key'];
type Answers = Partial<Record<StepKey, string | string[]>>;
type Mode = 'demo' | 'live';

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
  { key: 'north-america', label: 'North America', lat: 45, lng: -100, altitude: 1.48 },
  { key: 'south-america', label: 'South America', lat: -18, lng: -60, altitude: 1.5 },
  { key: 'europe', label: 'Europe', lat: 52, lng: 16, altitude: 1.42 },
  { key: 'africa', label: 'Africa', lat: 7, lng: 20, altitude: 1.48 },
  { key: 'asia', label: 'Asia', lat: 30, lng: 95, altitude: 1.45 },
  { key: 'oceania', label: 'Oceania', lat: -24, lng: 134, altitude: 1.5 },
  { key: 'antarctica', label: 'Antarctica', lat: -77, lng: 25, altitude: 1.38 },
] as const;

type ContinentKey = (typeof stepContinents)[number]['key'];

const ONBOARDING_DRAFT_KEY = 'glowbal-onboarding-draft';

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
    study_level: '',
    subjects: '',
    countries: '',
    budget: '',
    campus: '',
    support: '',
    goals: '',
  };
}

function buildInitialAnswers(initialProfile?: StudentProfile | null): Answers {
  const firstSupport = (initialProfile?.support_needs || '').split(', ').filter(Boolean)[0] || '';
  const firstSubject = initialProfile?.target_subjects?.[0] || '';
  const preferredCountries = initialProfile?.preferred_countries || [];
  let regionAnswer = '';

  if (preferredCountries.length > 0) {
    const matchedRegion = regions.find((region) => region.countries.some((country) => preferredCountries.includes(country)));
    regionAnswer = matchedRegion?.name === 'Europe'
      ? 'Europe'
      : matchedRegion?.name === 'UK & Ireland'
        ? 'UK & Ireland'
        : matchedRegion?.name === 'North America'
          ? 'North America'
          : matchedRegion?.name === 'Asia-Pacific'
            ? 'Asia-Pacific'
            : matchedRegion?.name === 'Middle East'
              ? 'Middle East'
              : '';
  }

  return {
    study_level: initialProfile?.study_level || '',
    subjects: firstSubject,
    countries: regionAnswer,
    budget: initialProfile?.budget_range || '',
    campus: initialProfile?.campus_preferences || '',
    support: firstSupport,
    goals: initialProfile?.goals || '',
  };
}

function mapCountries(answer: string) {
  switch (answer) {
    case 'UK & Ireland':
      return ['United Kingdom', 'Ireland'];
    case 'Europe':
      return ['Netherlands', 'Germany', 'France', 'Sweden', 'Switzerland', 'Spain', 'Italy'];
    case 'North America':
      return ['United States', 'Canada'];
    case 'Asia-Pacific':
      return ['Singapore', 'Australia', 'New Zealand', 'Japan', 'South Korea', 'Hong Kong'];
    case 'Middle East':
      return ['United Arab Emirates', 'Qatar'];
    default:
      return [];
  }
}

function answersToProfile(answers: Answers): StudentProfile {
  return {
    study_level: String(answers.study_level || '') || null,
    target_subjects: answers.subjects ? [String(answers.subjects)] : [],
    preferred_countries: answers.countries ? mapCountries(String(answers.countries)) : [],
    budget_range: String(answers.budget || '') || null,
    goals: String(answers.goals || '') || null,
    career_interests: answers.subjects ? [String(answers.subjects)] : [],
    campus_preferences: String(answers.campus || '') || null,
    support_needs: String(answers.support || '') || null,
  };
}

export function GlowbalOption3GlobeDemo({
  initialProfile = null,
  isSignedIn = false,
  mode = 'demo',
}: {
  initialProfile?: StudentProfile | null;
  isSignedIn?: boolean;
  mode?: Mode;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [countriesGeo, setCountriesGeo] = useState<GeoFeature[]>([]);
  const [answers, setAnswers] = useState<Answers>(() => (mode === 'live' ? buildInitialAnswers(initialProfile) : getInitialAnswers()));
  const [activeIndex, setActiveIndex] = useState(0);
  const [goalSeed, setGoalSeed] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finishSpinFocus, setFinishSpinFocus] = useState<{ lat: number; lng: number; altitude?: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (mode !== 'live') return;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { answers?: Answers; stepIndex?: number };
      if (parsed.answers) setAnswers(parsed.answers);
      if (typeof parsed.stepIndex === 'number') setActiveIndex(Math.max(0, Math.min(parsed.stepIndex, onboardingSteps.length - 1)));
    } catch {
      // ignore draft failures
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'live') return;
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers, stepIndex: activeIndex }));
    } catch {
      // ignore draft failures
    }
  }, [activeIndex, answers, mode]);

  const activeStep = onboardingSteps[activeIndex];
  const currentContinent = stepContinents[activeIndex];

  const completedStepIndexes = useMemo(
    () => onboardingSteps.flatMap((step, index) => {
      const value = answers[step.key];
      const filled = Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
      return filled ? [index] : [];
    }),
    [answers],
  );

  const litContinents = useMemo(
    () => new Set(completedStepIndexes.map((index) => stepContinents[index].key)),
    [completedStepIndexes],
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
    () => {
      const match = countriesGeo.find(
        (feature) => classifyContinent(feature) === currentContinent.key && getFeatureName(feature),
      );
      return match ? getFeatureName(match) : null;
    },
    [countriesGeo, currentContinent.key],
  );

  const previewFocus = useMemo(
    () => finishSpinFocus ?? { lat: currentContinent.lat, lng: currentContinent.lng, altitude: currentContinent.altitude },
    [currentContinent, finishSpinFocus],
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

  async function persistLiveOnboarding() {
    if (!isSignedIn) {
      router.push(`/auth?redirect=${encodeURIComponent('/onboarding?complete=1')}`);
      return false;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in so we can save your profile.');
      return false;
    }

    const profile = answersToProfile(answers);
    const payload = {
      user_id: userData.user.id,
      study_level: profile.study_level || null,
      target_subjects: profile.target_subjects || [],
      preferred_countries: profile.preferred_countries || [],
      budget_range: profile.budget_range || null,
      academic_background: null,
      goals: profile.goals || null,
      career_interests: profile.career_interests || [],
      campus_preferences: profile.campus_preferences || null,
      support_needs: profile.support_needs || null,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('student_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      setMessage(error.message);
      return false;
    }

    try {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      // ignore draft cleanup failures
    }

    return true;
  }

  function finishDemo() {
    setIsSubmitting(true);
    const durationMs = 2400;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setFinishSpinFocus({
        lat: 14 * Math.sin(eased * Math.PI * 1.35) - 6,
        lng: -150 + eased * 390,
        altitude: 1.34 + 0.06 * Math.cos(eased * Math.PI * 2),
      });

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      } else {
        setFinishSpinFocus(null);
        if (mode === 'live') {
          void persistLiveOnboarding().then((ok) => {
            if (ok) setShowCompletion(true);
            setIsSubmitting(false);
          });
        } else {
          setShowCompletion(true);
          setIsSubmitting(false);
        }
      }
    }

    window.requestAnimationFrame(tick);
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
              placeholder="Type your own answer or generate one"
              className="min-h-32 w-full rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)] outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
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
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-[calc(100vh-73px)] bg-[radial-gradient(circle_at_top_left,rgba(255,61,154,0.10),transparent_20%),radial-gradient(circle_at_92%_8%,rgba(0,194,255,0.12),transparent_18%),linear-gradient(180deg,#f6f7ff_0%,#fff9fb_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-4 lg:grid-cols-[1.12fr_0.88fr] xl:gap-3">
          <section className="relative overflow-visible p-0">
            <div className="relative flex min-h-[680px] flex-col items-center justify-center overflow-visible lg:min-h-[760px]">
              <div className="relative flex w-full flex-1 items-center justify-center overflow-visible">
                <div className="relative left-[-14%] h-[860px] w-[155%] overflow-visible lg:left-[-18%] lg:h-[980px] lg:w-[176%] xl:left-[-16%]">
                  <SearchWorldSelector
                    selectedCountries={selectedCountries}
                    onToggleCountry={() => {}}
                    previewCountry={previewCountry}
                    previewFocus={previewFocus}
                    railClassName="h-full w-full overflow-visible"
                    stageClassName="glow-search-globe-stage-large w-full overflow-visible"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/70 bg-white/88 p-5 shadow-[0_24px_64px_rgba(255,105,180,0.10)] backdrop-blur-xl sm:p-6 lg:min-h-[620px] xl:min-h-[600px]">
            <div className="flex min-h-[560px] flex-col lg:min-h-[560px] xl:min-h-[540px]">
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
                      {isSubmitting ? 'Flying...' : 'Finish'}
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

              <h2 className="mt-5 max-w-[14ch] text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">
                {activeStep.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">{activeStep.description}</p>

              <div className="mt-6">{renderStepOptions()}</div>
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
              <p className="mt-4 text-lg text-slate-600">Ready to go GLOWBAL?</p>
              <button
                type="button"
                onClick={() => router.push(mode === 'live' ? '/onboarding/documents' : '/universities')}
                className="mt-8 rounded-full bg-[linear-gradient(135deg,#00c2ff,#90e0ef)] px-8 py-3 text-base font-semibold text-white shadow-[0_16px_30px_rgba(0,194,255,0.22)] transition hover:-translate-y-0.5"
              >
                yeah
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-4 text-center text-sm text-slate-600">{message}</p> : null}
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
