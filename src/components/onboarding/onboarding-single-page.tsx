'use client';

/**
 * GLOWBAL — single-page onboarding form.
 *
 * Replaces the step-by-step quiz with one long scrollable form so the
 * user can see the whole experience at a glance. Every question is on
 * the same page; users scroll past them like any web form. The form is
 * always skippable — there is a persistent "Skip to search" button at
 * the top, and the search page has an "Improve your searches" pill that
 * brings them back here whenever they're ready.
 *
 * Branding notes:
 *  - The hero strip uses the same pink → cyan gradient as the rest of
 *    the product so the onboarding feels native (no more dark hero).
 *  - The globe is the "marble" (Earth-coloured) variant; the only dark
 *    cosmos globe lives on the home page.
 *  - When the user arrives from /universities (`?from=search`) we show
 *    a contextual banner explaining that filling answers makes the
 *    search more accurate.
 */

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  studyLevels,
  subjectFamilies,
  supportNeeds,
} from '@/lib/onboarding-options';
import { useT } from '@/lib/i18n';
import type { StudentProfile } from '@/lib/types';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

const LightGlobe = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-pink-50/40" /> },
);

const ONBOARDING_DRAFT_KEY = 'glowbal-onboarding-draft';
const ONBOARDING_SKIP_KEY = 'glowbal-onboarding-skipped';

const budgetOptions = ['Under $15k', 'Up to $25k', 'Up to $50k', '$50k+'];
const campusOptions = ['Big city', 'Campus town', 'Quiet / green', 'Flexible'];
const regionOptions = [
  { label: 'UK & Ireland', hint: 'United Kingdom, Ireland' },
  { label: 'Europe', hint: 'Germany, France, Netherlands' },
  { label: 'North America', hint: 'United States, Canada' },
  { label: 'Asia-Pacific', hint: 'Singapore, Australia, Japan' },
  { label: 'Middle East', hint: 'UAE, Qatar' },
  { label: 'Open to ideas', hint: 'Show best-fit places first' },
];

// Every question is single-choice: the user picks their best option (and can
// revisit onboarding later to try different answers).
type Answers = {
  study_level: string;
  subjects: string;
  countries: string;
  budget: string;
  campus: string;
  support: string;
  goals: string;
};

const EMPTY_ANSWERS: Answers = {
  study_level: '',
  subjects: '',
  countries: '',
  budget: '',
  campus: '',
  support: '',
  goals: '',
};

