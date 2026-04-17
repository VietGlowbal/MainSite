'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudentProfile } from '@/lib/types';
import {
  onboardingSteps,
  regions,
  studyLevels,
  subjectFamilies,
  supportNeeds,
} from '@/lib/onboarding-options';

const GlobeCountryPicker = dynamic(() => import('./world-picker').then((mod) => mod.WorldPicker), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-black/5 bg-white/86 text-sm text-slate-600 shadow-[0_10px_24px_rgba(22,33,62,0.05)]">
      Loading globe experience...
    </div>
  ),
});

type Props = {
  initialProfile?: StudentProfile | null;
};

const budgetMarks = ['Under $15k', 'Up to $25k', 'Up to $50k', '$50k+'];
const vennZones = [
  { key: 'city', label: 'Big city', x: '24%', y: '30%' },
  { key: 'campus', label: 'Campus town', x: '62%', y: '30%' },
  { key: 'quiet', label: 'Quiet / green', x: '43%', y: '63%' },
  { key: 'city-campus', label: 'City + campus', x: '43%', y: '27%' },
  { key: 'city-quiet', label: 'City + quiet', x: '33%', y: '47%' },
  { key: 'campus-quiet', label: 'Campus + quiet', x: '53%', y: '47%' },
  { key: 'flexible', label: 'Flexible', x: '43%', y: '40%' },
];

const stepVisuals: Record<string, { emoji: string; label: string; style: CSSProperties }> = {
  study_level: {
    emoji: '🧭',
    label: 'Pathfinder',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(6,182,212,0.78), rgba(30,64,175,0.72)), url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  subjects: {
    emoji: '✨',
    label: 'Curiosity',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(168,85,247,0.8), rgba(79,70,229,0.7)), url("https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  countries: {
    emoji: '🌍',
    label: 'Explore',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(16,185,129,0.76), rgba(8,145,178,0.68)), url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  budget: {
    emoji: '🌿',
    label: 'Realistic',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(245,158,11,0.72), rgba(180,83,9,0.68)), url("https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  campus: {
    emoji: '🏙️',
    label: 'Atmosphere',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(99,102,241,0.78), rgba(37,99,235,0.68)), url("https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  support: {
    emoji: '🤝',
    label: 'Support',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(244,63,94,0.74), rgba(236,72,153,0.68)), url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
  goals: {
    emoji: '🚀',
    label: 'Future',
    style: {
      backgroundImage:
        'linear-gradient(140deg, rgba(14,165,233,0.74), rgba(15,23,42,0.78)), url("https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80")',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    },
  },
};

