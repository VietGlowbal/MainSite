'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { MARKETING_NAV_ITEMS } from '@/features/marketing/ui';
import { Button, Textarea, TopNav } from '@/shared/ui';
import { createClient } from '@/lib/supabase/client';
import { studyLevels, subjectFamilies, supportNeeds } from '@/lib/onboarding-options';
import { useT } from '@/lib/i18n';
import type { StudentProfile } from '@/lib/types';

/**
 * /onboarding — rebuilt from Figma câu 1–9 ("Lập kế hoạch du học").
 *
 * The redesign turns the single scrollable form into a stepped wizard: one
 * question per screen, a segmented progress bar, and a "Tiếp tục" button. The
 * globe is dropped.
 *
 * Scope decision (2026-07-25): this reuses the EXISTING seven-question model
 * wired to `student_profiles`, presented in the new stepped pattern. The Figma's
 * extra steps — notably the academic-awards capture (câu 8: Level / Role / Prize
 * / Year) — collect data with no column in `student_profiles` and overlap the
 * /ai-strategy "Detailed Achievements" input, so they are deliberately NOT built
 * here; they belong to that flow and a schema decision. Everything below keeps
 * the exact save / guest-bounce / draft / skip behaviour of the old form.
 */

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
const goalIdeas = [
  'Build a global AI career with strong scholarship support.',
  'Study computer science abroad and launch a startup one day.',
  'Find a university that opens doors into product and innovation.',
  'Move into a big international city and grow my confidence.',
  'Get a practical degree that leads to strong job options worldwide.',
];

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

// ── Profile <-> answers mapping (unchanged from the old single-page form) ────

