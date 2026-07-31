import { describe, expect, it } from 'vitest';
import {
  filterOptions,
  isCourseUrl,
  optionsForGroup,
  programChoices,
  tidyProgrammeName,
  type CatalogueEntry,
} from '../programs';

/**
 * Values below are copied verbatim from the live database (read 2026-07-31 with
 * the service key), so a change to these rules fails against real data rather
 * than against a convenient fixture.
 */
const MIT_STRENGTHS = 'Engineering, CS, Physics, Economics, Management, Architecture, Neuroscience';
const NUS_STRENGTHS =
  'Business (NUS Business School), Law, Medicine, Engineering, CS, Life Sciences, Arts & Social Sciences';

/** Georgia Tech (university_id 104) as `catalog_programmes` actually holds it. */
const CATALOGUE: CatalogueEntry[] = [
  {
    name: 'Business Administration (MBA)',
    degree: 'Master',
    durationYears: null,
    units: [{ name: 'Scheller College of Business', isPrimary: true }],
  },
  {
    name: 'Computer Science',
    degree: 'Bachelor',
    durationYears: 4,
    units: [{ name: 'College of Computing', isPrimary: true }],
  },
  {
    name: 'Computer Science',
    degree: 'Master',
    durationYears: null,
    units: [{ name: 'College of Computing', isPrimary: true }],
  },
  {
    name: 'Civil Engineering',
    degree: 'Bachelor',
    durationYears: null,
    units: [{ name: 'College of Engineering', isPrimary: true }],
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

    // Schools sorted, so the list is stable across reloads.
    expect(choices.groups.map((group) => group.name)).toEqual([
      'College of Computing',
      'College of Engineering',
      'Scheller College of Business',
    ]);
    // The flat list is the union, so the search box can reach everything.
    expect(choices.options).toHaveLength(4);
  });

  it('keeps the same subject at two degree levels as two choices', () => {
    // Georgia Tech really does catalogue Computer Science as both. Collapsing
    // them on name would delete one of the two things the student came to pick
    // between.
    const computing = programChoices(null, CATALOGUE).groups.find(
      (group) => group.name === 'College of Computing',
    );

    expect(computing?.options.map((o) => `${o.name} (${o.degree})`)).toEqual([
      'Computer Science (Bachelor)',
      'Computer Science (Master)',
    ]);
  });

  it('lists a programme under every school that administers it', () => {
    // Joint degrees exist (Penn's, for one), and a student browsing by school
    // should find it under either.
    const choices = programChoices(null, [
      {
        name: 'Jerome Fisher M&T',
        degree: 'Bachelor',
        units: [
          { name: 'School of Engineering and Applied Science', isPrimary: true },
          { name: 'The Wharton School' },
        ],
      },
    ]);

    expect(choices.groups.map((g) => g.name)).toEqual([
      'School of Engineering and Applied Science',
      'The Wharton School',
    ]);
    // ...but only once in the flat list.
    expect(choices.options).toHaveLength(1);
  });

  it('prefers the catalogue over strengths when both are present', () => {
    const choices = programChoices(MIT_STRENGTHS, CATALOGUE);

    expect(choices.groups).toHaveLength(3);
    expect(choices.options.map((o) => o.name)).not.toContain('Engineering');
  });

  it('still offers a programme that belongs to no school', () => {
    // `academic_units` is empty on some rows. Dropping those would hide real
    // programmes; they belong in the flat list with no school heading.
    const choices = programChoices(null, [{ name: 'Liberal Arts', degree: 'Bachelor' }]);

    expect(choices.groups).toEqual([]);
    expect(choices.options.map((o) => o.name)).toEqual(['Liberal Arts']);
  });

  it('omits a duration the catalogue does not give', () => {
    // Null on 400 of 404 live rows, so this is the common path, not the edge.
    const choices = programChoices(null, [
      { name: 'Applied Economics', degree: 'Master', durationYears: null },
      { name: 'Zero Years', durationYears: 0 },
    ]);

    expect(choices.options[0]?.durationYears).toBeUndefined();
    expect(choices.options[1]?.durationYears).toBeUndefined();
  });

  it('omits a degree the catalogue does not give', () => {
    expect(programChoices(null, [{ name: 'Mystery Course' }]).options[0]?.degree).toBeUndefined();
  });

  it('returns empty lists when there is nothing to offer', () => {
    // 9 of 106 rows have no strengths. The caller must be able to tell, so it can
    // show the paste-a-link fallback on its own instead of an empty select.
    expect(programChoices(null)).toEqual({ groups: [], options: [], source: 'none' });
    expect(programChoices('   ')).toEqual({ groups: [], options: [], source: 'none' });
  });

  it('reports where the list came from', () => {
    // The picker says "collected from the university's own catalogue" over
    // crawler output and stays quiet over our own editorial subject line, so
    // this flag is what makes that claim honest.
    expect(programChoices(MIT_STRENGTHS).source).toBe('strengths');
    expect(programChoices(null, CATALOGUE).source).toBe('catalogue');
    expect(programChoices(MIT_STRENGTHS, CATALOGUE).source).toBe('catalogue');
  });

  it('tidies catalogue names but leaves strengths alone', () => {
    // `strengths` is our own editorial list — already short, and not crawled.
    const messy = programChoices(null, [
      {
        name: "Health Education, MSPH Bloomberg School of Public Health Master's Full-time",
        degree: 'Master',
        units: [{ name: 'Bloomberg School of Public Health', isPrimary: true }],
      },
    ]);
    expect(messy.options[0]?.name).toBe('Health Education, MSPH');

    expect(programChoices('Arts & Social Sciences').options[0]?.name).toBe('Arts & Social Sciences');
  });
});

