'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { MARKETING_NAV_ITEMS } from '@/features/marketing/ui';
import { Button, Input, MultiSelect, Textarea, TopNav } from '@/shared/ui';
import type { MultiSelectOption } from '@/shared/ui';
// Not from the '@/shared/ui' barrel — see the note on the re-export there: the
// hook is used in ~40 places, and reaching through the barrel for it drags the
// whole design system into each one's graph and into the coverage denominator.
// This import was lost when the globe-loader work (#81) merged with the 9-step
// wizard rewrite; the call at `useLoadingIndicator(submitting, …)` survived, the
// import did not, and that is what failed the Vercel build.
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
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
 * Scope, revised 2026-07-28: NINE steps, not seven. The original build reused
 * the existing seven-question model because the Figma's academic steps had no
 * columns behind them. The owner has since asked for câu 6 (375:11536) and câu
 * 7 (375:11616) to be built and the columns added — see
 * supabase-academic-intake.sql, which must be run before this ships.
 *
 * They sit at positions 6 and 7 so the progress pill reads 6/9 and 7/9 exactly
 * as the frames do.
 *
 * ⚠️ Câu 8 (academic awards: Level / Role / Prize / Year) is STILL not built.
 * It duplicates the /ai-strategy "Detailed Achievements" input, which asks for
 * the same thing in more depth, and nothing has been decided about which owns
 * it. That is a product decision, not a missing column.
 *
 * Everything below keeps the exact save / guest-bounce / draft / skip behaviour
 * of the old form.
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

/** Câu 6 (375:11536). Labels are the frame's, verbatim. */
const curriculumOptions: MultiSelectOption[] = [
  { value: 'Vietnamese National Curriculum', label: 'Vietnamese National Curriculum' },
  { value: 'IB Diploma Programme (IBDP)', label: 'IB Diploma Programme (IBDP)' },
  {
    value: 'Cambridge International (IGCSE / AS & A Level)',
    label: 'Cambridge International (IGCSE / AS & A Level)',
  },
  { value: 'AP + US High School Diploma', label: 'AP + US High School Diploma' },
  { value: 'Others...', label: 'Others...' },
];

const gpaScaleOptions: MultiSelectOption[] = [
  { value: '10-point scale', label: '10-point scale' },
  { value: '4.0 scale', label: '4.0 scale' },
];

/** Câu 7 (375:11616), upper half. Written to `english_test_scores`. */
const englishTestOptions: MultiSelectOption[] = [
  { value: 'IELTS Academic', label: 'IELTS Academic' },
  { value: 'TOEFL iBT', label: 'TOEFL iBT' },
  { value: 'PTE Academic', label: 'PTE Academic' },
  { value: 'Duolingo English Test', label: 'Duolingo English Test' },
  { value: 'Cambridge English', label: 'Cambridge English' },
  { value: 'None yet', label: 'None yet' },
];

/** Câu 7, lower half. Written to `standardized_test_scores`. */
const standardizedTestOptions: MultiSelectOption[] = [
  { value: 'SAT', label: 'SAT' },
  { value: 'ACT', label: 'ACT' },
  { value: 'AP Exams', label: 'AP Exams' },
  { value: 'IB Diploma', label: 'IB Diploma' },
  { value: 'A-Level', label: 'A-Level' },
  { value: 'GCSE / IGCSE', label: 'GCSE / IGCSE' },
  { value: 'None yet', label: 'None yet' },
];

/** "None yet" means the student has no result, so it excludes every sibling. */
const NONE_YET = 'None yet';

type Academic = { curriculum: string[]; gpaScale: string[]; gpa: string };

/**
 * Scores are keyed BY TEST, not shared.
 *
 * The frame draws one "Your Score:" field under each multi-select, but the
 * multi-select takes several tests. Writing that one number to every selected
 * test fabricates data — a student who ticks IELTS and TOEFL and types 7.5 gets
 * a TOEFL of 7.5, which is not a score on that scale at all. One field per
 * chosen test is a small departure from the frame and the only way these rows
 * land honestly.
 *
 * The frame's second, unlabelled "Other" box is dropped: nothing in the schema
 * corresponds to it, so it was a control that collected typing and threw it
 * away.
 */
type Tests = {
  english: string[];
  englishScores: Record<string, string>;
  standardized: string[];
  standardizedScores: Record<string, string>;
};

