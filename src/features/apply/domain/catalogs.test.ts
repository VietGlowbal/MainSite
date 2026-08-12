import { describe, expect, it } from 'vitest';
import {
  DESTINATIONS,
  POPULAR_DESTINATIONS,
  destinationFlag,
  destinationIdsFromStored,
  searchDestinations,
} from './destination-catalog';
import {
  OTHER_SUBJECT_ID,
  SELECTABLE_SUBJECTS,
  SUBJECTS,
  searchSubjects,
  subjectById,
} from './subject-catalog';

describe('subject catalogue', () => {
  it('has unique, stable-looking ids', () => {
    const ids = SUBJECTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(/^[a-z0-9-]+$/);
  });

  it('covers far more than the six computing subjects it replaced', () => {
    // The old list came from a computing-dominated discovery taxonomy; a
    // student wanting Nursing or Politics had nothing to click.
    expect(SUBJECTS.length).toBeGreaterThan(40);
    for (const label of ['Nursing', 'Law', 'Politics', 'Music', 'Agriculture']) {
      expect(SUBJECTS.some((s) => s.label === label), label).toBe(true);
    }
  });

  it('covers every group named in the spec', () => {
    const groups = new Set(SUBJECTS.map((s) => s.group));
    for (const group of [
      'Computing & Technology',
      'Business',
      'Science',
      'Health',
      'Engineering',
      'Humanities & Social Sciences',
      'Creative',
      'Other areas',
    ]) {
      expect(groups.has(group as never), group).toBe(true);
    }
  });

  it('gives every subject an icon', () => {
    for (const subject of SUBJECTS) expect(subject.icon, subject.label).toBeTruthy();
  });

  it('excludes Other from the selectable list', () => {
    // "Select all" must not tick the free-text escape hatch.
    expect(SELECTABLE_SUBJECTS.some((s) => s.id === OTHER_SUBJECT_ID)).toBe(false);
    expect(SELECTABLE_SUBJECTS.length).toBe(SUBJECTS.length - 1);
  });

  it('resolves an id back to its subject', () => {
    expect(subjectById('software-engineering')?.label).toBe('Software Engineering');
    expect(subjectById('not-a-subject')).toBeUndefined();
  });
});

describe('searchSubjects', () => {
  const finds = (query: string, id: string) => searchSubjects(query).some((s) => s.id === id);

  it('matches the spec’s worked examples', () => {
    expect(finds('software', 'software-engineering')).toBe(true);
    expect(finds('computer', 'computer-science')).toBe(true);
    expect(finds('medicine', 'medicine')).toBe(true);
    expect(finds('business', 'business-management')).toBe(true);
  });

  it('understands the abbreviations students actually type', () => {
    expect(finds('CS', 'computer-science')).toBe(true);
    expect(finds('AI', 'artificial-intelligence')).toBe(true);
    expect(finds('IT', 'information-technology')).toBe(true);
    expect(finds('maths', 'mathematics')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(finds('SOFTWARE', 'software-engineering')).toBe(true);
    expect(finds('cs', 'computer-science')).toBe(true);
  });

  it('ranks a prefix match above a substring one', () => {
    // "eco" should offer Economics before Environmental Science.
    const results = searchSubjects('eco');
    const economics = results.findIndex((s) => s.id === 'economics');
    const environmental = results.findIndex((s) => s.id === 'environmental-science');
    expect(economics).toBeGreaterThanOrEqual(0);
    if (environmental >= 0) expect(economics).toBeLessThan(environmental);
  });

  it('returns everything, including Other, for an empty query', () => {
    expect(searchSubjects('')).toHaveLength(SUBJECTS.length);
  });

  it('does not offer Other as the answer to a specific search', () => {
    // Suggesting "Other" for "marine robotics" tells the student nothing —
    // the empty state offers to add their words instead.
    expect(searchSubjects('marine robotics')).toHaveLength(0);
    expect(finds('psych', OTHER_SUBJECT_ID)).toBe(false);
  });
});

describe('destination catalogue', () => {
  it('covers every country, not only the mock-up’s tiles', () => {
    expect(DESTINATIONS.length).toBeGreaterThan(190);
  });

  it('leads with the popular study destinations, in the design’s order', () => {
    expect(POPULAR_DESTINATIONS[0]?.id).toBe('GB');
    expect(POPULAR_DESTINATIONS.map((d) => d.id).slice(0, 5)).toEqual([
      'GB',
      'US',
      'CA',
      'AU',
      'NZ',
    ]);
  });

  it('orders everything after the popular block alphabetically', () => {
    const rest = DESTINATIONS.slice(POPULAR_DESTINATIONS.length).map((d) => d.name);
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    expect(rest).toEqual(sorted);
  });

  it('has unique ids and a flag for each', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const destination of DESTINATIONS) {
      expect(destinationFlag(destination.id), destination.name).not.toBe('');
    }
  });

  it('gives every destination a non-empty name', () => {
    for (const destination of DESTINATIONS) {
      expect(destination.name, destination.id).toBeTruthy();
    }
  });
});

describe('searchDestinations', () => {
  const finds = (query: string, id: string) => searchDestinations(query).some((d) => d.id === id);

  it('matches every alias the spec calls out by name', () => {
    expect(finds('UK', 'GB')).toBe(true);
    expect(finds('Britain', 'GB')).toBe(true);
    expect(finds('USA', 'US')).toBe(true);
    expect(finds('America', 'US')).toBe(true);
    expect(finds('UAE', 'AE')).toBe(true);
    expect(finds('Korea', 'KR')).toBe(true);
  });

  it('matches the plain country name too', () => {
    expect(finds('United Kingdom', 'GB')).toBe(true);
    expect(finds('Japan', 'JP')).toBe(true);
    expect(finds('viet', 'VN')).toBe(true);
  });

  it('returns everything for an empty query, popular first', () => {
    const all = searchDestinations('');
    expect(all).toHaveLength(DESTINATIONS.length);
    expect(all[0]?.id).toBe('GB');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchDestinations('zzzzzzzz')).toHaveLength(0);
  });
});

describe('destinationIdsFromStored', () => {
  it('reads ISO codes straight through', () => {
    expect(destinationIdsFromStored(['GB', 'SG'])).toEqual(['GB', 'SG']);
  });

  it('reads the display names the previous form wrote', () => {
    // The column holds two generations of value. A student who answered under
    // the old form must not silently lose their destinations.
    expect(destinationIdsFromStored(['United Kingdom', 'Japan'])).toEqual(['GB', 'JP']);
  });

  it('handles a mixture of both', () => {
    expect(destinationIdsFromStored(['GB', 'Singapore'])).toEqual(['GB', 'SG']);
  });

  it('drops anything that resolves to neither', () => {
    // A phantom id the grid cannot render is worse than an absent one.
    expect(destinationIdsFromStored(['Atlantis', 'ZZ', ''])).toEqual([]);
  });

  it('de-duplicates', () => {
    expect(destinationIdsFromStored(['GB', 'United Kingdom', 'gb'])).toEqual(['GB']);
  });

  it('is empty for nothing stored', () => {
    expect(destinationIdsFromStored(null)).toEqual([]);
    expect(destinationIdsFromStored(undefined)).toEqual([]);
    expect(destinationIdsFromStored([])).toEqual([]);
  });
});
