/**
 * When a student wants to start — as structured data, generated from today's
 * date.
 *
 * ─── WHY THE OLD LIST HAD TO GO ──────────────────────────────────────────────
 *
 * `INTAKE_TERMS` was seven hardcoded strings ("Autumn / Fall 2026" … "Later
 * than 2028") and the stored value was the string itself. Two problems, and
 * the spec names both:
 *
 * 1. It goes stale silently. In 2029 the form would still be offering 2026 as
 *    a start date, and nothing would fail — a student would just pick a past
 *    intake and the Planner would plan backwards from a date already gone.
 *    So the options are GENERATED from the current date here, and the list is
 *    correct in 2029 with no code change.
 *
 * 2. A display string cannot be matched against. "Autumn / Fall 2027" has to
 *    be parsed before anything can ask "which courses open before this?", and
 *    parsing display text is how a translated UI breaks a matching engine. So
 *    the stored shape is `{ type, season, year }`.
 *
 * ─── IT IS THE STUDENT'S PREFERENCE, NOT A UNIVERSITY'S CALENDAR ─────────────
 *
 * Universities do not share intake months, and a Vietnamese "autumn" intake
 * and a British one are not the same weeks. The month ranges below are a
 * broad, internationally legible gloss to help a student pick — not a claim
 * about any particular programme. `course_applications.intake` remains the
 * place a specific programme's published intake lives.
 */

export type IntakeSeason = 'autumn' | 'spring';

export type IntakeChoice =
  | { type: 'specific'; season: IntakeSeason; year: number }
  | { type: 'later'; afterYear: number }
  | { type: 'undecided' };

export type IntakeOption = {
  /** Stable per render, for React keys and for the selected check. */
  id: string;
  choice: IntakeChoice;
  /** e.g. "Autumn / Fall 2027". */
  label: string;
  /** e.g. "September – December 2027". */
  detail: string;
  /** A season emoji. Decorative — always `aria-hidden`, never the only cue. */
  glyph: string;
};

/**
 * Northern-hemisphere months, stated once.
 *
 * `approximateStartMonth` is what downstream timeline maths should use; the
 * printed range is for the student.
 */
const SEASONS: Record<IntakeSeason, { label: string; months: string; startMonth: number }> = {
  autumn: { label: 'Autumn / Fall', months: 'September – December', startMonth: 9 },
  spring: { label: 'Spring', months: 'January – April', startMonth: 1 },
};

/** The month a specific intake approximately begins, for timeline maths. */
export function intakeStartMonth(choice: IntakeChoice): number | null {
  return choice.type === 'specific' ? SEASONS[choice.season].startMonth : null;
}

export function intakeOptionId(choice: IntakeChoice): string {
  switch (choice.type) {
    case 'specific':
      return `${choice.season}-${choice.year}`;
    case 'later':
      return `later-${choice.afterYear}`;
    case 'undecided':
      return 'undecided';
  }
}

/**
 * The intakes to offer, from a given "today".
 *
 * ─── WHERE THE LIST STARTS ───────────────────────────────────────────────────
 *
 * An intake a student could no longer realistically apply for is noise, so the
 * first option is the next one whose start month has not already passed. The
 * month it starts in still counts as available — someone applying in
 * September for a September start is late, not impossible — but once it is
 * behind us the intake drops off. In August 2026 the list opens on Autumn
 * 2026; in October 2026 it opens on Spring 2027.
 *
 * `now` is a parameter rather than a call to `new Date()` inside, so the
 * boundary behaviour is testable rather than dependent on the day the suite
 * runs.
 */