export function OnboardingForm({ initialProfile }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<StudentProfile>({
    study_level: initialProfile?.study_level ?? '',
    target_subjects: initialProfile?.target_subjects ?? [],
    preferred_countries: initialProfile?.preferred_countries ?? [],
    budget_range: initialProfile?.budget_range ?? budgetMarks[1],
    academic_background: initialProfile?.academic_background ?? '',
    goals: initialProfile?.goals ?? '',
    career_interests: initialProfile?.career_interests ?? [],
    campus_preferences: initialProfile?.campus_preferences ?? '',
    support_needs: initialProfile?.support_needs ?? '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeFamily, setActiveFamily] = useState('');
  const [pulsingFamily, setPulsingFamily] = useState<string | null>(null);
  const [budgetIndex, setBudgetIndex] = useState(
    Math.max(budgetMarks.indexOf(initialProfile?.budget_range || budgetMarks[1]), 0),
  );

  const step = onboardingSteps[stepIndex];
  const progress = ((stepIndex + 1) / onboardingSteps.length) * 100;
  const stepVisual = stepVisuals[step.key] ?? stepVisuals.study_level;
  const activeSubjectFamily = subjectFamilies.find((family) => family.key === activeFamily) ?? subjectFamilies[0];
  const selectedSupportNeeds = (profile.support_needs || '').split(', ').filter(Boolean);
  const selectedSubjects = profile.target_subjects || [];
  const selectedCountries = profile.preferred_countries || [];
  const selectedSubjectCounts = subjectFamilies
    .map((family) => ({
      key: family.key,
      label: family.label,
      count: family.children.filter((subject) => selectedSubjects.includes(subject)).length,
    }))
    .filter((family) => family.count > 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in first so we can save your profile.');
      setLoading(false);
      return;
    }

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
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('student_profiles').upsert(payload, {
      onConflict: 'user_id',
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Profile saved. This version should feel much more polished.');
    }

    setLoading(false);
  };

  const isLastStep = stepIndex === onboardingSteps.length - 1;

  useEffect(() => {
    if (!pulsingFamily) return;

    const timeout = setTimeout(() => setPulsingFamily(null), 900);
    return () => clearTimeout(timeout);
  }, [pulsingFamily]);

  return (
    <form className="onboarding-form-shell" onSubmit={handleSubmit}>
      <section className={`onboarding-visual-panel relative hidden h-full overflow-hidden rounded-[2rem] border border-black/5 bg-white lg:block p-7 lg:p-8`}>
        <div className="absolute inset-0" style={stepVisual.style} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-slate-900/16 to-slate-900/38" />
        <div className="onboarding-visual-glow onboarding-visual-glow-left" />
        <div className="onboarding-visual-glow onboarding-visual-glow-right" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/30 bg-white/16 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                {step.eyebrow} of {onboardingSteps.length}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/14 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                <span aria-hidden="true">{stepVisual.emoji}</span>
                {stepVisual.label}
              </span>
            </div>
            <div className="mt-8 max-w-xl space-y-5">
              <h1 className="text-4xl font-semibold tracking-tight text-white lg:text-5xl">
                {step.visualTitle}
              </h1>
              <p className="max-w-lg text-base leading-8 text-slate-100/90 lg:text-lg">
                {step.visualBody}
              </p>
            </div>
          </div>

          <div className="mt-12 space-y-5">
            <div className="max-w-lg rounded-[1.75rem] border border-white/25 bg-white/14 p-5 backdrop-blur-sm">
              <p className="onboarding-eyebrow text-cyan-100/70">Onboarding snapshot</p>
              <p className="mt-3 text-sm leading-7 text-slate-100/85">
                Clean, guided, and student-first. Each step should feel focused, visual, and easy to act on.
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Subjects" value={String(selectedSubjects.length)} />
              <MetricCard label="Countries" value={String(selectedCountries.length)} />
              <MetricCard label="Budget" value={profile.budget_range || 'Unset'} />
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-black/5 bg-white/95 shadow-[0_20px_44px_rgba(22,33,62,0.08)]">
        <div className="border-b border-black/5 px-7 pb-5 pt-7 lg:px-8 lg:pt-8">
          <div className="space-y-3">
            <p className="onboarding-step-eyebrow text-sky-500">{step.eyebrow}</p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{step.title}</h2>
            <p className="max-w-xl text-sm leading-7 text-slate-600">{step.description}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6 lg:px-8 lg:py-7">
          <div className={`onboarding-step-body transition-all duration-300 ease-out ${step.key === 'study_level' ? 'onboarding-step-body-study-level' : step.key === 'subjects' ? 'onboarding-step-body-tight' : step.key === 'countries' ? 'onboarding-step-body-tight' : 'onboarding-step-body-default'}`}>
            {step.key === 'study_level' && (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                {studyLevels.map((level) => (
                  <StudyLevelCard
                    key={level.value}
                    label={level.label}
                    description={getStudyLevelDescription(level.value)}
                    selected={profile.study_level === level.value}
                    onClick={() => setProfile((current) => ({ ...current, study_level: level.value }))}
                  />
                ))}
              </div>
            )}

            {step.key === 'subjects' && (
              <div className="glow-stack-md">
                <div className="grid gap-4 md:grid-cols-2">
                  {subjectFamilies.map((family) => {
                    const count = family.children.filter((subject) => selectedSubjects.includes(subject)).length;
                    return (
                      <SubjectFamilyCard
                        key={family.key}
                        label={family.label}
                        count={count}
                        image={getSubjectFamilyImage(family.key)}
                        pulsing={pulsingFamily === family.key}
                        onClick={() => setActiveFamily(family.key)}
                      />
                    );
                  })}
                </div>

                <div className="glow-muted-card">
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgb(2 132 199)' }}>Selected subjects</p>
                  {selectedSubjects.length > 0 ? (
                    <div className="glow-wrap-row-tight" style={{ marginTop: '0.75rem' }}>
                      {selectedSubjects.map((subject) => (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => toggleArrayValue('target_subjects', subject)}
                          className="glow-chip"
                        >
                          <span>{subject}</span>
                          <span className="glow-chip-remove">✕</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.95rem', color: 'rgb(100 116 139)' }}>Choose a category to start building your subject mix.</p>
                  )}
                </div>

                <SubjectPickerModal
                  family={activeSubjectFamily}
                  selectedSubjects={selectedSubjects}
                  onClose={() => setActiveFamily('')}
                  onToggleSubject={(subject) => toggleArrayValue('target_subjects', subject)}
                  onDone={() => {
                    if (activeSubjectFamily?.key) setPulsingFamily(activeSubjectFamily.key);
                    setActiveFamily('');
                  }}
                  open={step.key === 'subjects' && Boolean(activeFamily)}
                />
              </div>
            )}

            {step.key === 'countries' && (
              <div className="glow-stack-sm">
                <GlobeCountryPicker
                  regions={regions}
                  selectedCountries={selectedCountries}
                  onToggleCountry={(country) => toggleArrayValue('preferred_countries', country)}
                />
                {selectedCountries.length > 0 && (
                  <div className="glow-selected-card">
                    <p className="glow-section-label">Selected countries</p>
                    <div className="glow-wrap-row" style={{ marginTop: '1rem' }}>
                      {selectedCountries.map((country) => (
                        <Chip
                          key={country}
                          label={country}
                          selected
                          onClick={() => toggleArrayValue('preferred_countries', country)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step.key === 'budget' && (
              <BudgetSlider
                budgetIndex={budgetIndex}
                onChange={(i) => {
                  setBudgetIndex(i);
                  setProfile((c) => ({ ...c, budget_range: budgetMarks[i] }));
                }}
              />
            )}

            {step.key === 'campus' && (
              <div className="glow-stack-sm">
                <div className="campus-panel relative mx-auto h-[360px] max-w-xl rounded-[2rem] border border-black/5 bg-white/80 shadow-[0_10px_24px_rgba(22,33,62,0.05)]">
                  <div className="campus-orb campus-orb-cyan" />
                  <div className="campus-orb campus-orb-fuchsia" />
                  <div className="campus-orb campus-orb-emerald" />
                  {vennZones.map((zone) => {
                    const selected = profile.campus_preferences === zone.label;
                    const isFlexible = zone.key === 'flexible';
                    return (
                      <button
                        key={zone.key}
                        type="button"
                        onClick={() => setProfile((current) => ({ ...current, campus_preferences: zone.label }))}
                        className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-3 py-2 text-center text-xs transition duration-300 ${
                          selected
                            ? 'border-sky-300 bg-sky-100 text-slate-900 shadow-[0_12px_24px_rgba(0,180,216,0.12)]'
                            : 'border-black/10 bg-white/90 text-slate-600 hover:border-sky-200 hover:text-slate-900'
                        } ${isFlexible ? 'h-20 w-20 border-dashed' : 'min-h-14 min-w-14'}`}
                        style={{ left: zone.x, top: zone.y }}
                      >
                        <span className="campus-zone-label leading-4">{zone.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="glow-selected-card" style={{ textAlign: 'center' }}>
                  <p className="glow-section-label">Current environment preference</p>
                  <p className="glow-panel-title" style={{ marginTop: '0.75rem', fontSize: '1.5rem' }}>{profile.campus_preferences || 'Choose a zone'}</p>
                </div>
              </div>
            )}

            {step.key === 'support' && (
              <div className="glow-wrap-row">
                {supportNeeds.map((need) => (
                  <Chip
                    key={need}
                    label={need}
                    selected={selectedSupportNeeds.includes(need)}
                    onClick={() => toggleSupportNeed(need)}
                  />
                ))}
              </div>
            )}

            {step.key === 'goals' && (
              <textarea
                className="field min-h-52"
                placeholder="What do you want your degree to unlock for you, personally or professionally?"
                value={profile.goals ?? ''}
                onChange={(event) => setProfile((current) => ({ ...current, goals: event.target.value }))}
              />
            )}
          </div>
        </div>

        <div className="border-t border-black/5 bg-white/88 px-7 py-5 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              className="glow-button-secondary"
              disabled={stepIndex === 0}
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => Math.min(onboardingSteps.length - 1, current + 1))}
                  className="glow-button-primary"
                >
                  Continue
                </button>
              ) : (
                <button
                  className="glow-button-primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Finish and save'}
                </button>
              )}
            </div>
          </div>
          {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
        </div>
      </section>
    </form>
  );

  function toggleArrayValue(field: 'target_subjects' | 'preferred_countries', value: string) {
    setProfile((current) => {
      const currentValues = current[field] || [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  }

  function toggleSupportNeed(value: string) {
    setProfile((current) => {
      const currentValues = (current.support_needs || '').split(', ').filter(Boolean);
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        support_needs: nextValues.join(', '),
      };
    });
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/72 p-4 shadow-[0_10px_24px_rgba(22,33,62,0.05)]">
      <p className="onboarding-metric-label text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SelectableCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border px-4 py-4 text-left transition duration-300 ${
        selected
          ? 'border-sky-300 bg-sky-50 text-slate-900 shadow-[0_10px_24px_rgba(0,180,216,0.12)]'
          : 'border-black/5 bg-white/85 text-slate-700 hover:-translate-y-0.5 hover:border-sky-200 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}

function StudyLevelCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const image = getStudyLevelImage(label);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`study-level-card grid min-h-[172px] w-full items-stretch overflow-hidden rounded-[1.75rem] border text-left transition duration-300 ${
        selected
          ? 'study-level-card-selected border-sky-300 bg-sky-50 text-slate-900'
          : 'border-black/5 bg-white/82 text-slate-700 shadow-[0_10px_24px_rgba(22,33,62,0.05)] hover:-translate-y-0.5 hover:border-sky-200 hover:text-slate-900'
      }`}
    >
      <div className="flex flex-col justify-center px-6 py-5">
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{label}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
      </div>
      <div className="relative min-h-[132px] overflow-hidden border-t border-black/5 sm:min-h-full sm:border-l sm:border-t-0 sm:border-black/5">
        <div className="absolute inset-0 bg-slate-100" />
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: image }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-900/20" />
        {selected && <div className="absolute inset-0 ring-2 ring-inset ring-sky-300/90" />}
      </div>
    </button>
  );
}

function getStudyLevelImage(label: string) {
  switch (label) {
    case 'Undergraduate':
      return 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(37,99,235,0.18)), url("https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80")';
    case 'Postgraduate':
      return 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(79,70,229,0.18)), url("https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80")';
    case 'PhD':
      return 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(8,145,178,0.18)), url("https://images.unsplash.com/photo-1503676382389-4809596d5290?auto=format&fit=crop&w=900&q=80")';
    default:
      return 'linear-gradient(135deg, rgba(30,41,59,0.35), rgba(15,23,42,0.35))';
  }
}

function getStudyLevelDescription(value: string) {
  switch (value) {
    case 'undergraduate':
      return 'You are looking for your first university degree, usually the step you take after school or college.';
    case 'postgraduate':
      return 'You already have a degree and want to keep building with a masters or another more advanced course.';
    case 'phd':
      return 'You want to go deep into research and follow a more specialised academic path around a focused topic.';
    default:
      return '';
  }
}

function SubjectFamilyCard({
  label,
  count,
  image,
  pulsing,
  onClick,
}: {
  label: string;
  count: number;
  image: string;
  pulsing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[260px] flex-col overflow-hidden rounded-[1.75rem] border bg-white/82 text-left transition duration-300 shadow-[0_10px_24px_rgba(22,33,62,0.05)] hover:-translate-y-0.5 hover:border-sky-200 hover:text-slate-900 ${
        pulsing
          ? 'subject-family-card-selected border-sky-300 subject-family-saved'
          : 'border-black/5'
      }`}
    >
      <div className="flex h-[92px] shrink-0 flex-col justify-center px-5 py-5">
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{label}</h3>
        <p className={`mt-2 text-sm ${count > 0 ? 'text-sky-600 font-medium' : 'text-slate-500'}`}>{count > 0 ? `${count} subject${count === 1 ? '' : 's'} selected` : 'No subjects selected yet'}</p>
      </div>
      <div className="relative min-h-0 flex-1 border-t border-black/5">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: image }} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-slate-900/18" />
      </div>
    </button>
  );
}

function SubjectPickerModal({
  family,
  selectedSubjects,
  onClose,
  onToggleSubject,
  onDone,
  open,
}: {
  family: { key: string; label: string; children: string[] };
  selectedSubjects: string[];
  onClose: () => void;
  onToggleSubject: (subject: string) => void;
  onDone: () => void;
  open: boolean;
}) {
  if (!open) return null;

  return (
    <div className="glow-modal-overlay">
      <div className="glow-modal-shell glow-modal-two-col subject-picker-modal" style={{ maxWidth: '80rem', height: 'min(82vh, 620px)' }}>
        <div className="glow-modal-hero">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: getSubjectFamilyImage(family.key) }} />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-900/35" />
          <div className="glow-modal-hero-content">
            <p className="onboarding-step-eyebrow text-sky-100">Choose subjects</p>
            <h3 className="mt-3 text-4xl font-semibold tracking-tight text-white">{family.label}</h3>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-200/85">
              Pick every subject that genuinely fits. You can choose one, a few, or build a whole cluster.
            </p>
          </div>
        </div>
        <div className="flex h-full min-h-0 flex-col">
          <div className="glow-modal-header">
            <div>
              <p className="onboarding-step-eyebrow text-sky-500 md:hidden">Choose subjects</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-900 md:hidden">{family.label}</h3>
              <p className="text-sm text-slate-500">{selectedSubjects.filter((subject) => family.children.includes(subject)).length} selected in this area</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="glow-button-secondary"
            >
              Done
            </button>
          </div>
          <div className="glow-modal-body">
            <div className="glow-wrap-row">
              {family.children.map((subject) => (
                <Chip
                  key={subject}
                  label={subject}
                  selected={selectedSubjects.includes(subject)}
                  onClick={() => onToggleSubject(subject)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSubjectFamilyImage(key: string) {
  switch (key) {
    case 'technology':
      return 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(37,99,235,0.18)), url("https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80")';
    case 'engineering':
      return 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(8,145,178,0.18)), url("https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=900&q=80")';
    case 'business':
      return 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(180,83,9,0.18)), url("https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80")';
    case 'arts':
      return 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(79,70,229,0.18)), url("https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80")';
    case 'social':
      return 'linear-gradient(135deg, rgba(244,63,94,0.18), rgba(236,72,153,0.18)), url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80")';
    case 'health':
      return 'linear-gradient(135deg, rgba(45,212,191,0.18), rgba(14,165,233,0.18)), url("https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80")';
    default:
      return 'linear-gradient(135deg, rgba(30,41,59,0.35), rgba(15,23,42,0.35))';
  }
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glow-chip ${selected ? 'glow-chip-selected' : ''}`}
    >
      {label}
    </button>
  );
}

const budgetTiers = [
  {
    label: 'Under $15k',
    sublabel: 'Lean',
    description: 'Scholarship-focused. Lower-cost countries and institutions.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.35)',
    bg: 'rgba(6,182,212,0.08)',
    border: 'rgba(6,182,212,0.25)',
    maxValue: 15000,
    image: 'url("https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80")',
  },
  {
    label: 'Up to $25k',
    sublabel: 'Balanced',
    description: 'Strong options across most destinations with smart choices.',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.35)',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    maxValue: 25000,
    image: 'url("https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=900&q=80")',
  },
  {
    label: 'Up to $50k',
    sublabel: 'Comfortable',
    description: 'Wide range of universities including premium destinations.',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.35)',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    maxValue: 40000,
    image: 'url("https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80")',
  },
  {
    label: '$50k+',
    sublabel: 'Open',
    description: 'Full flexibility. Elite institutions and any country.',
    color: '#ff4d8c',
    glow: 'rgba(255,77,140,0.35)',
    bg: 'rgba(255,77,140,0.08)',
    border: 'rgba(255,77,140,0.25)',
    maxValue: 50000,
    image: 'url("https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?auto=format&fit=crop&w=900&q=80")',
  },
];

// Slider is 0–300 continuous. Maps to $0–$50k.
const SLIDER_MAX = 300;
function sliderToGbp(v: number) { return Math.round((v / SLIDER_MAX) * 50000 / 100) * 100; }
function tierIndexFromSlider(v: number) {
  const gbp = sliderToGbp(v);
  if (gbp < 15000) return 0;
  if (gbp < 25000) return 1;
  if (gbp < 50000) return 2;
  return 3;
}
function tierIndexToSlider(i: number) {
  const midpoints = [7500, 20000, 37500, 50000];
  return Math.round((midpoints[i] / 50000) * SLIDER_MAX);
}

function BudgetSlider({ budgetIndex, onChange }: { budgetIndex: number; onChange: (i: number) => void }) {
  const [sliderVal, setSliderVal] = useState(() => tierIndexToSlider(budgetIndex));
  const tierIdx = tierIndexFromSlider(sliderVal);
  const tier = budgetTiers[tierIdx];
  const pct = (sliderVal / SLIDER_MAX) * 100;
  const gbp = sliderToGbp(sliderVal);

  // Sync if parent changes (e.g. initial load)
  useEffect(() => {
    setSliderVal(tierIndexToSlider(budgetIndex));
  }, [budgetIndex]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setSliderVal(v);
    onChange(tierIndexFromSlider(v));
  }

  function jumpToTier(i: number) {
    const v = tierIndexToSlider(i);
    setSliderVal(v);
    onChange(i);
  }

  return (
    <div className="flex h-full flex-col justify-center gap-6 py-2">

      {/* Hero card */}
      <div
        className="relative overflow-hidden rounded-3xl transition-all duration-500"
        style={{ border: `1px solid ${tier.border}` }}
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{ backgroundImage: tier.image }}
        />
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{ background: `linear-gradient(135deg, ${tier.bg.replace('0.08', '0.82')}, ${tier.bg.replace('0.08', '0.65')})` }}
        />
        {/* Inner glow */}
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-500"
          style={{ boxShadow: `inset 0 0 80px ${tier.glow}` }}
        />

        <div className="relative p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Annual tuition budget</p>
            <p
              className="mt-2 font-bold tracking-tight text-white transition-all duration-100"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', textShadow: `0 0 30px ${tier.glow}` }}
            >
              {gbp >= 50000 ? '$50k+' : '$' + gbp.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-white/70">{tier.description}</p>
          </div>

        </div>

        {/* Progress bar inside card */}
        <div className="relative mx-7 mb-6 h-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-75"
            style={{ width: `${pct}%`, background: 'white', boxShadow: '0 0 8px rgba(255,255,255,0.6)' }}
          />
        </div>
      </div>

      {/* Slider */}
      <div className="relative px-1 py-3">
        {/* Gradient track */}
        <div
          className="h-2 w-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #f59e0b, #ff4d8c)' }}
        />
        {/* Greyed-out overlay for unselected portion */}
        <div
          className="absolute right-1 top-3 h-2 rounded-r-full bg-slate-200/80 transition-all duration-75"
          style={{ left: `calc(${pct}% + 4px)` }}
        />

        {/* Native range */}
        <input
          type="range"
          min={0}
          max={SLIDER_MAX}
          step={1}
          value={sliderVal}
          onChange={handleChange}
          className="budget-range-input absolute inset-x-0 top-1/2 h-8 w-full -translate-y-1/2 cursor-pointer opacity-0"
          style={{ zIndex: 2 }}
        />

        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-75"
          style={{ left: `${pct}%` }}
        >
          <div
            className="h-6 w-6 rounded-full border-[3px] border-white shadow-xl transition-[background,box-shadow] duration-300"
            style={{ background: tier.color, boxShadow: `0 0 0 3px ${tier.border}, 0 4px 16px ${tier.glow}` }}
          />
        </div>

        {/* Tier boundary markers */}
        {[15000, 25000, 50000].map((v) => {
          const markerPct = (v / 50000) * 100;
          return (
            <div
              key={v}
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${markerPct}%` }}
            >
              <div className="h-3 w-0.5 rounded-full bg-white/60" />
            </div>
          );
        })}
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-4 gap-2">
        {budgetTiers.map((t, i) => {
          const active = i === tierIdx;
          return (
            <button
              key={i}
              type="button"
              onClick={() => jumpToTier(i)}
              className="group relative overflow-hidden rounded-2xl border transition-all duration-300"
              style={{
                border: `1px solid ${active ? t.border : 'rgba(0,0,0,0.06)'}`,
                boxShadow: active ? `0 8px 24px ${t.glow}` : 'none',
                transform: active ? 'translateY(-2px)' : 'none',
              }}
            >
              {/* Image */}
              <div
                className="h-16 w-full bg-cover bg-center transition-all duration-300"
                style={{ backgroundImage: t.image }}
              />
              <div
                className="absolute inset-0 top-0 h-16 transition-all duration-300"
                style={{ background: active ? `${t.bg.replace('0.08', '0.45')}` : 'rgba(255,255,255,0.1)' }}
              />
              <div className="relative px-2 py-2 text-center">
                <p
                  className="text-xs font-bold transition-colors duration-200"
                  style={{ color: active ? t.color : 'rgb(148 163 184)' }}
                >
                  {t.sublabel}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{t.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BudgetMoodCard({
  title,
  description,
  active,
}: {
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 transition-all duration-300 ${
        active
          ? 'budget-mood-card-active border-pink-200 bg-pink-50 text-slate-900'
          : 'border-black/5 bg-white/78 text-slate-700'
      }`}
    >
      <p className="text-sm font-semibold tracking-wide text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
