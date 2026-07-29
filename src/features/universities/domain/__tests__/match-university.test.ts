import { describe, expect, it } from 'vitest';
import {
  normaliseUniversityName,
  pickBestMatch,
  registrableDomain,
  sameDomain,
  type UniversityCandidate,
} from '../match-university';

describe('normaliseUniversityName', () => {
  it('collapses the ways one institution gets written', () => {
    const canonical = 'university toronto';
    expect(normaliseUniversityName('University of Toronto')).toBe(canonical);
    expect(normaliseUniversityName('The University of Toronto')).toBe(canonical);
    expect(normaliseUniversityName('UNIVERSITY  OF  TORONTO')).toBe(canonical);
    expect(normaliseUniversityName('University of Toronto.')).toBe(canonical);
  });

  it('drops a trailing acronym in brackets', () => {
    expect(normaliseUniversityName('Massachusetts Institute of Technology (MIT)')).toBe(
      normaliseUniversityName('Massachusetts Institute of Technology'),
    );
  });

  it('strips Vietnamese diacritics, including the đ that NFD leaves alone', () => {
    // đ/Đ is its own letter, not a composition, so a diacritic strip after NFD
    // does not touch it. The audience types these names daily.
    expect(normaliseUniversityName('Đại học Bách khoa Hà Nội')).toBe('dai hoc bach khoa ha noi');
    expect(normaliseUniversityName('Trường Đại học Kinh tế')).toBe('truong dai hoc kinh te');
  });

  it('treats & and "and" as the same word', () => {
    expect(normaliseUniversityName('Agriculture & Technology')).toBe(
      normaliseUniversityName('Agriculture and Technology'),
    );
  });

  it('is empty for a name with no identifying content', () => {
    expect(normaliseUniversityName('   ')).toBe('');
    expect(normaliseUniversityName('the of at')).toBe('');
  });
});

describe('registrableDomain', () => {
  it('drops subdomains', () => {
    expect(registrableDomain('https://future.utoronto.ca/apply')).toBe('utoronto.ca');
    expect(registrableDomain('https://www.utoronto.ca/')).toBe('utoronto.ca');
    expect(registrableDomain('https://gradstudies.someuni.edu/x/y')).toBe('someuni.edu');
  });

  it('keeps the third label under a registry-operated suffix', () => {
    // The failure this guards: taking the last two labels collapses every
    // British university to "ac.uk", which then matches all of them together.
    expect(registrableDomain('https://www.ox.ac.uk/courses/law')).toBe('ox.ac.uk');
    expect(registrableDomain('https://study.unimelb.edu.au/find')).toBe('unimelb.edu.au');
    expect(registrableDomain('https://hust.edu.vn/vi/')).toBe('hust.edu.vn');
    expect(registrableDomain('https://www.nus.edu.sg/')).toBe('nus.edu.sg');
  });

  it('returns null for things that are not resolvable hosts', () => {
    expect(registrableDomain('not a url')).toBeNull();
    expect(registrableDomain('https://192.168.0.1/course')).toBeNull();
    expect(registrableDomain('https://localhost/course')).toBeNull();
  });
});

describe('sameDomain', () => {
  it('compares a URL against a bare stored domain', () => {
    expect(sameDomain('https://future.utoronto.ca/x', 'utoronto.ca')).toBe(true);
    expect(sameDomain('https://future.utoronto.ca/x', 'https://www.utoronto.ca')).toBe(true);
    expect(sameDomain('https://ox.ac.uk/x', 'cam.ac.uk')).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(sameDomain(null, 'utoronto.ca')).toBe(false);
    expect(sameDomain('https://utoronto.ca', undefined)).toBe(false);
  });
});

const TORONTO: UniversityCandidate = {
  id: 1,
  name: 'University of Toronto',
  country: 'Canada',
  primary_domain: 'utoronto.ca',
};
const OXFORD: UniversityCandidate = {
  id: 2,
  name: 'University of Oxford',
  country: 'United Kingdom',
  primary_domain: 'ox.ac.uk',
};

describe('pickBestMatch', () => {
  it('finds nothing in an empty directory', () => {
    expect(pickBestMatch([], { name: 'University of Toronto' })).toBeNull();
  });

  it('trusts the domain above everything else', () => {
    const match = pickBestMatch([OXFORD, TORONTO], {
      // A name that would otherwise miss entirely.
      name: 'U of T',
      courseUrl: 'https://future.utoronto.ca/courses/cmp1',
    });
    expect(match).toEqual({ id: 1, name: 'University of Toronto', reason: 'domain', confidence: 1 });
  });

  it('falls back to the hand-maintained website lookup for a row with no stored domain', () => {
    const noDomain: UniversityCandidate = { id: 3, name: 'University of Toronto', country: 'Canada' };
    const match = pickBestMatch([noDomain], {
      name: 'Something else entirely',
      courseUrl: 'https://future.utoronto.ca/x',
      knownDomainFor: (name) => (name === 'University of Toronto' ? 'https://utoronto.ca' : null),
    });
    expect(match?.reason).toBe('domain');
  });

  it('matches on the normalised name when there is no usable domain', () => {
    const match = pickBestMatch([OXFORD, TORONTO], { name: 'The University of Toronto' });
    expect(match?.id).toBe(1);
    expect(match?.reason).toBe('exact-name');
  });

  it('accepts a containment match and reports it as weaker', () => {
    const campus: UniversityCandidate = {
      id: 4,
      name: 'University of Toronto Scarborough',
      country: 'Canada',
    };
    const match = pickBestMatch([campus], {
      name: 'University of Toronto',
      country: 'Canada',
    });
    expect(match?.id).toBe(4);
    expect(match?.reason).toBe('contained-name');
    expect(match?.confidence).toBeLessThan(0.9);
  });

  it('refuses a containment match when the countries disagree', () => {
    // Several institutions share a name across borders; a shared prefix is not
    // enough to attach a student to another country's entry requirements.
    const elsewhere: UniversityCandidate = {
      id: 5,
      name: 'University of Toronto Overseas',
      country: 'Australia',
    };
    expect(
      pickBestMatch([elsewhere], { name: 'University of Toronto', country: 'Canada' }),
    ).toBeNull();
  });

  it('will not match on a single shared word', () => {
    // "University" alone is not evidence. Without this floor, every unmatched
    // paste would attach itself to whichever university sorted first.
    expect(pickBestMatch([TORONTO], { name: 'University' })).toBeNull();
    expect(pickBestMatch([TORONTO], { name: 'Toronto Film School' })).toBeNull();
  });

  it('returns null rather than guessing when nothing is close', () => {
    expect(
      pickBestMatch([TORONTO, OXFORD], {
        name: 'Hanoi University of Science and Technology',
        courseUrl: 'https://hust.edu.vn/course',
        country: 'Vietnam',
      }),
    ).toBeNull();
  });

  it('does not match on the domain suffix alone', () => {
    // Guards the compound-suffix rule end to end: Oxford and Cambridge share
    // "ac.uk" and must not resolve to each other.
    expect(
      pickBestMatch([OXFORD], {
        name: 'University of Cambridge',
        courseUrl: 'https://www.cam.ac.uk/courses/law',
      }),
    ).toBeNull();
  });

  it('needs a name once the domain misses', () => {
    expect(pickBestMatch([TORONTO], { courseUrl: 'https://unknown.example/x' })).toBeNull();
    expect(pickBestMatch([TORONTO], { name: '   ' })).toBeNull();
  });
});