/**
 * Every input below is a real `catalog_programmes.programme_name`, read
 * 2026-07-31. They are the reason this function exists: the median name is 35
 * characters and the longest is 154.
 */
describe('tidyProgrammeName', () => {
  it('leaves a name that is already just the subject', () => {
    expect(tidyProgrammeName('Applied Economics')).toBe('Applied Economics');
    expect(tidyProgrammeName('Computer Science (BS)')).toBe('Computer Science (BS)');
    expect(tidyProgrammeName('Business Administration (MBA)')).toBe('Business Administration (MBA)');
    expect(tidyProgrammeName('Civil and Environmental Engineering - Master of Science')).toBe(
      'Civil and Environmental Engineering - Master of Science',
    );
  });

  it('cuts the facet soup off the longest name in the table', () => {
    expect(
      tidyProgrammeName(
        'Health Education and Health Communication, MSPH Bloomberg School of Public Health ' +
          "Master's Full-time Part-time Bloomberg School of Public Health In-person",
        ['Bloomberg School of Public Health'],
      ),
    ).toBe('Health Education and Health Communication, MSPH');
  });

  it('peels a whole run of level words, modes and the school', () => {
    // Penn's real row, with the school it really carries. Six facets deep.
    expect(
      tidyProgrammeName(
        'Computer & Information Technology, MCIT Graduate On-Campus Professional Degree ' +
          "School of Engineering and Applied Science Master's Online/Hybrid",
        ['School of Engineering and Applied Science'],
      ),
    ).toBe('Computer & Information Technology, MCIT');
  });

  it('drops the bare credential the tail repeats', () => {
    // "… (MS) MS Masters" — the parenthesised one is the university's, the loose
    // one is an artefact of the concatenation.
    expect(tidyProgrammeName('Computer Science Courant (MS) MS Masters')).toBe(
      'Computer Science Courant (MS)',
    );
    expect(tidyProgrammeName('Physics/Computer Engineering (BS/BS) BS/BS Bachelors')).toBe(
      'Physics/Computer Engineering (BS/BS)',
    );
  });

  it('keeps a credential the university writes after a comma', () => {
    // "Applied Economics, MA" is how the catalogue states it. Stripping that
    // would lose which degree the row is for.
    expect(tidyProgrammeName('Applied Economics, MA')).toBe('Applied Economics, MA');
    expect(tidyProgrammeName('International Health, MSPH')).toBe('International Health, MSPH');
  });

  it('never returns more than a prefix of its input', () => {
    // The same invariant leadFragment carries: this shortens, it never rewrites.
    const inputs = [
      'Applied Economics',
      "Health Education, MSPH Bloomberg School of Public Health Master's Full-time",
      'Computer Science Courant (MS) MS Masters In Person Graduate Arts & Science',
      'Business Administration (MBA)',
    ];
    for (const input of inputs) {
      const normalised = input.replace(/\s+/g, ' ').trim();
      expect(normalised.startsWith(tidyProgrammeName(input, ['Bloomberg School of Public Health']))).toBe(true);
    }
  });

  it('keeps the original rather than trimming a name to nothing', () => {
    // A name that is ONLY facet words would otherwise become "".
    expect(tidyProgrammeName('Graduate Full-time Online')).toBe('Graduate Full-time Online');
    expect(tidyProgrammeName('Masters')).toBe('Masters');
  });

  /**
   * ⚠️ REGRESSION, and the reason this peels the tail instead of cutting at the
   * first facet word it finds.
   *
   * Georgia Tech catalogues all three of these. Cutting at the earliest "Online"
   * turned the first into "Computer Science" — which lost the clause that
   * distinguishes it AND made it a near-duplicate of the third, two rows below
   * it in the same list. Found by looking at the rendered picker, not by a test.
   */
  it('keeps a facet word that is part of the subject', () => {
    expect(tidyProgrammeName('Computer Science – Online Degree (MS)')).toBe(
      'Computer Science – Online Degree (MS)',
    );
    expect(tidyProgrammeName('Computer Science (MS)')).toBe('Computer Science (MS)');
    expect(tidyProgrammeName('Online Journalism')).toBe('Online Journalism');
    expect(tidyProgrammeName('Graduate Studies in Law')).toBe('Graduate Studies in Law');
  });

  it('leaves a tail it does not recognise rather than guessing', () => {
    // NYU ends its names with "Arts & Science", which is not quite any of its
    // unit names ("Graduate School of Arts and Science"). A long name is a much
    // smaller problem than a name with its meaning removed.
    const nyu = 'Computer Science Courant (MS) MS Masters In Person Graduate Arts & Science';
    expect(tidyProgrammeName(nyu)).toContain('Computer Science Courant (MS)');
  });

  it('collapses the whitespace crawled text arrives with', () => {
    expect(tidyProgrammeName('  Applied   Economics \n ')).toBe('Applied Economics');
  });
});

describe('optionsForGroup', () => {
  const choices = programChoices(null, CATALOGUE);

  it('shows every programme before a school is chosen', () => {
    // Getting this backwards renders an empty second list on first open, which
    // reads as missing data rather than as "pick a school first".
    expect(optionsForGroup(choices, null)).toHaveLength(4);
  });

  it('narrows to the chosen school', () => {
    expect(optionsForGroup(choices, 'College of Engineering').map((o) => o.name)).toEqual([
      'Civil Engineering',
    ]);
  });

  it('falls back to everything for a school that is not in the list', () => {
    expect(optionsForGroup(choices, 'College of Atlantis')).toHaveLength(4);
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

  it('does not match on the degree or the duration', () => {
    // Typing "master" should not return every postgraduate programme when the
    // student is searching for a subject called "Master…".
    const catalogued = programChoices(null, CATALOGUE).options;

    expect(filterOptions(catalogued, '4')).toEqual([]);
    expect(filterOptions(catalogued, 'Master').map((o) => o.name)).toEqual([]);
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