type Answers = {
  study_level: string;
  subjects: string;
  countries: string;
  budget: string;
  campus: string;
  academic: Academic;
  tests: Tests;
  support: string;
  goals: string;
};

const EMPTY_ACADEMIC: Academic = { curriculum: [], gpaScale: [], gpa: '' };
const EMPTY_TESTS: Tests = {
  english: [],
  englishScores: {},
  standardized: [],
  standardizedScores: {},
};

const EMPTY_ANSWERS: Answers = {
  study_level: '',
  subjects: '',
  countries: '',
  budget: '',
  campus: '',
  academic: EMPTY_ACADEMIC,
  tests: EMPTY_TESTS,
  support: '',
  goals: '',
};

/**
 * GPA as a number, or null. Deliberately strict: the column is NUMERIC(4,2) and
 * a value that is not a number is worse than no value, because a scale-aware
 * comparison against `universities.gpa_range` would silently skip it.
 *
 * The range guard is not cosmetic. NUMERIC(4,2) holds up to 99.99, and Postgres
 * does not round an over-range value — it raises `numeric field overflow`, which
 * arrives as a failed save on the LAST step of a nine-step wizard with every
 * other answer already written. A student typing their GPA as "100" (or a
 * percentage) would hit it. Out of range is treated as "not a GPA", same as
 * letters.
 */
/**
 * Whatever `student_profiles.curriculum` hands back, as the list the UI wants.
 * See the note in the caller for why this cannot assume the declared type.
 */
function toCurriculumList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim() !== '') return [value];
  return [];
}

function parseGpa(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 99.99) return null;
  return n;
}

/** Same, for the English overall score columns (also NUMERIC). */
function parseScore(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 9999) return null;
  return n;
}

/** The two structured steps; everything else is a plain string. */
function isStructured(key: StepKey): key is 'academic' | 'tests' {
  return key === 'academic' || key === 'tests';
}