function buildInitialAnswers(initialProfile?: StudentProfile | null): Answers {
  if (!initialProfile) return { ...EMPTY_ANSWERS };

  // Reverse-map the saved profile back into the question shape so users
  // see their previous answers when they revisit onboarding. Stored values may
  // be comma-joined from older data, so take the first option for each.
  const firstSupport = (initialProfile.support_needs || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const firstSubject = initialProfile.target_subjects?.[0] || '';
  const firstStudyLevel = (initialProfile.study_level || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const firstCampus = (initialProfile.campus_preferences || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';

  const preferredCountries = initialProfile.preferred_countries || [];
  let region = '';
  if (preferredCountries.length) {
    if (preferredCountries.some((c) => ['United Kingdom', 'Ireland'].includes(c))) region = 'UK & Ireland';
    else if (preferredCountries.some((c) => ['United States', 'Canada'].includes(c))) region = 'North America';
    else if (preferredCountries.some((c) => ['Singapore', 'Australia', 'New Zealand', 'Japan', 'South Korea', 'Hong Kong'].includes(c))) region = 'Asia-Pacific';
    else if (preferredCountries.some((c) => ['United Arab Emirates', 'Qatar'].includes(c))) region = 'Middle East';
    else region = 'Europe';
  }

  return {
    study_level: firstStudyLevel,
    subjects: firstSubject,
    countries: region,
    budget: initialProfile.budget_range || '',
    campus: firstCampus,
    support: firstSupport,
    goals: initialProfile.goals || '',
  };
}

function mapRegionToCountries(region: string): string[] {
  switch (region) {
    case 'UK & Ireland': return ['United Kingdom', 'Ireland'];
    case 'Europe': return ['Netherlands', 'Germany', 'France', 'Sweden', 'Switzerland', 'Spain', 'Italy'];
    case 'North America': return ['United States', 'Canada'];
    case 'Asia-Pacific': return ['Singapore', 'Australia', 'New Zealand', 'Japan', 'South Korea', 'Hong Kong'];
    case 'Middle East': return ['United Arab Emirates', 'Qatar'];
    default: return [];
  }
}

function answersToProfile(a: Answers): StudentProfile {
  return {
    study_level: a.study_level || null,
    target_subjects: a.subjects ? [a.subjects] : [],
    preferred_countries: mapRegionToCountries(a.countries),
    budget_range: a.budget || null,
    goals: a.goals || null,
    career_interests: a.subjects ? [a.subjects] : [],
    campus_preferences: a.campus || null,
    support_needs: a.support || null,
  };
}

// ── Question scaffold ─────────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'study_level', n: 1, title: 'What level are you aiming for?',         body: 'Start with the path you are actually planning now.' },
  { key: 'subjects',    n: 2, title: 'Which subject worlds pull you in?',      body: 'Pick the broad theme — you can refine specific courses later.' },
  { key: 'countries',   n: 3, title: 'Which parts of the world feel right?',   body: 'Think globally, then narrow it down to places that excite you.' },
  { key: 'budget',      n: 4, title: 'What budget feels realistic?',           body: 'A strong shortlist should be ambitious, but still within reach.' },
  { key: 'campus',      n: 5, title: 'What kind of environment suits you?',    body: 'Course fit matters, but so does where you will actually live.' },
  { key: 'support',     n: 6, title: 'Where do you most want support?',        body: 'No judgement — pick the area where guidance would help most.' },
  { key: 'goals',       n: 7, title: 'What kind of future are you building?',  body: 'Speak in your own words — even one sentence helps us match you.' },
] as const;

const goalIdeas = [
  'Build a global AI career with strong scholarship support.',
  'Study computer science abroad and launch a startup one day.',
  'Find a university that opens doors into product and innovation.',
  'Move into a big international city and grow my confidence.',
  'Get a practical degree that leads to strong job options worldwide.',
];

// ── Component ────────────────────────────────────────────────────────────

export function OnboardingSinglePage({
  initialProfile = null,
  isSignedIn = false,
}: {
  initialProfile?: StudentProfile | null;
  isSignedIn?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const searchParams = useSearchParams();
  const fromSearch = searchParams.get('from') === 'search';

  const supabase = useMemo(() => createClient(), []);

  /**
   * Read any in-progress answers out of localStorage *during* state init
   * so we don't trigger a cascading re-render on mount. We only restore
   * fields that the saved profile didn't already populate.
   */
  const [answers, setAnswers] = useState<Answers>(() => {
    const base = buildInitialAnswers(initialProfile);
    if (typeof window === 'undefined') return base;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as { answers?: Answers };
      if (!parsed.answers) return base;
      const merged = { ...base };
      for (const k of Object.keys(EMPTY_ANSWERS) as Array<keyof Answers>) {
        if (!merged[k] && parsed.answers[k]) merged[k] = parsed.answers[k];
      }
      return merged;
    } catch {
      return base;
    }
  });
  const [submitting, setSubmitting] = useState(false);
  useLoadingIndicator(submitting, 'Building your profile');
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep a draft in localStorage as the user fills the form so they don't
  // lose answers on refresh or when bouncing through the auth flow.
  useEffect(() => {
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
    } catch {
      // ignore
    }
  }, [answers]);

  // Computed completion (out of 7)
  const completed = useMemo(() => {
    return (Object.values(answers) as string[]).filter((v) => v && v.trim().length > 0).length;
  }, [answers]);

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((p) => ({ ...p, [key]: value }));
  }

  function skip() {
    try {
      window.sessionStorage.setItem(ONBOARDING_SKIP_KEY, '1');
      window.localStorage.setItem('glowbal-search-visited', '1');
    } catch {
      // ignore
    }
    router.push('/universities');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    if (!isSignedIn) {
      // Save answers to draft and bounce to auth, returning here on completion.
      try {
        window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
      } catch {
        // ignore
      }
      router.push(`/auth?redirect=${encodeURIComponent('/onboarding?complete=1')}`);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMessage('Please sign in so we can save your profile.');
      setSubmitting(false);
      return;
    }

    const profile = answersToProfile(answers);
    const payload = {
      user_id: userData.user.id,
      study_level: profile.study_level,
      target_subjects: profile.target_subjects,
      preferred_countries: profile.preferred_countries,
      budget_range: profile.budget_range,
      academic_background: null,
      goals: profile.goals,
      career_interests: profile.career_interests,
      campus_preferences: profile.campus_preferences,
      support_needs: profile.support_needs,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('student_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    try {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      // ignore
    }

    router.push('/universities');
  }

  return (
    // Localised explicitly via t() below, so opt out of the DOM auto-translator.
    <div className="relative min-h-screen overflow-hidden" data-no-auto-translate>
      {/* Soft brand background — same pink/aqua wash as the rest of the site */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(255,77,140,0.08), transparent 35%), radial-gradient(ellipse at 85% 12%, rgba(0,194,255,0.10), transparent 30%), linear-gradient(180deg, #F5F6FF 0%, #ffffff 80%)',
        }}
      />

      {/* Decorative globe pinned in the top-right of the hero */}
      <div aria-hidden className="pointer-events-none absolute right-[-120px] top-[-60px] hidden lg:block">
        <div className="h-[420px] w-[420px] opacity-80">
          <LightGlobe theme="marble" responsive rotateSpeed={0.4} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        {/* ── Hero ────────────────────────────────────────────── */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-pink-600">
              {t('GLOWBAL · onboarding')}
            </span>
            <button
              type="button"
              onClick={skip}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-pink-600 transition"
            >
              {t('Skip to search')}
              <span aria-hidden>→</span>
            </button>
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900 md:text-5xl">
            {t("Tell us about you. We'll do the rest.")}
          </h1>

          {fromSearch ? (
            <div className="mt-5 rounded-2xl border border-pink-100 bg-pink-50/60 p-4 text-sm text-slate-700">
              <p className="font-semibold text-pink-700">
                {t('A 60-second detour will sharpen your search.')}
              </p>
              <p className="mt-1 leading-relaxed">
                {t('Filling in these questions lets')} <span className="glowbal-wordmark">GLOWBAL</span>{' '}
                {t('rank universities by how well they fit your subject, budget, country preference, and goals. You can skip any time — your search will just be more generic until you do.')}
              </p>
            </div>
          ) : (
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {t("Seven short questions. They tune the matcher so the universities you see actually fit you. Skip any you're not sure about — every answer makes the search better, none are required.")}
            </p>
          )}

          {/* Progress strip */}
          <div className="mt-6 flex items-center gap-3" aria-label="onboarding progress">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[linear-gradient(90deg,#FF3D9A,#00C2FF)] transition-all duration-500"
                style={{ width: `${(completed / QUESTIONS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {completed}/{QUESTIONS.length}
            </span>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────── */}
        <form ref={formRef} onSubmit={submit} className="mt-10 space-y-8">

          {/* Q1 — study level */}
          <QuestionCard q={QUESTIONS[0]} answered={!!answers.study_level}>
            <div className="grid gap-3 sm:grid-cols-3">
              {studyLevels.map((level) => (
                <Choice
                  key={level.value}
                  label={level.label}
                  selected={answers.study_level === level.value}
                  onClick={() => update('study_level', level.value)}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q2 — subject worlds */}
          <QuestionCard q={QUESTIONS[1]} answered={!!answers.subjects}>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {subjectFamilies.map((family) => (
                <Choice
                  key={family.key}
                  label={family.label}
                  hint={family.children.slice(0, 2).map((c) => t(c)).join(' · ')}
                  selected={answers.subjects === family.children[0]}
                  onClick={() => update('subjects', family.children[0])}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q3 — region */}
          <QuestionCard q={QUESTIONS[2]} answered={!!answers.countries}>
            <div className="grid gap-3 sm:grid-cols-2">
              {regionOptions.map((region) => (
                <Choice
                  key={region.label}
                  label={region.label}
                  hint={region.hint}
                  selected={answers.countries === region.label}
                  onClick={() => update('countries', region.label)}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q4 — budget */}
          <QuestionCard q={QUESTIONS[3]} answered={!!answers.budget}>
            <div className="grid gap-3 sm:grid-cols-4">
              {budgetOptions.map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={answers.budget === option}
                  onClick={() => update('budget', option)}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q5 — campus */}
          <QuestionCard q={QUESTIONS[4]} answered={!!answers.campus}>
            <div className="grid gap-3 sm:grid-cols-4">
              {campusOptions.map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={answers.campus === option}
                  onClick={() => update('campus', option)}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q6 — support */}
          <QuestionCard q={QUESTIONS[5]} answered={!!answers.support}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {supportNeeds.map((need) => (
                <Choice
                  key={need}
                  label={need}
                  selected={answers.support === need}
                  onClick={() => update('support', need)}
                />
              ))}
            </div>
          </QuestionCard>

          {/* Q7 — goals */}
          <QuestionCard q={QUESTIONS[6]} answered={!!answers.goals}>
            <textarea
              value={answers.goals}
              onChange={(e) => update('goals', e.target.value)}
              placeholder={t("A sentence or two about the future you're building toward.")}
              className="min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 shadow-sm outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-100"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {goalIdeas.map((idea) => {
                // Display + insert the Vietnamese version so the textarea matches
                // what the user clicked (goals is free-text, so storing VI is fine).
                const label = t(idea);
                return (
                  <button
                    type="button"
                    key={idea}
                    onClick={() => update('goals', label)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:border-pink-200 hover:text-pink-600 transition"
                  >
                    {label.slice(0, 60)}{label.length > 60 ? '…' : ''}
                  </button>
                );
              })}
            </div>
          </QuestionCard>

          {/* ── Submit / skip ──────────────────────────────────── */}
          <div className="sticky bottom-4 z-20">
            <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3 flex flex-wrap items-center gap-3 shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
              <p className="text-sm text-slate-600 flex-1 min-w-[180px]">
                {completed === 0
                  ? t('Pick at least one answer to save a personalised match.')
                  : completed < QUESTIONS.length
                    ? t('Looking great — {completed}/{total} answered.', { completed, total: QUESTIONS.length })
                    : t('All set. Save your profile to unlock matches.')}
              </p>
              <button
                type="button"
                onClick={skip}
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300"
              >
                {t('Skip for now')}
              </button>
              <button
                type="submit"
                disabled={submitting || completed === 0}
                className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition hover:-translate-y-0.5"
              >
                {submitting ? t('Saving…') : isSignedIn ? t('Save & see matches') : t('Sign in & save')}
              </button>
            </div>
          </div>

          {message ? (
            <p className="text-center text-sm text-pink-600">{t(message)}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function QuestionCard({
  q,
  answered,
  children,
}: {
  q: typeof QUESTIONS[number];
  answered: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section
      id={`q-${q.key}`}
      className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-6 md:p-8 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
    >
      <header className="flex items-center gap-3 mb-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
            answered
              ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-md'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {answered ? '✓' : q.n}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{t(q.title)}</h2>
      </header>
      <p className="ml-10 mb-5 text-sm text-slate-600 leading-relaxed">{t(q.body)}</p>
      <div className="ml-10">{children}</div>
    </section>
  );
}

function Choice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left rounded-2xl border px-4 py-3 transition duration-200 hover:-translate-y-0.5 ${
        selected
          ? 'border-pink-300 bg-pink-50/70 text-slate-900 shadow-[0_8px_22px_rgba(255,77,140,0.15)]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200 hover:bg-pink-50/40'
      }`}
    >
      <div className="font-semibold tracking-tight">{t(label)}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{t(hint)}</div> : null}
    </button>
  );
}
