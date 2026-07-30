import { describe, expect, it } from 'vitest';
import {
  filterOptions,
  isCourseUrl,
  optionsForGroup,
  programChoices,
  type CatalogueCollege,
} from '../programs';

/**
 * `strengths` values below are copied verbatim from the live rows (read
 * 2026-07-30 with the service key), so a change to the splitting rules fails
 * against real data rather than against a convenient fixture.
 */
const MIT_STRENGTHS = 'Engineering, CS, Physics, Economics, Management, Architecture, Neuroscience';
const NUS_STRENGTHS =
  'Business (NUS Business School), Law, Medicine, Engineering, CS, Life Sciences, Arts & Social Sciences';

/** Structurally what `vinuniColleges` provides. */
const CATALOGUE: CatalogueCollege[] = [
  {
    name: 'College of Business and Management',
    programs: [{ name: 'Bachelor of Business Administration', durationYears: 4 }],
  },
  {
    name: 'College of Health Sciences',
    programs: [
      { name: 'Doctor of Medicine', durationYears: 6 },
      { name: 'Bachelor of Nursing', durationYears: 4 },
    ],
  },
];

describe('programChoices', () => {
  it('falls back to the strengths line when there is no catalogue', () => {
    const choices = programChoices(MIT_STRENGTHS);

    expect(choices.groups).toEqual([]);
    expect(choices.options.map((option) => option.name)).toEqual([
      'Engineering',
      'CS',
      'Physics',
      'Economics',
      'Management',
      'Architecture',
      'Neuroscience',
    ]);
  });

  it('never invents a duration for a strengths-derived option', () => {
    const choices = programChoices(MIT_STRENGTHS);

    for (const option of choices.options) {
      expect(option.durationYears).toBeUndefined();
    }
  });

  it('keeps a subject that contains a bracket or an ampersand whole', () => {
    // The reason splitList splits on commas only. Shredding these would offer a
    // student "Business (NUS Business School" and "Arts & Social Sciences" as
    // two separate things.
    const names = programChoices(NUS_STRENGTHS).options.map((option) => option.name);

    expect(names).toContain('Business (NUS Business School)');
    expect(names).toContain('Arts & Social Sciences');
  });

  it('builds the frame\u2019s two lists from a real catalogue', () => {
    const choices = programChoices(null, CATALOGUE);

    expect(choices.groups.map((group) => group.name)).toEqual([
      'College of Business and Management',
      'College of Health Sciences',
    ]);
    // The flat list is the union, so the search box can reach everything.
    expect(choices.options).toHaveLength(3);
    expect(choices.options.find((o) => o.name === 'Doctor of Medicine')?.durationYears).toBe(6);
  });

  it('prefers the catalogue over strengths when both are present', () => {
    const choices = programChoices(MIT_STRENGTHS, CATALOGUE);

    expect(choices.groups).toHaveLength(2);
    expect(choices.options.map((o) => o.name)).not.toContain('Engineering');
  });

  it('drops a school with no programmes rather than showing an empty heading', () => {
    const choices = programChoices(null, [
      { name: 'College of Nothing', programs: [] },
      ...CATALOGUE,
    ]);

    expect(choices.groups.map((group) => group.name)).not.toContain('College of Nothing');
  });

  it('omits a duration the catalogue does not give', () => {
    const choices = programChoices(null, [
      { name: 'College of X', programs: [{ name: 'Bachelor of X', durationYears: 0 }] },
    ]);

    expect(choices.options[0]?.durationYears).toBeUndefined();
  });

  it('returns empty lists when there is nothing to offer', () => {
    // 9 of 106 rows have no strengths. The caller must be able to tell, so it can
    // show the paste-a-link fallback on its own instead of an empty select.
    expect(programChoices(null)).toEqual({ groups: [], options: [] });
    expect(programChoices('   ')).toEqual({ groups: [], options: [] });
  });
});

describe('optionsForGroup', () => {
  const choices = programChoices(null, CATALOGUE);

  it('shows every programme before a school is chosen', () => {
    // Getting this backwards renders an empty second list on first open, which
    // reads as missing data rather than as "pick a school first".
    expect(optionsForGroup(choices, null)).toHaveLength(3);
  });

  it('narrows to the chosen school', () => {
    expect(optionsForGroup(choices, 'College of Health Sciences').map((o) => o.name)).toEqual([
      'Doctor of Medicine',
      'Bachelor of Nursing',
    ]);
  });

  it('falls back to everything for a school that is not in the list', () => {
    expect(optionsForGroup(choices, 'College of Atlantis')).toHaveLength(3);
  });
});

describe('filterOptions', () => {
  const options = programChoices(MIT_STRENGTHS).options;

  it('matches case-insensitively on a substring', () => {
    expect(filterOptions(options, 'econ').map((o) => o.name)).toEqual(['Economics']);
    expect(filterOptions(options, 'ARCH').map((o) => o.name)).toEqual(['Architecture']);
  });

  it('is a substring match, so a two-letter query is broad', () => {
    // Pinned rather than "fixed": "cs" really is inside "Physics" and
    // "Economics". A prefix- or word-boundary match would hide "CS" itself
    // behind a query for "computer", which is worse for a subject list where the
    // stored spellings are abbreviations.
    expect(filterOptions(options, 'CS').map((o) => o.name)).toEqual([
      'CS',
      'Physics',
      'Economics',
    ]);
  });

  it('returns everything for a blank query', () => {
    expect(filterOptions(options, '   ')).toHaveLength(options.length);
  });

  it('does not match on the duration', () => {
    // Typing "4" would otherwise select most of a catalogue.
    const catalogued = programChoices(null, CATALOGUE).options;

    expect(filterOptions(catalogued, '4')).toEqual([]);
  });
});

describe('isCourseUrl', () => {
  it('accepts a real course page', () => {
    expect(isCourseUrl('https://vinuni.edu.vn/programs/bba/')).toBe(true);
    expect(isCourseUrl('  http://example.ac.uk/course/123  ')).toBe(true);
  });

  it('rejects a scheme that is not http(s)', () => {
    // The stored value is rendered as an href, so this is the security-relevant
    // case, not a tidiness one.
    expect(isCourseUrl('javascript:alert(1)')).toBe(false);
    expect(isCourseUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isCourseUrl('file:///c:/secrets.txt')).toBe(false);
  });

  it('rejects anything that is not a URL at all', () => {
    expect(isCourseUrl('')).toBe(false);
    expect(isCourseUrl('   ')).toBe(false);
    expect(isCourseUrl('Business Administration')).toBe(false);
    expect(isCourseUrl('example.com/course')).toBe(false);
  });

  it('rejects a host with no domain in it', () => {
    // `new URL` is more forgiving than a course page: 'http:///course'
    // normalises to 'http://course/' rather than failing, so requiring a dot is
    // what actually turns these away.
    expect(isCourseUrl('http:///course')).toBe(false);
    expect(isCourseUrl('http://localhost:3000/programs')).toBe(false);
  });
});