/** Has this step been answered enough to move on? */
function isAnswered(answers: Answers, key: StepKey): boolean {
  if (key === 'academic') return answers.academic.curriculum.length > 0;
  if (key === 'tests') return answers.tests.english.length > 0;
  return answers[key] !== '';
}

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

  /*
   * `student_profiles.curriculum` is TEXT[] — but only on a database that has
   * had the repair block in supabase-academic-intake.sql applied. The column
   * shipped as TEXT first, and `ADD COLUMN IF NOT EXISTS` matches on name
   * alone, so re-running that migration never changed the type: a project that
   * ran the early copy still has TEXT and hands back a bare string here.
   *
   * The declared type says string[], so nothing downstream expects that, and
   * `curriculum.join(' · ')` at the câu 6 heading throws on a string. Rather
   * than trust the schema, coerce whatever arrives into the list the UI is
   * typed for. Delete this once every environment is known to be converted.
   */
  return {
    study_level: firstStudyLevel,
    subjects: firstSubject,
    countries: region,
    budget: initialProfile.budget_range || '',
    campus: firstCampus,
    academic: {
      curriculum: toCurriculumList(initialProfile.curriculum),
      gpaScale: initialProfile.gpa_scale ? [initialProfile.gpa_scale] : [],
      gpa: initialProfile.gpa_value != null ? String(initialProfile.gpa_value) : '',
    },
    // Test results live in their own tables, which this component is not given.
    // A returning student re-enters them; the upserts below are keyed on
    // (user_id, test_type) so nothing duplicates.
    tests: EMPTY_TESTS,
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
  // Câu 6 and câu 7. Both frames title the screen "Academic Information"; the
  // body lines are written here because the frames carry none.
  { key: 'academic', title: 'Academic Information', body: 'Which curriculum are you studying, and how are you graded on it?' },
  { key: 'tests', title: 'Academic Information', body: 'Add any test results you already have. Leave a score blank if you are still waiting for it.' },
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
        // The structured steps are objects, so "empty" is not falsiness —
        // a draft wins whenever the profile did not supply the step.
        if (isStructured(k)) {
          const draft = parsed.answers[k];
          if (draft && !isAnswered(merged, k)) merged[k] = draft as never;
          continue;
        }
        if (!merged[k] && parsed.answers[k]) merged[k] = parsed.answers[k];
      }
      return merged;
    } catch {
      return base;
    }
  });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  useLoadingIndicator(submitting, 'Building your profile');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
    } catch {
      /* ignore */
    }
  }, [answers]);

  function update(key: Exclude<StepKey, 'academic' | 'tests'>, value: string) {
    setAnswers((p) => ({ ...p, [key]: value }));
  }

  function updateAcademic(patch: Partial<Academic>) {
    setAnswers((p) => ({ ...p, academic: { ...p.academic, ...patch } }));
  }

  function updateTests(patch: Partial<Tests>) {
    setAnswers((p) => ({ ...p, tests: { ...p.tests, ...patch } }));
  }

  /**
   * "None yet" is exclusive: choosing it clears the real tests, and choosing a
   * real test clears it. Without this a student can claim both "I have IELTS"
   * and "I have nothing", and the row written to the score table is a guess.
   *
   * The `added.length === 1` guard is what makes "Select all" behave. That
   * button hands back every option at once with "None yet" among them; treating
   * that as an exclusive pick would collapse the whole list to "I have no
   * results", the opposite of what was just asked for.
   */
  function pickTests(next: string[], previous: string[]): string[] {
    const added = next.filter((v) => !previous.includes(v));
    if (added.length === 1 && added[0] === NONE_YET) return [NONE_YET];
    return next.filter((v) => v !== NONE_YET);
  }

  /**
   * Drop scores belonging to tests that are no longer selected.
   *
   * Without this, unticking IELTS leaves its score in state; re-ticking it later
   * silently restores a number the student may have meant to clear, and the
   * draft in localStorage carries it between sessions.
   */
  function keepScores(
    selected: string[],
    scores: Record<string, string>,
  ): Record<string, string> {
    const kept: Record<string, string> = {};
    for (const test of selected) {
      const score = scores[test];
      if (score != null) kept[test] = score;
    }
    return kept;
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
        /*
         * Câu 6.
         *
         * `curriculum` keeps EVERY selection, in a TEXT[] column: the frame
         * draws checkboxes and a student can genuinely sit two curricula at
         * once (Vietnamese National plus AP is common). Saving only the first
         * would drop a tick the student watched themselves make.
         *
         * `gpa_scale` is the opposite and is a single-answer control, because
         * one GPA number has one scale — "10-point" AND "4.0" together
         * describes nothing.
         */
        curriculum: answers.academic.curriculum.length > 0 ? answers.academic.curriculum : null,
        gpa_scale: answers.academic.gpaScale[0] ?? null,
        gpa_value: parseGpa(answers.academic.gpa),
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

    /*
     * Câu 7 writes to two score tables rather than to student_profiles.
     *
     * Deliberately NOT fatal: the profile is already saved by this point, and
     * failing the whole wizard over a secondary row would lose the eight
     * answers that did save. A failure is logged and the student moves on —
     * /profile/english is the place to correct a test result anyway.
     *
     * "None yet" means the student has no result, so nothing is written.
     */
    const userId = userData.user.id;
    const now = new Date().toISOString();

    // Each test carries ITS OWN score. See the note on `Tests`: one shared
    // number written across several test types is invented data.
    const englishRows = answers.tests.english
      .filter((testType) => testType !== NONE_YET)
      .map((testType) => ({
        user_id: userId,
        test_type: testType,
        overall_score: parseScore(answers.tests.englishScores[testType] ?? ''),
        updated_at: now,
      }));

    const standardizedRows = answers.tests.standardized
      .filter((testType) => testType !== NONE_YET)
      .map((testType) => ({
        user_id: userId,
        test_type: testType,
        score: (answers.tests.standardizedScores[testType] ?? '').trim() || null,
        updated_at: now,
      }));

    const writes = [];
    if (englishRows.length > 0) {
      writes.push(
        supabase.from('english_test_scores').upsert(englishRows, { onConflict: 'user_id,test_type' }),
      );
    }
    if (standardizedRows.length > 0) {
      writes.push(
        supabase
          .from('standardized_test_scores')
          .upsert(standardizedRows, { onConflict: 'user_id,test_type' }),
      );
    }
    for (const result of await Promise.all(writes)) {
      if (result.error) console.error('[onboarding] test scores:', result.error.message);
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
  // The single-choice steps compare against this; the two structured steps
  // never reach a `Choice`, so an empty string is the safe value for them.
  const currentAnswer = isStructured(current.key) ? '' : answers[current.key];

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

          {/* Câu 6 — Figma 375:11536. The grading-scale list appears only once
              a curriculum is chosen, and carries it as its heading, which is
              what the frame draws ("Vietnamese National Curriculum" above
              10-point / 4.0). */}
          {current.key === 'academic' ? (
            <div className="flex flex-col gap-gb-3xl">
              {/* The frame's placeholder here reads "Select a GPA" over a list
                  of curricula, which describes the step rather than the field
                  and misdirects on the one screen where the two are easy to
                  confuse. Corrected; the frame should be too. */}
              <MultiSelect
                name="curriculum"
                label={t('Curriculum')}
                placeholder={t('Select a curriculum')}
                options={curriculumOptions}
                value={answers.academic.curriculum}
                onChange={(curriculum) =>
                  updateAcademic({ curriculum, ...(curriculum.length === 0 ? { gpaScale: [] } : {}) })
                }
              />

              {answers.academic.curriculum.length > 0 ? (
                <MultiSelect
                  name="gpaScale"
                  label={t('Grading scale')}
                  placeholder={t('Select a grading scale')}
                  options={gpaScaleOptions}
                  value={answers.academic.gpaScale}
                  onChange={(gpaScale) => updateAcademic({ gpaScale })}
                  // One GPA, one scale — see the note on MultiSelect's `single`.
                  single
                  heading={answers.academic.curriculum.join(' · ')}
                  maxVisible={2}
                />
              ) : null}

              <Input
                name="gpa"
                label={t('Current GPA')}
                inputMode="decimal"
                value={answers.academic.gpa}
                onChange={(e) => updateAcademic({ gpa: e.target.value })}
                placeholder={t('Enter your current GPA')}
              />
            </div>
          ) : null}

          {/* Câu 7 — Figma 375:11616. Two independent test groups. The frame
              gives each ONE score box; these give one per chosen test, because
              the picker is multi-select and a shared number would be written to
              every test type. See the note on `Tests`. */}
          {current.key === 'tests' ? (
            <div className="flex flex-col gap-gb-3xl">
              <MultiSelect
                name="englishTest"
                label={t('English proficiency')}
                placeholder={t('English Proficiency')}
                options={englishTestOptions}
                value={answers.tests.english}
                onChange={(next) => {
                  const english = pickTests(next, answers.tests.english);
                  updateTests({
                    english,
                    englishScores: keepScores(english, answers.tests.englishScores),
                  });
                }}
              />

              {/* "None yet" means there is no result, so no score box appears —
                  an enabled field there would invite an invented number. */}
              {answers.tests.english
                .filter((test) => test !== NONE_YET)
                .map((test) => (
                  <Input
                    key={test}
                    name={`englishScore-${test}`}
                    label={`${t('Your score')} — ${test}`}
                    inputMode="decimal"
                    value={answers.tests.englishScores[test] ?? ''}
                    onChange={(e) =>
                      updateTests({
                        englishScores: {
                          ...answers.tests.englishScores,
                          [test]: e.target.value,
                        },
                      })
                    }
                    placeholder={t('Overall score')}
                  />
                ))}

              <MultiSelect
                name="standardizedTest"
                label={t('Standardized test')}
                placeholder={t('Standardized Test')}
                options={standardizedTestOptions}
                value={answers.tests.standardized}
                onChange={(next) => {
                  const standardized = pickTests(next, answers.tests.standardized);
                  updateTests({
                    standardized,
                    standardizedScores: keepScores(
                      standardized,
                      answers.tests.standardizedScores,
                    ),
                  });
                }}
              />

              {answers.tests.standardized
                .filter((test) => test !== NONE_YET)
                .map((test) => (
                  <Input
                    key={test}
                    name={`standardizedScore-${test}`}
                    label={`${t('Your score')} — ${test}`}
                    value={answers.tests.standardizedScores[test] ?? ''}
                    onChange={(e) =>
                      updateTests({
                        standardizedScores: {
                          ...answers.tests.standardizedScores,
                          [test]: e.target.value,
                        },
                      })
                    }
                    placeholder={t('e.g. 1450, 34, A*AA')}
                  />
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
            disabled={submitting || (isLast ? false : !isAnswered(answers, current.key))}
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