export function generateIntakeOptions(now: Date = new Date(), academicYears = 3): IntakeOption[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const candidates: Array<{ season: IntakeSeason; year: number }> = [];
  for (let offset = 0; offset <= academicYears; offset += 1) {
    candidates.push({ season: 'spring', year: year + offset });
    candidates.push({ season: 'autumn', year: year + offset });
  }

  // Sort chronologically — spring precedes autumn within a year.
  candidates.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : SEASONS[a.season].startMonth - SEASONS[b.season].startMonth,
  );

  const upcoming = candidates.filter((candidate) => {
    if (candidate.year > year) return true;
    if (candidate.year < year) return false;
    // Same year: keep it only if its start month has not already gone by.
    return SEASONS[candidate.season].startMonth >= month;
  });

  // Two intakes a year, so `academicYears` of them, then the open-ended tail.
  const specific = upcoming.slice(0, academicYears * 2).map<IntakeOption>((candidate) => ({
    id: intakeOptionId({ type: 'specific', ...candidate }),
    choice: { type: 'specific', season: candidate.season, year: candidate.year },
    label: `${SEASONS[candidate.season].label} ${candidate.year}`,
    detail: `${SEASONS[candidate.season].months} ${candidate.year}`,
    glyph: candidate.season === 'autumn' ? '🍂' : '🌸',
  }));

  const lastYear = specific.at(-1)?.choice;
  const afterYear = lastYear && lastYear.type === 'specific' ? lastYear.year : year + academicYears;

  return [
    ...specific,
    {
      id: intakeOptionId({ type: 'later', afterYear }),
      choice: { type: 'later', afterYear },
      label: `Later than ${afterYear}`,
      detail: `Starting from ${afterYear + 1} or later`,
      glyph: '📅',
    },
    {
      id: 'undecided',
      choice: { type: 'undecided' },
      label: 'Not decided yet',
      detail: 'I’m still exploring my options',
      glyph: '❔',
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────────────
   Storage

   `student_profiles.target_intake` is a TEXT column that already holds
   display strings written by the previous form. Rather than migrate it, the
   structured choice is serialised to a compact, stable token and the reader
   understands both generations.
   ───────────────────────────────────────────────────────────────────────── */

/** `{specific, autumn, 2027}` → `"autumn-2027"`. */
export function serialiseIntake(choice: IntakeChoice): string {
  return intakeOptionId(choice);
}

/**
 * A stored value → the structured choice, or `undefined`.
 *
 * Understands three things, in order: the token this module writes, the
 * display strings the previous form wrote ("Autumn / Fall 2027", "Later than
 * 2028", "Not decided yet"), and nothing else. An unparseable value returns
 * `undefined` so the question reads as unanswered rather than as a choice the
 * picker cannot show.
 */
export function parseIntake(stored: string | null | undefined): IntakeChoice | undefined {
  const value = stored?.trim();
  if (!value) return undefined;

  if (/^undecided$/i.test(value) || /^not decided yet$/i.test(value)) return { type: 'undecided' };

  const token = /^(autumn|spring)-(\d{4})$/i.exec(value);
  if (token?.[1] && token[2]) {
    return {
      type: 'specific',
      season: token[1].toLowerCase() as IntakeSeason,
      year: Number(token[2]),
    };
  }

  const laterToken = /^later-(\d{4})$/i.exec(value);
  if (laterToken?.[1]) return { type: 'later', afterYear: Number(laterToken[1]) };

  // The previous form's display strings.
  const laterText = /^later than (\d{4})$/i.exec(value);
  if (laterText?.[1]) return { type: 'later', afterYear: Number(laterText[1]) };

  const display = /(autumn|fall|spring)\D*(\d{4})/i.exec(value);
  if (display?.[1] && display[2]) {
    const season: IntakeSeason = /spring/i.test(display[1]) ? 'spring' : 'autumn';
    return { type: 'specific', season, year: Number(display[2]) };
  }

  return undefined;
}

/**
 * The label for a stored choice, even when it is no longer on offer.
 *
 * A student who picked Autumn 2026 and comes back in 2028 must still see what
 * they chose rather than a blank control — the option list has moved on, the
 * answer has not.
 */
export function intakeLabel(choice: IntakeChoice): { label: string; detail: string; glyph: string } {
  switch (choice.type) {
    case 'specific':
      return {
        label: `${SEASONS[choice.season].label} ${choice.year}`,
        detail: `${SEASONS[choice.season].months} ${choice.year}`,
        glyph: choice.season === 'autumn' ? '🍂' : '🌸',
      };
    case 'later':
      return {
        label: `Later than ${choice.afterYear}`,
        detail: `Starting from ${choice.afterYear + 1} or later`,
        glyph: '📅',
      };
    case 'undecided':
      return { label: 'Not decided yet', detail: 'I’m still exploring my options', glyph: '❔' };
  }
}

/**
 * The options to render, with the student's stored choice guaranteed present.
 *
 * See `intakeLabel` — a choice that has aged out of the generated window is
 * prepended rather than dropped.
 */
export function intakeOptionsWith(
  selected: IntakeChoice | undefined,
  now: Date = new Date(),
): IntakeOption[] {
  const options = generateIntakeOptions(now);
  if (!selected) return options;

  const id = intakeOptionId(selected);
  if (options.some((option) => option.id === id)) return options;

  return [{ id, choice: selected, ...intakeLabel(selected) }, ...options];
}
