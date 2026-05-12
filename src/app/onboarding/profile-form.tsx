'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

const MiniGlobe = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false, loading: () => <div className="h-[200px] w-[200px]" /> },
);

type Props = {
  initialProfile?: StudentProfile | null;
  isSignedIn: boolean;
};

const ONBOARDING_DRAFT_KEY = 'glowbal-onboarding-draft';

type OnboardingDraft = {
  profile: StudentProfile;
  stepIndex: number;
};

function loadDraft(): OnboardingDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

function buildInitialProfile(initialProfile?: StudentProfile | null, draftProfile?: StudentProfile | null): StudentProfile {
  return {
    study_level: draftProfile?.study_level ?? initialProfile?.study_level ?? '',
    target_subjects: draftProfile?.target_subjects ?? initialProfile?.target_subjects ?? [],
    preferred_countries: draftProfile?.preferred_countries ?? initialProfile?.preferred_countries ?? [],
    budget_range: draftProfile?.budget_range ?? initialProfile?.budget_range ?? budgetMarks[1],
    academic_background: draftProfile?.academic_background ?? initialProfile?.academic_background ?? '',
    goals: draftProfile?.goals ?? initialProfile?.goals ?? '',
    career_interests: draftProfile?.career_interests ?? initialProfile?.career_interests ?? [],
    campus_preferences: draftProfile?.campus_preferences ?? initialProfile?.campus_preferences ?? '',
    support_needs: draftProfile?.support_needs ?? initialProfile?.support_needs ?? '',
  };
}

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

