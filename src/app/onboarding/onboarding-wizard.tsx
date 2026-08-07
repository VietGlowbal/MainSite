'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { notifyNavigationOnboardingCompleted } from '@/components/navigation-session';
import { SiteNavigation } from '@/components/site-navigation';
import { Button, Input, MultiSelect, Radio } from '@/shared/ui';
import type { MultiSelectOption } from '@/shared/ui';
import {
  EMPTY_ACADEMIC,
  EMPTY_TESTS,
  ENGLISH_TEST_FORMATS,
  STANDARDIZED_TEST_FORMATS,
  academicComplete,
  collectCurriculumGrades,
  defaultScaleFor,
  gradeFormatFor,
  keepScores,
  readAcademicDraft,
  readTestsDraft,
  scalesFor,
  testScoresValid,
  toCurriculumGrades,
  toCurriculumList,
} from '@/features/onboarding/domain';
import type { Academic, GradeFormat, Tests } from '@/features/onboarding/domain';
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
 * They sit at positions 6 and 7 so the progress pill reads 6/8 and 7/8.
 *
 * Scope, revised 2026-07-30 (owner): EIGHT steps. Câu 9 ("What kind of future
 * are you building?") is REMOVED. It was the only free-text step, it asked for
 * something /profile/goals already owns with more room, and it sat between the
 * student and the matches they came for. `student_profiles.goals` is untouched
 * by this form now — the upsert below simply omits the column, so a value
 * written by /profile/goals survives a re-run of onboarding.
 *
 * ⚠️ Câu 8 (academic awards: Level / Role / Prize / Year) is STILL not built.
 * It duplicates the /ai-strategy "Detailed Achievements" input, which asks for
 * the same thing in more depth, and nothing has been decided about which owns
 * it. That is a product decision, not a missing column.
 *
 * The progress bar is a navigation control, not a readout: any step already
 * reached is clickable so an answer can be corrected without walking the whole
 * wizard backwards. See `reachable` for why it is not simply "any step".
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

/**
 * `Academic` (câu 6) and `Tests` (câu 7) live in
 * `src/features/onboarding/domain/draft.ts`, together with the coercers that
 * read them back out of localStorage. See the note there: both shapes have
 * changed since drafts started being saved, and both changes crashed the step
 * until the draft was parsed defensively rather than cast.
 */
type Answers = {
  study_level: string;
  subjects: string;
  countries: string;
  budget: string;
  campus: string;
  academic: Academic;
  tests: Tests;
  support: string;
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
};

/**
 * `gpa_value` is NUMERIC(4,2), which holds 99.99 — and Postgres does not round
 * an over-range value, it raises `numeric field overflow`. That arrives as a
 * failed save on the LAST step with every other answer already written, so a
 * number the column cannot hold is dropped instead of sent. The migration
 * widens the column to NUMERIC(6,2) for percentages; this guard is what keeps
 * an un-migrated project saving rather than erroring.
 */
const GPA_COLUMN_MAX = 99.99;

/** The one message the format layer does not own: an empty required box. */
const GRADE_REQUIRED = 'Enter your grade so we can match you accurately.';

/**
 * Why this step's grade box rejects what is in it, or `undefined`.
 *
 * An untouched empty box is NOT an error — it reports as `undefined` here and is
 * caught by `isAnswered`, which keeps "Continue" disabled. Shouting "required"
 * at a field nobody has typed in yet is noise; shouting "that is not a grade"
 * the moment they type letters is the whole point. `showRequired` flips the
 * empty case on once they have tried to leave the step.
 */
function gradeError(
  format: GradeFormat | undefined,
  raw: string,
  showRequired: boolean,
): { message: string; vars: Record<string, string | number> } | undefined {
  if (format === undefined) return undefined;
  if (raw.trim() === '') {
    return showRequired ? { message: GRADE_REQUIRED, vars: {} } : undefined;
  }
  return format.check(raw) ?? undefined;
}

/**
 * A hydration gate, as an external store.
 *
 * `useSyncExternalStore` is the one hook that can report a client-only fact
 * safely: React takes `onServer` for the SSR pass AND for the hydration render,
 * then `onClient`, and re-renders for the difference itself.
 *
 * Neither alternative works here. A `useState` initialiser that reads
 * localStorage makes the hydration render disagree with the server's HTML, and
 * React does not patch up mismatched ATTRIBUTES — it keeps the server's, which
 * left every progress-bar segment stuck `disabled`. A `useEffect` that calls
 * `setState` trips `react-hooks/set-state-in-effect`.
 *
 * The store never emits, because "we are on the client" cannot stop being true.
 */
const NO_UPDATES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * The saved draft's answers, as UNTRUSTED JSON.
 *
 * Typed `Record<string, unknown>` rather than `Answers` on purpose. Four
 * components share this localStorage key — this wizard,
 * `components/onboarding/onboarding-single-page`,
 * `components/onboarding/onboarding-globe-quiz` and `./profile-form` — and they
 * write three different top-level shapes between them, on top of whatever an
 * older build of this wizard left behind. Declaring the parse result as `Answers`
 * is what let a draft with `englishScore: string` (pre-09d3bc9) into state as if
 * it had an `englishScores` map, which crashed câu 7 on every keystroke.
 */
function readDraft(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;
    // `profile-form` writes `{ profile, stepIndex }` and has no `answers` at all.
    const answers = (parsed as Record<string, unknown>)['answers'];
    if (answers === null || typeof answers !== 'object') return null;
    return answers as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Draft answers layered UNDER the profile's — a saved profile always wins, and
 * the draft only fills steps it left empty.
 *
 * Every value is coerced, never cast. The structured steps go through their own
 * readers; the plain steps are type-checked here because a shared draft key means
 * a non-string can genuinely turn up in one.
 */
function mergeDraft(base: Answers, draft: Record<string, unknown> | null): Answers {
  if (draft === null) return base;
  const merged = { ...base };
  for (const k of Object.keys(EMPTY_ANSWERS) as StepKey[]) {
    // The structured steps are objects, so "empty" is not falsiness —
    // a draft wins whenever the profile did not supply the step.
    if (k === 'academic') {
      const academic = readAcademicDraft(draft[k]);
      if (academic && !isAnswered(merged, k)) merged[k] = academic;
      continue;
    }
    if (k === 'tests') {
      const tests = readTestsDraft(draft[k]);
      if (tests && !isAnswered(merged, k)) merged[k] = tests;
      continue;
    }
    const value = draft[k];
    if (!merged[k] && typeof value === 'string' && value !== '') merged[k] = value;
  }
  return merged;
}

/** The two structured steps; everything else is a plain string. */
function isStructured(key: StepKey): key is 'academic' | 'tests' {
  return key === 'academic' || key === 'tests';
}

/** Has this step been answered enough to move on? */
function isAnswered(answers: Answers, key: StepKey): boolean {
  if (key === 'academic') return academicComplete(answers.academic);
  if (key === 'tests') {
    return (
      answers.tests.english.length > 0 &&
      answers.tests.standardized.length > 0 &&
      testScoresValid(answers.tests.english, answers.tests.englishScores, ENGLISH_TEST_FORMATS) &&
      testScoresValid(
        answers.tests.standardized,
        answers.tests.standardizedScores,
        STANDARDIZED_TEST_FORMATS,
      )
    );
  }
  return answers[key] !== '';
}

// ── Profile <-> answers mapping (unchanged from the old single-page form) ────

function buildInitialAnswers(initialProfile?: StudentProfile | null): Answers {
  if (!initialProfile) return { ...EMPTY_ANSWERS };
  const firstSupport = (initialProfile.support_needs || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const savedSubject = initialProfile.target_subjects?.[0] || '';
  // Older builds stored the first example inside a subject family (for
  // example, choosing "Technology" wrote "Computer Science"). Restore either
  // shape to the answer the student actually saw, while preserving custom
  // values that may have been entered from User Profile.
  const firstSubject =
    subjectFamilies.find(
      (family) => family.label === savedSubject || family.children.includes(savedSubject),
    )?.label ?? savedSubject;
  const firstStudyLevel = (initialProfile.study_level || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
  const firstCampus = (initialProfile.campus_preferences || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';

  const preferredCountries = initialProfile.preferred_countries || [];
  let region = '';
  if (preferredCountries.length) {
    if (preferredCountries.includes('Open to ideas')) region = 'Open to ideas';
    else if (preferredCountries.some((c) => ['United Kingdom', 'Ireland'].includes(c))) region = 'UK & Ireland';
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
    academic: buildInitialAcademic(initialProfile),
    // Test results live in their own tables, which this component is not given.
    // A returning student re-enters them; the upserts below are keyed on
    // (user_id, test_type) so nothing duplicates.
    tests: EMPTY_TESTS,
    support: firstSupport,
  };
}

/**
 * Câu 6, restored from the profile.
 *
 * `curriculum_grades` is the real source and carries one row per curriculum.
 * The `gpa_scale` / `gpa_value` fallback exists for rows written before that
 * column did — those hold a single scale and number with no curriculum attached,
 * so they are attributed to the FIRST curriculum, and only when that curriculum
 * actually offers the stored scale. Guessing wider would relabel a Vietnamese
 * 10-point average as an IB total.
 */
function buildInitialAcademic(profile: StudentProfile): Academic {
  const curriculum = toCurriculumList(profile.curriculum);
  const scales: Record<string, string> = {};
  const grades: Record<string, string> = {};

  for (const row of toCurriculumGrades(profile.curriculum_grades)) {
    if (!curriculum.includes(row.curriculum)) continue;
    scales[row.curriculum] = row.scale;
    grades[row.curriculum] = row.grade;
  }

  const first = curriculum[0];
  if (first !== undefined && grades[first] === undefined && profile.gpa_value != null) {
    const legacy = scalesFor(first).find((format) => format.scale === profile.gpa_scale);
    if (legacy !== undefined) {
      scales[first] = legacy.scale;
      grades[first] = String(profile.gpa_value);
    }
  }

  // Anything still without a scale gets the curriculum's default, so its box
  // renders with a format rather than blank.
  for (const name of curriculum) {
    if (scales[name] === undefined) scales[name] = defaultScaleFor(name);
  }

  return { curriculum, scales, grades };
}

function mapRegionToCountries(region: string): string[] {
  switch (region) {
    case 'UK & Ireland': return ['United Kingdom', 'Ireland'];
    case 'Europe': return ['Netherlands', 'Germany', 'France', 'Sweden', 'Switzerland', 'Spain', 'Italy'];
    case 'North America': return ['United States', 'Canada'];
    case 'Asia-Pacific': return ['Singapore', 'Australia', 'New Zealand', 'Japan', 'South Korea', 'Hong Kong'];
    case 'Middle East': return ['United Arab Emirates', 'Qatar'];
    // Keep the literal answer in the profile. Matching treats this sentinel as
    // an open preference, while the Profile editor can faithfully show and
    // change what the student chose.
    case 'Open to ideas': return ['Open to ideas'];
    default: return [];
  }
}

function answersToProfile(a: Answers): StudentProfile {
  return {
    study_level: a.study_level || null,
    target_subjects: a.subjects ? [a.subjects] : [],
    preferred_countries: mapRegionToCountries(a.countries),
    budget_range: a.budget || null,
    // No `goals`: câu 9 was removed and this form no longer collects it. The
    // upsert omits the column entirely so a value from /profile/goals survives.
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
  // Câu 9 ("What kind of future are you building?") was removed on 2026-07-30 —
  // see the scope note at the top of the file. /profile/goals owns that answer.
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

// ── Câu 7 score box ──────────────────────────────────────────────────────────

/**
 * One test's score, formatted and checked on that test's own scale.
 *
 * Both halves of câu 7 used a bare text box with a shared placeholder, so "sdvds"
 * was accepted as a TOEFL score and written to a NUMERIC column as `null`. IELTS
 * is 0–9 in half bands, TOEFL 0–120 whole, A-Level is letters — one box cannot
 * check all three, so each test brings its own format.
 *
 * These scores stay OPTIONAL: the step's own copy tells the student to leave one
 * blank while they wait for a result. An empty box is never an error here; only a
 * filled one that is not a score on the scale.
 */
function ScoreField({
  group,
  test,
  format,
  value,
  onChange,
}: {
  /** Namespaces the input id — "None yet" and "IB Diploma" appear in both lists. */
  group: string;
  test: string;
  format: GradeFormat | undefined;
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useT();
  const problem = value.trim() === '' ? null : (format?.check(value) ?? null);
  const slug = `${group}-${test.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '')}`;

  return (
    <Input
      name={`score-${slug}`}
      // The test name is a proper noun on both sides of the i18n boundary.
      label={`${t('Your score')} — ${test}`}
      inputMode={format?.numeric === false ? 'text' : 'decimal'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...(format ? { hint: t(format.hint), placeholder: format.placeholder } : {})}
      {...(problem ? { error: t(problem.message, problem.vars) } : {})}
    />
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingWizard({
  initialProfile = null,
  isSignedIn = false,
}: {
  initialProfile?: StudentProfile | null;
  isSignedIn?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const supabase = useMemo(() => createClient(), []);

  const hydrated = useSyncExternalStore(NO_UPDATES, onClient, onServer);
  const [answers, setAnswers] = useState<Answers>(() => buildInitialAnswers(initialProfile));
  const [draftRead, setDraftRead] = useState(false);

  /*
   * The localStorage draft is merged in once hydration is over — see the note on
   * NO_UPDATES for why it cannot be read in the initialiser above.
   *
   * Adjusting state DURING render rather than in an effect is deliberate and is
   * React's own pattern for it: React re-runs this component with the merged
   * answers before committing, so nothing paints twice and no effect is involved.
   */
  if (hydrated && !draftRead) {
    setDraftRead(true);
    setAnswers((base) => mergeDraft(base, readDraft()));
  }

  const [step, setStep] = useState(0);
  /**
   * The furthest step reached in this session.
   *
   * The progress bar navigates, so it needs to know which steps the student has
   * actually seen — `step` alone forgets the moment they go back to fix câu 3.
   */
  const [furthest, setFurthest] = useState(0);
  /**
   * Câu 6 asks for a grade per curriculum, and an empty box is a blocker rather
   * than a mistake. Its "required" message stays hidden until the student tries
   * to leave the step, so an untouched form is not covered in red.
   */
  const [showRequired, setShowRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useLoadingIndicator(submitting, 'Building your profile');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Skipped until the draft has been read, so the pre-hydration answers do
    // not overwrite the very draft they are about to be merged with.
    if (!draftRead) return;
    try {
      window.localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ answers }));
    } catch {
      /* ignore */
    }
  }, [answers, draftRead]);

  function update(key: Exclude<StepKey, 'academic' | 'tests'>, value: string) {
    setAnswers((p) => ({ ...p, [key]: value }));
  }

  function updateAcademic(patch: Partial<Academic>) {
    setAnswers((p) => ({ ...p, academic: { ...p.academic, ...patch } }));
  }

  /**
   * Ticking a curriculum preselects the scale most of its students report on, so
   * the grade box arrives with a format instead of asking two questions before
   * accepting one number. Unticking one takes its scale and grade with it —
   * otherwise re-ticking it later silently restores a grade the student cleared,
   * and the localStorage draft carries it between sessions.
   */
  function pickCurriculum(curriculum: string[]) {
    const scales: Record<string, string> = {};
    const grades: Record<string, string> = {};
    for (const name of curriculum) {
      scales[name] = answers.academic.scales[name] ?? defaultScaleFor(name);
      const grade = answers.academic.grades[name];
      if (grade !== undefined) grades[name] = grade;
    }
    updateAcademic({ curriculum, scales, grades });
  }

  /**
   * Switching scale clears the grade.
   *
   * "8.5" is a good 10-point average and an impossible 4.0 one; carrying the
   * number across would leave a value that reads as valid on a scale it was
   * never measured on.
   */
  function pickScale(curriculum: string, scale: string) {
    const grades = { ...answers.academic.grades };
    delete grades[curriculum];
    updateAcademic({
      scales: { ...answers.academic.scales, [curriculum]: scale },
      grades,
    });
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
    const grades = collectCurriculumGrades(answers.academic);
    /*
     * `gpa_scale` / `gpa_value` keep holding ONE comparable number, because that
     * is what a check against `universities.gpa_range` reads. The first ticked
     * curriculum whose scale produces a number wins — an IB student who also
     * ticked AP contributes the AP GPA rather than "38", which would compare as
     * a 38.0 GPA. Letter-only students contribute no number at all, and that is
     * correct: there isn't one.
     */
    const comparable = grades.find(
      (row) => row.value !== null && row.value <= GPA_COLUMN_MAX,
    );
    const saveProfile = (completedAt: string) => supabase.from('student_profiles').upsert(
      {
        user_id: userData.user.id,
        study_level: profile.study_level,
        target_subjects: profile.target_subjects,
        preferred_countries: profile.preferred_countries,
        budget_range: profile.budget_range,
        // No `academic_background`, `goals`, or `career_interests` key. This
        // questionnaire does not collect those richer profile fields, so
        // omitting them preserves anything the student already saved there.
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
         * `curriculum_grades` is the grade for each of those ticks, with the
         * scale it was measured on. It is the only place a two-curriculum
         * student's second grade — or an IB total, which is not a GPA — can land
         * without being relabelled as something else.
         */
        curriculum: answers.academic.curriculum.length > 0 ? answers.academic.curriculum : null,
        curriculum_grades: grades.length > 0 ? grades : null,
        gpa_scale: comparable?.scale ?? null,
        gpa_value: comparable?.value ?? null,
        onboarding_completed: true,
        onboarding_completed_at: completedAt,
        updated_at: completedAt,
      },
      { onConflict: 'user_id' },
    );
    /*
     * Câu 7 writes to two score tables rather than to student_profiles.
     * Completion is held back until these writes succeed. The navigation uses
     * that flag to retire the one-time CTA, so marking it early would hide the
     * recovery path while some answers were still missing.
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
        // The score is checked on its own scale before it gets here, so this is
        // the number the student typed — not a `parseFloat` best guess.
        overall_score:
          ENGLISH_TEST_FORMATS[testType]?.toNumber(
            answers.tests.englishScores[testType] ?? '',
          ) ?? null,
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
      if (result.error) {
        setMessage(result.error.message);
        setSubmitting(false);
        return;
      }
    }

    // This is the commit point for the first-time experience. Score rows have
    // succeeded, and the profile answers now land together with the completion
    // flag, so navigation can safely replace onboarding with Strategy Master.
    const completedAt = new Date().toISOString();
    const { error: completionError } = await saveProfile(completedAt);

    if (completionError) {
      setMessage(completionError.message);
      setSubmitting(false);
      return;
    }

    notifyNavigationOnboardingCompleted();

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

  /**
   * The last step the progress bar will jump to.
   *
   * NOT simply `STEPS.length - 1`. The bar exists so an answer can be corrected,
   * which is a backwards move; letting it jump FORWARD past an unanswered step
   * would route around the same gate that keeps "Continue" disabled, and the
   * student would land on the save button with câu 3 still blank.
   *
   * So: everything already seen stays open, and the frontier extends over each
   * consecutive step that is already answered. The second half matters for a
   * returning student whose draft or profile filled the whole wizard — they
   * start at step 1 and can go straight to the one answer they came to change.
   */
  const reachable = useMemo(() => {
    let last = furthest;
    while (last < STEPS.length - 1 && isAnswered(answers, STEPS[last]!.key)) last += 1;
    return last;
  }, [answers, furthest]);

  function goTo(index: number) {
    const target = Math.min(Math.max(index, 0), STEPS.length - 1);
    setStep(target);
    setFurthest((f) => Math.max(f, target));
    // Each step owns its own blank-field nudges; carrying câu 6's into câu 7
    // would flag boxes the student has not reached.
    setShowRequired(false);
  }

  function next() {
    if (isLast) {
      void save();
    } else {
      goTo(step + 1);
    }
  }

  return (
    // t() localises everything, so keep the DOM auto-translator off this subtree.
    <div className="gb-page-full-bleed gb-has-mobile-header flex min-h-screen flex-col bg-surface" data-no-auto-translate>
      <SiteNavigation tone="light" />

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-gb-xl py-gb-6xl">
        {/* Title + progress */}
        <div className="flex items-center justify-between gap-gb-lg">
          <h1 className="font-display text-gb-display-xs font-semibold text-fg">
            {t('Plan your Global Education')}
          </h1>
          <span className="shrink-0 rounded-gb-full bg-brand-subtle px-gb-lg py-gb-xxs text-gb-sm font-medium text-fg-brand">
            {step + 1}/{STEPS.length}
          </span>
        </div>
        {/*
          The bar navigates. Each segment is a real <button> in a <nav> rather
          than the decorative <span> this was, because a student who spots a
          mistake in câu 2 from câu 7 should not have to press "Back" five times.

          The 4px segment is not a click target, so the button carries 6px of
          vertical padding and draws the bar in a child span. The 6px is taken
          off this row's own margin and off the Skip link below it, so the bar
          still sits 12px under the title and nothing else moves.
        */}
        <nav className="mt-gb-sm flex gap-gb-xs" aria-label={t('Onboarding questions')}>
          {STEPS.map((s, i) => {
            const open = i <= reachable;
            const done = i <= step;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(i)}
                disabled={!open}
                aria-current={i === step ? 'step' : undefined}
                // The bar is the only label these have, and it is a colour. The
                // number and the question text give each one a real name.
                aria-label={`${t('Question')} ${i + 1} — ${t(s.title)}`}
                title={`${i + 1}. ${t(s.title)}`}
                className="group flex-1 cursor-pointer py-gb-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed"
              >
                <span
                  className={`block h-gb-xs rounded-gb-full transition-colors ${
                    done
                      ? 'bg-brand'
                      : open
                        ? 'bg-surface-muted group-hover:bg-brand-surface'
                        : 'bg-surface-muted'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Skip */}
        <button
          type="button"
          onClick={skip}
          className="mt-gb-sm self-end text-gb-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary"
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
                  selected={currentAnswer === family.label}
                  onClick={() => update('subjects', family.label)}
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

          {/* Câu 6 — Figma 375:11536.
              The frame draws ONE grading-scale list and ONE "Current GPA" box
              under the checkbox list. These are per curriculum instead: see the
              note on `Academic` for why a shared box cannot hold the answer of
              a student sitting two curricula, or of an IB student, who has no
              GPA at all. Each block carries its curriculum as a heading, which
              is the treatment the frame gives the scale list. */}
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
                onChange={pickCurriculum}
              />

              {answers.academic.curriculum.map((curriculum) => {
                const scales = scalesFor(curriculum);
                const scale = answers.academic.scales[curriculum];
                const format = gradeFormatFor(curriculum, scale);
                if (format === undefined) return null;
                const raw = answers.academic.grades[curriculum] ?? '';
                const problem = gradeError(format, raw, showRequired);
                // Sanitised for use in an id/name — the option labels carry
                // spaces, slashes, ampersands and dots.
                const slug = curriculum.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/, '');

                return (
                  <div
                    key={curriculum}
                    className="flex flex-col rounded-gb-md border border-line bg-surface shadow-xs"
                  >
                    <p className="border-b border-line px-gb-xl py-gb-lg text-gb-sm font-medium text-fg">
                      {t(curriculum)}
                    </p>
                    <div className="flex flex-col gap-gb-xl p-gb-xl">
                      {/* A single-scale curriculum gets no picker — a radio
                          group of one is a decision the student cannot make. */}
                      {scales.length > 1 ? (
                        <fieldset>
                          <legend className="text-gb-sm font-medium text-fg-secondary">
                            {t('How are you graded?')}
                          </legend>
                          <div className="mt-gb-md flex flex-col gap-gb-lg sm:flex-row sm:gap-gb-3xl">
                            {scales.map((option) => (
                              <Radio
                                key={option.scale}
                                name={`scale-${slug}`}
                                value={option.scale}
                                label={t(option.scale)}
                                checked={format.scale === option.scale}
                                onChange={() => pickScale(curriculum, option.scale)}
                              />
                            ))}
                          </div>
                        </fieldset>
                      ) : null}

                      <Input
                        name={`grade-${slug}`}
                        label={t(format.fieldLabel)}
                        required
                        hint={t(format.hint)}
                        inputMode={format.numeric ? 'decimal' : 'text'}
                        // The browser's own validation is off: it fires on submit
                        // and this wizard has no <form>. `error` is the channel.
                        value={raw}
                        onChange={(e) =>
                          updateAcademic({
                            grades: { ...answers.academic.grades, [curriculum]: e.target.value },
                          })
                        }
                        // Leaving a box empty is what turns the "required"
                        // message on — see the note on `showRequired`.
                        onBlur={() => setShowRequired(true)}
                        placeholder={format.placeholder}
                        {...(problem ? { error: t(problem.message, problem.vars) } : {})}
                      />
                    </div>
                  </div>
                );
              })}
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
                  <ScoreField
                    key={test}
                    group="english"
                    test={test}
                    format={ENGLISH_TEST_FORMATS[test]}
                    value={answers.tests.englishScores[test] ?? ''}
                    onChange={(score) =>
                      updateTests({
                        englishScores: { ...answers.tests.englishScores, [test]: score },
                      })
                    }
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
                  <ScoreField
                    key={test}
                    group="standardized"
                    test={test}
                    format={STANDARDIZED_TEST_FORMATS[test]}
                    value={answers.tests.standardizedScores[test] ?? ''}
                    onChange={(score) =>
                      updateTests({
                        standardizedScores: { ...answers.tests.standardizedScores, [test]: score },
                      })
                    }
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

        </div>

        {message ? (
          <p className="mt-gb-xl rounded-gb-md bg-surface-error px-gb-lg py-gb-md text-gb-sm text-fg-error">
            {t(message)}
          </p>
        ) : null}

        {/* Nav */}
        <div className="mt-gb-5xl flex items-center justify-between gap-gb-lg">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => goTo(step - 1)}>
              {t('Back')}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="xl"
            onClick={next}
            disabled={submitting || !isAnswered(answers, current.key)}
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
