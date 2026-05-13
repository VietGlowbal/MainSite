'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import type { GlobeMethods } from 'react-globe.gl';
import {
  onboardingSteps,
  regions,
  studyLevels,
  subjectFamilies,
  supportNeeds,
} from '@/lib/onboarding-options';

type StepKey = (typeof onboardingSteps)[number]['key'];
type Answers = Partial<Record<StepKey, string | string[]>>;

type ContinentNode = {
  key: string;
  label: string;
  lat: number;
  lng: number;
  altitude: number;
  color: string;
  glow: string;
  stepKey: StepKey;
};

type GeoFeature = {
  properties?: {
    NAME?: string;
    name?: string;
    CONTINENT?: string;
    continent?: string;
  };
};

const continents: ContinentNode[] = [
  { key: 'north-america', label: 'North America', lat: 47, lng: -100, altitude: 0.18, color: '#67e8f9', glow: 'rgba(103,232,249,0.55)', stepKey: 'study_level' },
  { key: 'south-america', label: 'South America', lat: -16, lng: -58, altitude: 0.18, color: '#fbbf24', glow: 'rgba(251,191,36,0.5)', stepKey: 'subjects' },
  { key: 'europe', label: 'Europe', lat: 52, lng: 16, altitude: 0.18, color: '#f472b6', glow: 'rgba(244,114,182,0.5)', stepKey: 'countries' },
  { key: 'africa', label: 'Africa', lat: 5, lng: 20, altitude: 0.18, color: '#a3e635', glow: 'rgba(163,230,53,0.45)', stepKey: 'budget' },
  { key: 'asia', label: 'Asia', lat: 30, lng: 95, altitude: 0.18, color: '#60a5fa', glow: 'rgba(96,165,250,0.5)', stepKey: 'campus' },
  { key: 'oceania', label: 'Oceania', lat: -24, lng: 135, altitude: 0.18, color: '#2dd4bf', glow: 'rgba(45,212,191,0.48)', stepKey: 'support' },
  { key: 'antarctica', label: 'Antarctica', lat: -78, lng: 20, altitude: 0.18, color: '#c4b5fd', glow: 'rgba(196,181,253,0.52)', stepKey: 'goals' },
];

const budgetOptions = ['Under $15k', 'Up to $25k', 'Up to $50k', '$50k+'];
const campusOptions = ['Big city', 'Campus town', 'Quiet / green', 'Flexible'];
const geoJsonUrl = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
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

const continentAliases: Record<string, string> = {
  europe: 'europe',
  'north america': 'north-america',
  'south america': 'south-america',
  africa: 'africa',
  asia: 'asia',
  oceania: 'oceania',
  antarctica: 'antarctica',
};