export function OnboardingForm({ initialProfile, isSignedIn }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const initialState = buildInitialProfile(initialProfile, null);
  const [profile, setProfile] = useState<StudentProfile>(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeFamily, setActiveFamily] = useState('');
  const [pulsingFamily, setPulsingFamily] = useState<string | null>(null);
  const [budgetIndex, setBudgetIndex] = useState(
    Math.max(budgetMarks.indexOf(initialState.budget_range || budgetMarks[1]), 0),
  );

  const step = onboardingSteps[stepIndex];
  const activeSubjectFamily = subjectFamilies.find((family) => family.key === activeFamily) ?? subjectFamilies[0];
  const selectedSupportNeeds = (profile.support_needs || '').split(', ').filter(Boolean);
  const selectedSubjects = profile.target_subjects || [];
  const selectedCountries = profile.preferred_countries || [];

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;

    const restoredProfile = buildInitialProfile(initialProfile, draft.profile);
    const restoredStepIndex = Math.max(0, Math.min(draft.stepIndex, onboardingSteps.length - 1));
    const restoredBudgetIndex = Math.max(
      budgetMarks.indexOf(restoredProfile.budget_range || budgetMarks[1]),
      0,
    );

    const frame = window.requestAnimationFrame(() => {
      setProfile(restoredProfile);
      setStepIndex(restoredStepIndex);
      setBudgetIndex(restoredBudgetIndex);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialProfile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!isSignedIn) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          ONBOARDING_DRAFT_KEY,
          JSON.stringify({ profile, stepIndex }),
        );
      }
      router.push(`/auth?redirect=${encodeURIComponent('/onboarding?complete=1')}`);
      setLoading(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in so we can save your profile.');
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
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('student_profiles').upsert(payload, {
      onConflict: 'user_id',
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    }

    router.push('/onboarding/documents');
    router.refresh();
  };

  const isLastStep = stepIndex === onboardingSteps.length - 1;

  useEffect(() => {
    if (!pulsingFamily) return;
    const timeout = setTimeout(() => setPulsingFamily(null), 900);
    return () => clearTimeout(timeout);
  }, [pulsingFamily]);

  return (
    <form className="onboarding-card-shell w-full max-w-3xl" onSubmit={handleSubmit}>
      {/* Card container */}
      <div className="onboarding-question-card relative overflow-hidden rounded-[2rem] border border-black/5 bg-white/95 shadow-[0_20px_60px_rgba(22,33,62,0.10)] backdrop-blur-xl">
        {/* Intro text */}
        <div className="border-b border-black/5 px-6 pb-4 pt-6 text-center md:px-10 md:pt-8">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-[var(--glowbal-pink)]">It&apos;s simple!</span> Let us know more about you. Then we will match you with your best global opportunity!
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-5 md:px-10">
          <div className="relative h-10 w-full overflow-hidden rounded-full bg-gradient-to-r from-[var(--glowbal-pink)] to-[var(--glowbal-pink-light)] shadow-md">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                Question {stepIndex + 1}/{onboardingSteps.length}
              </span>
            </div>
          </div>
        </div>

        {/* Question title */}
        <div className="px-6 pt-5 text-center md:px-10">
          <h2 className="text-xl font-bold text-slate-900 md:text-2xl">{step.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{step.description}</p>
        </div>

        {/* Question content */}
        <div className="min-h-[260px] px-6 py-6 md:px-10">
          {step.key === 'study_level' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {studyLevels.map((level) => (
                <OptionButton
                  key={level.value}
                  label={level.label}
                  selected={profile.study_level === level.value}
                  onClick={() => setProfile((c) => ({ ...c, study_level: level.value }))}
                />
              ))}
            </div>
          )}

          {step.key === 'subjects' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {subjectFamilies.map((family) => {
                  const count = family.children.filter((s) => selectedSubjects.includes(s)).length;
                  return (
                    <OptionButton
                      key={family.key}
                      label={family.label}
                      selected={count > 0}
                      badge={count > 0 ? String(count) : undefined}
                      onClick={() => setActiveFamily(family.key)}
                    />
                  );
                })}
              </div>

              {selectedSubjects.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-600">Selected subjects</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map((subject) => (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleArrayValue('target_subjects', subject)}
                        className="glow-chip glow-chip-selected text-xs"
                      >
                        <span>{subject}</span>
                        <span className="ml-1 text-slate-400">✕</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <SubjectPickerModal
                family={activeSubjectFamily}
                selectedSubjects={selectedSubjects}
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
            <div className="space-y-4">
              <GlobeCountryPicker
                regions={regions}
                selectedCountries={selectedCountries}
                onToggleCountry={(country) => toggleArrayValue('preferred_countries', country)}
              />
              {selectedCountries.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-600">Selected countries</p>
                  <div className="flex flex-wrap gap-2">
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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {budgetMarks.map((mark, i) => (
                <OptionButton
                  key={mark}
                  label={mark}
                  selected={budgetIndex === i}
                  onClick={() => {
                    setBudgetIndex(i);
                    setProfile((c) => ({ ...c, budget_range: budgetMarks[i] }));
                  }}
                />
              ))}
            </div>
          )}

          {step.key === 'campus' && (
            <div className="relative mx-auto h-[300px] max-w-md rounded-[2rem] border border-black/5 bg-white/80 shadow-sm">
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
                    onClick={() => setProfile((c) => ({ ...c, campus_preferences: zone.label }))}
                    className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border px-3 py-2 text-center text-xs transition duration-300 ${
                      selected
                        ? 'border-[var(--glowbal-mint)] bg-cyan-50 text-slate-900 shadow-md'
                        : 'border-black/10 bg-white/90 text-slate-600 hover:border-sky-200 hover:text-slate-900'
                    } ${isFlexible ? 'h-20 w-20 border-dashed' : 'min-h-14 min-w-14'}`}
                    style={{ left: zone.x, top: zone.y }}
                  >
                    <span className="campus-zone-label leading-4">{zone.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step.key === 'support' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {supportNeeds.map((need) => (
                <OptionButton
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
              className="field min-h-44 w-full"
              placeholder="What do you want your degree to unlock for you, personally or professionally?"
              value={profile.goals ?? ''}
              onChange={(e) => setProfile((c) => ({ ...c, goals: e.target.value }))}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-black/5 px-6 py-4 md:px-10">
          <button
            type="button"
            onClick={() => setStepIndex((c) => Math.max(0, c - 1))}
            disabled={stepIndex === 0}
            className="onboarding-nav-btn onboarding-nav-btn-back"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStepIndex((c) => Math.min(onboardingSteps.length - 1, c + 1))}
              className="onboarding-nav-btn onboarding-nav-btn-next"
            >
              Next Question
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              className="onboarding-nav-btn onboarding-nav-btn-next"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Saving...' : isSignedIn ? 'Save and continue' : 'Sign up to save your matches'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {!isSignedIn && isLastStep && (
          <div className="border-t border-black/5 px-6 py-4 text-center md:px-10">
            <p className="text-sm text-slate-500">
              You can search freely without an account. To save this quiz and unlock personalised matches, sign up on the final step.
            </p>
          </div>
        )}

        {message && <p className="px-6 pb-4 text-center text-sm text-slate-600">{message}</p>}
      </div>

      {/* Mini globe decoration below card */}
      <div className="mt-6 flex justify-center opacity-60">
        <MiniGlobe theme="journey" size={120} rotateSpeed={0.3} />
      </div>
    </form>
  );

  function toggleArrayValue(field: 'target_subjects' | 'preferred_countries', value: string) {
    setProfile((current) => {
      const currentValues = current[field] || [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return { ...current, [field]: nextValues };
    });
  }

  function toggleSupportNeed(value: string) {
    setProfile((current) => {
      const currentValues = (current.support_needs || '').split(', ').filter(Boolean);
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return { ...current, support_needs: nextValues.join(', ') };
    });
  }
}

/* ── Option Button (matches the rounded pill design) ─────────────────── */

function OptionButton({
  label,
  selected,
  onClick,
  badge,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`onboarding-option-btn ${selected ? 'onboarding-option-btn-selected' : ''}`}
    >
      <span>{label}</span>
      {badge && (
        <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--glowbal-mint)] text-[0.6rem] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────── */

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

/* ── Subject Picker Modal ─────────────────────────────────────────────── */

function SubjectPickerModal({
  family,
  selectedSubjects,
  onToggleSubject,
  onDone,
  open,
}: {
  family: { key: string; label: string; children: string[] };
  selectedSubjects: string[];
  onToggleSubject: (subject: string) => void;
  onDone: () => void;
  open: boolean;
}) {
  if (!open) return null;

  return (
    <div className="glow-modal-overlay">
      <div className="glow-modal-shell flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden">
        <div className="glow-modal-header">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{family.label}</h3>
            <p className="text-sm text-slate-500">
              {selectedSubjects.filter((s) => family.children.includes(s)).length} selected in this area
            </p>
          </div>
          <button type="button" onClick={onDone} className="glow-button-secondary">
            Done
          </button>
        </div>
        <div className="glow-modal-body">
          <div className="flex flex-wrap gap-2">
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
  );
}
