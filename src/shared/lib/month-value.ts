/**
 * A year-and-month as a sortable token — `"2027-09"`.
 *
 * ─── WHY A TOKEN AND NOT "Sep 2027" ─────────────────────────────────────────
 *
 * `student_profiles.target_intake` is a TEXT column that used to be filled by a
 * free-text box ("e.g. Sep 2027"), so it holds whatever students typed. The
 * month picker that replaced that box needs one canonical shape to write, and
 * the same argument `features/apply/domain/intake.ts` already makes applies
 * here: a display string cannot be matched against, and this UI is bilingual —
 * the day the field renders "Th9 2027" for a Vietnamese session, a column full
 * of display strings stops being one thing. `YYYY-MM` also sorts correctly as
 * plain text, which is what any "which intakes are still ahead?" query needs.
 *
 * So: `YYYY-MM` is what gets stored, `formatMonthValue` is what gets shown, and
 * `toMonthValue` is the one-way ramp off everything that was typed before.
 *
 * Pure string maths, deliberately — no `Date`. Constructing a `Date` from a
 * year and a month drags in the runtime's timezone, and "September 2027"
 * becoming August for a student in UTC-7 is exactly the class of bug this
 * module exists to avoid.
 */

export type MonthParts = { year: number; month: number };

/**
 * Structurally the `Lang` union from `@/lib/i18n`, redeclared rather than
 * imported: that module is a React client component, and nothing in this file
 * may pull in a framework. Callers pass their `lang` straight through.
 */
export type MonthLang = 'en' | 'vi';

/** Trigger labels and the picker grid. Index 0 is January. */
export const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Accessible names, and the long display form. Index 0 is January. */
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/* ─────────────────────────────────────────────────────────────────────────
   Vietnamese

   ⚠️ NOT AUTOMATIC, AND THAT IS THE POINT. `/profile` and `/ai-strategy` are
   on `PII_ROUTE_PREFIXES` in `src/lib/dom-translate.tsx`, so the whole-page
   translator runs there WITHOUT the network: it can only substitute strings
   that are already exact keys in the static dictionary. A label built at
   runtime — "Sep 2027" — is never such a key, so a month formatted in English
   here would stay English for a Vietnamese student no matter what is added to
   `i18n-dictionary.ts`. Hence the second set of names and the `lang` argument.

   The forms below are a judgment call, made in one place so the owner can
   change them in one place: "Th9" in the picker's twelve-cell grid, where a
   full "Tháng 9" would not fit three to a row, and "Tháng 9/2027" wherever a
   chosen intake is read as a value.
   ───────────────────────────────────────────────────────────────────────── */

const MONTH_ABBREVIATIONS_VI = [
  'Th1',
  'Th2',
  'Th3',
  'Th4',
  'Th5',
  'Th6',
  'Th7',
  'Th8',
  'Th9',
  'Th10',
  'Th11',
  'Th12',
] as const;

const MONTH_NAMES_VI = MONTH_ABBREVIATIONS_VI.map(
  (_, index) => `Tháng ${index + 1}`,
) as readonly string[];

/** The month names to draw a control with, for a language. */
export function monthLabels(lang: MonthLang = 'en'): {
  abbreviations: readonly string[];
  names: readonly string[];
} {
  return lang === 'vi'
    ? { abbreviations: MONTH_ABBREVIATIONS_VI, names: MONTH_NAMES_VI }
    : { abbreviations: MONTH_ABBREVIATIONS, names: MONTH_NAMES };
}

/**
 * Bounds on the year, wide on purpose.
 *
 * A sanity check against a malformed stored value, not a product rule about
 * how far ahead a student may plan — that is the picker's `min`/`max`.
 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function isValidParts(year: number, month: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= 12
  );
}

/** `(2027, 9)` → `"2027-09"`. Returns `''` for anything out of range. */
export function monthValue(year: number, month: number): string {
  if (!isValidParts(year, month)) return '';
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** A canonical token → its parts. Anything else is `null`. */
export function parseMonthValue(value: string | null | undefined): MonthParts | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value?.trim() ?? '');
  if (!match?.[1] || !match[2]) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return isValidParts(year, month) ? { year, month } : null;
}