function buildInitialAnswers(initialProfile?: StudentProfile | null): Answers {
  if (!initialProfile) return { ...EMPTY_ANSWERS };
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

// ── Step definitions ─────────────────────────────────────────────────────────

type StepKey = keyof Answers;
const STEPS: { key: StepKey; title: string; body: string }[] = [
  { key: 'study_level', title: 'What level are you aiming for?', body: 'Start with the path you are actually planning now.' },
  { key: 'subjects', title: 'Which subject worlds pull you in?', body: 'Pick the broad theme — you can refine specific courses later.' },
  { key: 'countries', title: 'Which parts of the world feel right?', body: 'Think globally, then narrow it down to places that excite you.' },
  { key: 'budget', title: 'What budget feels realistic?', body: 'A strong shortlist should be ambitious, but still within reach.' },
  { key: 'campus', title: 'What kind of environment suits you?', body: 'Course fit matters, but so does where you will actually live.' },
  { key: 'support', title: 'Where do you most want support?', body: 'No judgement — pick the area where guidance would help most.' },
  { key: 'goals', title: 'What kind of future are you building?', body: 'Speak in your own words — even one sentence helps us match you.' },
];

// ── Selectable option ────────────────────────────────────────────────────────

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
      className={`flex flex-col gap-gb-xxs rounded-gb-md border px-gb-xl py-gb-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected
          ? 'border-brand bg-brand-subtle text-fg'
          : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
      }`}
    >
      <span className="text-gb-md font-semibold">{t(label)}</span>
      {hint ? <span className="text-gb-sm text-fg-muted">{t(hint)}</span> : null}
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingWizard({
  initialProfile = null,
  isSignedIn = false,
  userName = null,
  userAvatarUrl = null,
}: {
  initialProfile?: StudentProfile | null;
  isSignedIn?: boolean;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  const router = useRouter();
  const t = useT();
  const supabase = useMemo(() => createClient(), []);

  const [answers, setAnswers] = useState<Answers>(() => {
    const base = buildInitialAnswers(initialProfile);
    if (typeof window === 'undefined') return base;
    try {
      const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as { answers?: Answers };
      if (!parsed.answers) return base;
      const merged = { ...base };
      for (const k of Object.keys(EMPTY_ANSWERS) as StepKey[]) {
        if (!merged[k] && parsed.answers[k]) merged[k] = parsed.answers[k];
      }
      return merged;
    } catch {
      return base;
    }
  });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
    } catch {
      /* ignore */
    }
  }, [answers]);

  function update(key: StepKey, value: string) {
    setAnswers((p) => ({ ...p, [key]: value }));
  }

  function skip() {
    try {
      window.sessionStorage.setItem(ONBOARDING_SKIP_KEY, '1');
      window.localStorage.setItem('glowbal-search-visited', '1');
    } catch {
      /* ignore */
    }
    router.push('/universities');
  }

  async function save() {
    setSubmitting(true);
    setMessage(null);

    if (!isSignedIn) {
      try {
        window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
      } catch {
        /* ignore */
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
    const { error } = await supabase.from('student_profiles').upsert(
      {
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
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    try {
      window.localStorage.removeItem(ONBOARDING_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push('/universities');
  }

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;
  const currentAnswer = answers[current.key];

  function next() {
    if (isLast) {
      void save();
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  return (
    // t() localises everything, so keep the DOM auto-translator off this subtree.
    <div className="gb-page-full-bleed flex min-h-screen flex-col bg-surface" data-no-auto-translate>
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={{ href: '/universities', label: 'Find universities' }}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-gb-xl py-gb-6xl">
        {/* Title + progress */}
        <div className="flex items-center justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-xs font-semibold text-fg">
            {t('Plan your studies')}
          </h1>
          <span className="shrink-0 rounded-gb-full bg-brand-subtle px-gb-lg py-gb-xxs text-gb-sm font-medium text-fg-brand">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        <div className="mt-gb-lg flex gap-gb-xs" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`h-gb-xs flex-1 rounded-gb-full transition-colors ${
                i <= step ? 'bg-brand' : 'bg-surface-muted'
              }`}
            />
          ))}
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={skip}
          className="mt-gb-lg self-end text-gb-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary"
        >
          {t('Skip for now')} →
        </button>

        {/* Question */}
        <div className="mt-gb-4xl flex flex-col gap-gb-2xl">
          <div className="flex flex-col gap-gb-sm">
            <h2 className="text-gb-display-xs font-semibold text-fg">{t(current.title)}</h2>
            <p className="text-gb-md text-fg-tertiary">{t(current.body)}</p>
          </div>

          {current.key === 'study_level' ? (
            <div className="grid gap-gb-lg sm:grid-cols-3">
              {studyLevels.map((level) => (
                <Choice key={level.value} label={level.label} selected={currentAnswer === level.value} onClick={() => update('study_level', level.value)} />
              ))}
            </div>
          ) : null}

          {current.key === 'subjects' ? (
            <div className="grid gap-gb-lg sm:grid-cols-2 md:grid-cols-3">
              {subjectFamilies.map((family) => (
                <Choice
                  key={family.key}
                  label={family.label}
                  hint={family.children.slice(0, 2).map((c) => t(c)).join(' · ')}
                  selected={currentAnswer === family.children[0]}
                  onClick={() => update('subjects', family.children[0] ?? '')}
                />
              ))}
            </div>
          ) : null}

          {current.key === 'countries' ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {regionOptions.map((region) => (
                <Choice key={region.label} label={region.label} hint={region.hint} selected={currentAnswer === region.label} onClick={() => update('countries', region.label)} />
              ))}
            </div>
          ) : null}

          {current.key === 'budget' ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {budgetOptions.map((option) => (
                <Choice key={option} label={option} selected={currentAnswer === option} onClick={() => update('budget', option)} />
              ))}
            </div>
          ) : null}

          {current.key === 'campus' ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {campusOptions.map((option) => (
                <Choice key={option} label={option} selected={currentAnswer === option} onClick={() => update('campus', option)} />
              ))}
            </div>
          ) : null}

          {current.key === 'support' ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {supportNeeds.map((need) => (
                <Choice key={need} label={need} selected={currentAnswer === need} onClick={() => update('support', need)} />
              ))}
            </div>
          ) : null}

          {current.key === 'goals' ? (
            <div className="flex flex-col gap-gb-lg">
              <Textarea
                name="goals"
                value={answers.goals}
                onChange={(e) => update('goals', e.target.value)}
                placeholder={t("A sentence or two about the future you're building toward.")}
                rows={4}
              />
              <div className="flex flex-wrap gap-gb-sm">
                {goalIdeas.map((idea) => {
                  const label = t(idea);
                  return (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => update('goals', label)}
                      className="rounded-gb-full border border-line-strong bg-surface px-gb-lg py-gb-sm text-gb-xs text-fg-tertiary transition-colors hover:border-brand hover:text-fg-brand"
                    >
                      {label.slice(0, 60)}
                      {label.length > 60 ? '…' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {message ? (
          <p className="mt-gb-xl rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {t(message)}
          </p>
        ) : null}

        {/* Nav */}
        <div className="mt-gb-5xl flex items-center justify-between gap-gb-lg">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((s) => Math.max(s - 1, 0))}>
              {t('Back')}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="xl"
            onClick={next}
            disabled={submitting || (isLast ? false : !currentAnswer)}
          >
            {submitting
              ? t('Saving…')
              : isLast
                ? isSignedIn
                  ? t('Save & see matches')
                  : t('Sign in & save')
                : t('Continue')}
          </Button>
        </div>
      </main>
    </div>
  );
}