function classifyContinent(feature: GeoFeature) {
  const raw = feature.properties?.CONTINENT || feature.properties?.continent;
  if (!raw) return null;
  return continentAliases[String(raw).trim().toLowerCase()] ?? null;
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
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const [GlobeComp, setGlobeComp] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [countriesGeo, setCountriesGeo] = useState<GeoFeature[]>([]);
  const [answers, setAnswers] = useState<Answers>(getInitialAnswers());
  const [activeIndex, setActiveIndex] = useState(0);
  const [globeReady, setGlobeReady] = useState(false);
  const [goalSeed, setGoalSeed] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    import('react-globe.gl').then((mod) => setGlobeComp(() => mod.default as ComponentType<Record<string, unknown>>));
  }, []);

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
  const currentNode = continents[activeIndex];
  const completedCount = useMemo(
    () => onboardingSteps.filter((step) => {
      const value = answers[step.key];
      return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? '').trim());
    }).length,
    [answers],
  );

  useEffect(() => {
    if (!globeReady || !globeRef.current) return;
    globeRef.current.pointOfView(
      { lat: currentNode.lat, lng: currentNode.lng, altitude: 1.55 },
      900,
    );
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.18;
    controls.enablePan = false;
    controls.enableZoom = false;
  }, [currentNode, globeReady]);

  const pointsData = useMemo(
    () => continents.map((continent, index) => ({
      ...continent,
      status: index < completedCount ? 'done' : index === activeIndex ? 'current' : 'upcoming',
      size: index === activeIndex ? 0.7 : index < completedCount ? 0.52 : 0.38,
    })),
    [activeIndex, completedCount],
  );

  const ringsData = useMemo(
    () => continents
      .filter((_, index) => index <= activeIndex)
      .map((continent, index) => ({
        ...continent,
        maxR: index === activeIndex ? 8.5 : 6.5,
        propagationSpeed: index === activeIndex ? 1.5 : 1.1,
        repeatPeriod: index === activeIndex ? 1100 : 1600,
      })),
    [activeIndex],
  );

  const highlightedContinents = useMemo(
    () => new Set(continents.slice(0, Math.max(completedCount, activeIndex + 1)).map((continent) => continent.key)),
    [activeIndex, completedCount],
  );

  const highlightedCountries = useMemo(
    () => countriesGeo.filter((feature) => {
      const continentKey = classifyContinent(feature);
      return Boolean(continentKey && highlightedContinents.has(continentKey));
    }),
    [countriesGeo, highlightedContinents],
  );

  const activeCountries = useMemo(
    () => countriesGeo.filter((feature) => classifyContinent(feature) === currentNode.key),
    [countriesGeo, currentNode.key],
  );

  const suggestedGoals = useMemo(() => {
    const rotated = [...goalIdeas.slice(goalSeed), ...goalIdeas.slice(0, goalSeed)];
    return rotated.slice(0, 15);
  }, [goalSeed]);

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
    }, 1700);
  }

  function renderStepOptions() {
    switch (activeStep.key) {
      case 'study_level':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {studyLevels.map((level) => {
              const selected = answers.study_level === level.value;
              return (
                <ChoiceCard
                  key={level.value}
                  title={level.label}
                  subtitle=""
                  selected={selected}
                  onClick={() => chooseAndAdvance(level.value)}
                />
              );
            })}
          </div>
        );

      case 'subjects':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjectFamilies.map((family) => {
              const primary = family.children[0];
              const selected = answers.subjects === primary;
              return (
                <ChoiceCard
                  key={family.key}
                  title={family.label}
                  subtitle={primary}
                  selected={selected}
                  onClick={() => chooseAndAdvance(primary)}
                />
              );
            })}
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
            ].map((region) => {
              const selected = answers.countries === region.label;
              return (
                <ChoiceCard
                  key={region.label}
                  title={region.label}
                  subtitle={region.hint}
                  selected={selected}
                  onClick={() => chooseAndAdvance(region.label)}
                />
              );
            })}
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
              placeholder="Build a global career in AI with strong scholarship support"
              className="min-h-44 w-full rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.05)] outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setGoalSeed((prev) => (prev + 1) % goalIdeas.length)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:-translate-y-0.5 hover:text-slate-700"
              >
                Generate more ideas
              </button>
              <button
                type="button"
                onClick={() => updateAnswer(suggestedGoals[0])}
                className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-500 transition hover:-translate-y-0.5"
              >
                Use one for me
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestedGoals.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => updateAnswer(idea)}
                  className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left text-sm text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-pink-200 hover:text-slate-800"
                >
                  {idea}
                </button>
              ))}
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
                  {continents[activeIndex].label}
                </div>
              </div>

              <div className="relative flex w-full flex-1 items-center justify-center">
                <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle,rgba(255,255,255,0.6),transparent_60%)]" />
                <div className={`relative h-[520px] w-full max-w-[560px] overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.6),rgba(255,255,255,0.02)_55%)] ${isSubmitting ? 'animate-[spin_1.7s_ease-in-out]' : ''}`}>
                  {mounted && GlobeComp ? (
                    <GlobeComp
                      ref={globeRef}
                      width={560}
                      height={520}
                      backgroundColor="rgba(0,0,0,0)"
                      globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
                      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                      showAtmosphere
                      atmosphereColor="rgba(186,230,253,0.8)"
                      atmosphereAltitude={0.13}
                      polygonsData={highlightedCountries}
                      polygonCapColor={(feature: object) => {
                        const continentKey = classifyContinent(feature as GeoFeature);
                        if (!continentKey) return 'rgba(255,255,255,0.14)';
                        const continent = continents.find((item) => item.key === continentKey);
                        if (!continent) return 'rgba(255,255,255,0.14)';
                        if (continentKey === currentNode.key) return continent.color;
                        if (highlightedContinents.has(continentKey)) return `${continent.color}D9`;
                        return 'rgba(255,255,255,0.10)';
                      }}
                      polygonSideColor={(feature: object) => {
                        const continentKey = classifyContinent(feature as GeoFeature);
                        const continent = continents.find((item) => item.key === continentKey);
                        return continentKey && continent ? `${continent.color}88` : 'rgba(255,255,255,0.06)';
                      }}
                      polygonStrokeColor={(feature: object) => {
                        const continentKey = classifyContinent(feature as GeoFeature);
                        if (!continentKey) return 'rgba(255,255,255,0.18)';
                        const continent = continents.find((item) => item.key === continentKey);
                        if (continentKey === currentNode.key) return continent ? continent.color : 'rgba(15,23,42,0.3)';
                        if (highlightedContinents.has(continentKey)) return continent ? `${continent.color}AA` : 'rgba(255,255,255,0.28)';
                        return 'rgba(255,255,255,0.12)';
                      }}
                      polygonAltitude={(feature: object) => {
                        const continentKey = classifyContinent(feature as GeoFeature);
                        if (continentKey === currentNode.key) return 0.085;
                        if (continentKey && highlightedContinents.has(continentKey)) return 0.04;
                        return 0.004;
                      }}
                      polygonsTransitionDuration={300}
                      pointsData={pointsData}
                      pointLat="lat"
                      pointLng="lng"
                      pointAltitude={() => 0}
                      pointRadius={() => 0}
                      pointColor={(point: object) => (point as ContinentNode & { status: string }).color}
                      pointResolution={24}
                      ringsData={[]}
                      ringLat="lat"
                      ringLng="lng"
                      ringColor={(ring: object) => {
                        const node = ring as ContinentNode;
                        return () => node.glow;
                      }}
                      ringMaxRadius={() => 0}
                      ringPropagationSpeed={() => 0}
                      ringRepeatPeriod={() => 0}
                      labelsData={[]}
                      labelLat="lat"
                      labelLng="lng"
                      labelText="label"
                      labelSize={() => 0.8}
                      labelDotRadius={() => 0}
                      labelColor={(label: object) => {
                        const node = label as ContinentNode & { status: string };
                        return node.key === currentNode.key ? '#0f172a' : 'rgba(15,23,42,0.56)';
                      }}
                      labelResolution={2}
                      labelAltitude={() => 0.23}
                      onGlobeReady={() => {
                        setGlobeReady(true);
                        if (!globeRef.current) return;
                        globeRef.current.pointOfView({ lat: currentNode.lat, lng: currentNode.lng, altitude: 1.55 }, 0);
                      }}
                    />
                  ) : (
                    <div className="h-[460px] w-full max-w-[560px] rounded-full bg-white/40" />
                  )}
                </div>
              </div>

              <div className="w-full rounded-[24px] border border-white/70 bg-white/60 px-4 py-3 text-center text-sm text-slate-500 shadow-[0_10px_22px_rgba(15,23,42,0.04)]">
                Each answer lights up every country in that continent.
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