/**
 * A month named in words, if the text contains one.
 *
 * Whole-word equality rather than a `/dec/` style regex, because the stored
 * column contains "Not decided yet" — written by the reflection flow's
 * undecided option — and a prefix match reads December out of "decided".
 */
function monthFromWords(text: string): number | null {
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const index = MONTH_NAMES.findIndex((name) => {
      const lower = name.toLowerCase();
      // "Sept" is the one common abbreviation that is neither the full name
      // nor the three-letter form.
      return lower === word || lower.slice(0, 3) === word || (word === 'sept' && lower === 'september');
    });
    if (index >= 0) return index + 1;
  }
  return null;
}

/**
 * Whatever was stored → a canonical token, or `''` when it names no month.
 *
 * Understands the token itself, the display strings the old free-text box
 * collected ("Sep 2027", "September 2027"), and the numeric forms students
 * type ("09/2027", "2027/9", "Tháng 9 2027" — the Vietnamese word carries no
 * digits of its own, so the numeric fallback catches it).
 *
 * `''` for a value that is not a month at all ("Not decided yet", "Autumn /
 * Fall 2027") — the caller decides what to do with an answer the picker cannot
 * represent. See the `hint` the profile forms pass.
 */
export function toMonthValue(raw: string | null | undefined): string {
  const text = raw?.trim() ?? '';
  if (!text) return '';

  const canonical = parseMonthValue(text);
  if (canonical) return monthValue(canonical.year, canonical.month);

  // The four-digit run is the year; everything else is a candidate month.
  const yearMatch = /\d{4}/.exec(text);
  if (!yearMatch) return '';
  const year = Number(yearMatch[0]);

  const named = monthFromWords(text);
  if (named !== null) return monthValue(year, named);

  const rest = `${text.slice(0, yearMatch.index)} ${text.slice(yearMatch.index + 4)}`;
  const numeric = /\d{1,2}/.exec(rest);
  if (!numeric) return '';

  return monthValue(year, Number(numeric[0]));
}

/**
 * `"2027-09"` → `"Sep 2027"`, or `"September 2027"` when `style` is `long`.
 *
 * In Vietnamese: `"Tháng 9/2027"` and `"Tháng 9 năm 2027"`. The joiner differs
 * per language rather than being a shared `${month} ${year}` template, because
 * "Tháng 9 2027" is not how the date is written.
 */
export function formatMonthValue(
  value: string | null | undefined,
  style: 'short' | 'long' = 'short',
  lang: MonthLang = 'en',
): string {
  const parts = parseMonthValue(value);
  if (!parts) return '';

  if (lang === 'vi') {
    return style === 'long'
      ? `Tháng ${parts.month} năm ${parts.year}`
      : `Tháng ${parts.month}/${parts.year}`;
  }

  const names = style === 'long' ? MONTH_NAMES : MONTH_ABBREVIATIONS;
  return `${names[parts.month - 1] ?? ''} ${parts.year}`;
}

/**
 * The month `now` falls in, read in UTC.
 *
 * `now` is a parameter rather than a `new Date()` inside, for the same reason
 * `generateIntakeOptions` takes one: the "you cannot pick a month that has
 * already gone" boundary has to be testable on a fixed date.
 *
 * UTC, and not the local calendar, for the same reason that function reads UTC
 * — plus one this side of the app cares about more. A control whose floor comes
 * from the local clock computes one month on the server and, for the seven
 * hours of ICT that fall in the previous UTC day, a different one in the
 * browser; the two renders then disagree and React reports a hydration error.
 * Reading UTC on both sides makes them agree by construction.
 */
export function currentMonthValue(now: Date = new Date()): string {
  return monthValue(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/** Move a token by whole months, forwards or backwards. */
export function shiftMonthValue(value: string, delta: number): string {
  const parts = parseMonthValue(value);
  if (!parts) return '';
  const zeroBased = parts.year * 12 + (parts.month - 1) + delta;
  return monthValue(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
}

/**
 * Hold a token inside `[min, max]`.
 *
 * Plain string comparison is correct here and is why the token is zero-padded:
 * `"2027-09" < "2027-10"` sorts the same way the months do.
 */
export function clampMonthValue(value: string, min: string, max: string): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}
