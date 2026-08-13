import { describe, expect, it } from 'vitest';
import {
  generateIntakeOptions,
  intakeOptionsWith,
  intakeStartMonth,
  parseIntake,
  serialiseIntake,
  type IntakeChoice,
} from './intake';

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('generateIntakeOptions', () => {
  it('generates from today rather than from a hardcoded year', () => {
    // The whole point: in 2029 the form must not still be offering 2026.
    const in2029 = generateIntakeOptions(at('2029-03-01'));
    const years = in2029
      .map((o) => (o.choice.type === 'specific' ? o.choice.year : null))
      .filter((y): y is number => y !== null);

    expect(years.every((y) => y >= 2029)).toBe(true);
    expect(in2029.some((o) => o.label.includes('2026'))).toBe(false);
  });

  it('offers the next intake that has not already started', () => {
    // August 2026: Autumn 2026 (September) is still ahead.
    const august = generateIntakeOptions(at('2026-08-01'));
    expect(august[0]?.label).toBe('Autumn / Fall 2026');

    // October 2026: autumn has begun, so Spring 2027 leads.
    const october = generateIntakeOptions(at('2026-10-15'));
    expect(october[0]?.label).toBe('Spring 2027');
  });

  it('keeps an intake available through the month it starts in', () => {
    // Applying in September for a September start is late, not impossible —
    // and a student mid-application must not watch their choice disappear.
    const september = generateIntakeOptions(at('2026-09-20'));
    expect(september[0]?.label).toBe('Autumn / Fall 2026');
  });

  it('lists intakes in chronological order', () => {
    const options = generateIntakeOptions(at('2026-01-01')).filter(
      (o) => o.choice.type === 'specific',
    );
    const keys = options.map((o) =>
      o.choice.type === 'specific'
        ? o.choice.year * 100 + (o.choice.season === 'spring' ? 1 : 9)
        : 0,
    );
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  it('always ends with Later and Not decided yet', () => {
    const options = generateIntakeOptions(at('2026-05-01'));
    expect(options.at(-2)?.choice.type).toBe('later');
    expect(options.at(-1)?.choice.type).toBe('undecided');
  });

  it('points Later at the year after the last specific intake', () => {
    const options = generateIntakeOptions(at('2026-01-01'));
    const specific = options.filter((o) => o.choice.type === 'specific');
    const last = specific.at(-1)?.choice;
    const later = options.at(-2)?.choice;
    expect(last?.type).toBe('specific');
    expect(later?.type).toBe('later');
    if (last?.type === 'specific' && later?.type === 'later') {
      expect(later.afterYear).toBe(last.year);
    }
  });

  it('gives every option a label, a detail and a glyph', () => {
    for (const option of generateIntakeOptions(at('2026-05-01'))) {
      expect(option.label, option.id).toBeTruthy();
      expect(option.detail, option.id).toBeTruthy();
      expect(option.glyph, option.id).toBeTruthy();
    }
  });

  it('names autumn so both hemispheres recognise it', () => {
    const options = generateIntakeOptions(at('2026-01-01'));
    expect(options.some((o) => o.label.startsWith('Autumn / Fall'))).toBe(true);
  });
});

describe('serialise / parse', () => {
  const cases: IntakeChoice[] = [
    { type: 'specific', season: 'autumn', year: 2027 },
    { type: 'specific', season: 'spring', year: 2030 },
    { type: 'later', afterYear: 2028 },
    { type: 'undecided' },
  ];

  it('round-trips every shape', () => {
    for (const choice of cases) {
      expect(parseIntake(serialiseIntake(choice)), JSON.stringify(choice)).toEqual(choice);
    }
  });

  it('still understands the display strings the previous form stored', () => {
    // The column holds two generations. Dropping the old ones would quietly
    // unanswer the question for everyone who had already filled it in.
    expect(parseIntake('Autumn / Fall 2027')).toEqual({
      type: 'specific',
      season: 'autumn',
      year: 2027,
    });
    expect(parseIntake('Spring 2028')).toEqual({ type: 'specific', season: 'spring', year: 2028 });
    expect(parseIntake('Later than 2028')).toEqual({ type: 'later', afterYear: 2028 });
    expect(parseIntake('Not decided yet')).toEqual({ type: 'undecided' });
  });

  it('reads a bare "Fall 2027" as autumn', () => {
    expect(parseIntake('Fall 2027')).toEqual({ type: 'specific', season: 'autumn', year: 2027 });
  });

  it('treats an unreadable value as unanswered', () => {
    // Better a blank question than a control showing a choice it cannot offer.
    expect(parseIntake('sometime soon')).toBeUndefined();
    expect(parseIntake('')).toBeUndefined();
    expect(parseIntake(null)).toBeUndefined();
    expect(parseIntake(undefined)).toBeUndefined();
  });
});

describe('intakeStartMonth', () => {
  it('gives downstream timeline maths a month to count back from', () => {
    expect(intakeStartMonth({ type: 'specific', season: 'autumn', year: 2027 })).toBe(9);
    expect(intakeStartMonth({ type: 'specific', season: 'spring', year: 2027 })).toBe(1);
  });

  it('has no month for the open-ended answers', () => {
    expect(intakeStartMonth({ type: 'later', afterYear: 2028 })).toBeNull();
    expect(intakeStartMonth({ type: 'undecided' })).toBeNull();
  });
});

describe('intakeOptionsWith', () => {
  it('keeps a stored choice that has aged out of the window', () => {
    // A student who picked Autumn 2026 and returns in 2029 must still see
    // what they chose, not an empty control.
    const stored: IntakeChoice = { type: 'specific', season: 'autumn', year: 2026 };
    const options = intakeOptionsWith(stored, at('2029-03-01'));

    expect(options[0]?.id).toBe('autumn-2026');
    expect(options[0]?.label).toBe('Autumn / Fall 2026');
  });

  it('does not duplicate a choice that is already on offer', () => {
    const stored: IntakeChoice = { type: 'specific', season: 'spring', year: 2027 };
    const options = intakeOptionsWith(stored, at('2026-10-01'));
    expect(options.filter((o) => o.id === 'spring-2027')).toHaveLength(1);
  });

  it('is just the generated list when nothing is stored', () => {
    const now = at('2026-05-01');
    expect(intakeOptionsWith(undefined, now)).toEqual(generateIntakeOptions(now));
  });
});
