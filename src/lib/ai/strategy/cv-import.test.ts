import { describe, expect, it } from 'vitest';
import { normaliseDraft, sectionsFromProfile } from './cv-import';

/**
 * Model output is untrusted input, and these tests treat it that way. The cases
 * are the ones a real model actually produces: a plausible field on the wrong kind
 * of section, an entry that is entirely empty, a confidence flag naming a field
 * that does not exist.
 */
describe('normaliseDraft', () => {
  it('reads a well-formed response', () => {
    const draft = normaliseDraft({
      sections: [
        {
          kind: 'education',
          entries: [
            {
              organization: 'Hanoi University of Science',
              role: 'BSc Computer Science',
              startDate: 'Sep 2022',
              endDate: 'Jun 2026',
              bullets: ['GPA 3.8', 'Dean’s list 2024'],
              uncertainFields: ['endDate'],
            },
          ],
        },
      ],
      notes: [],
    });

    expect(draft.sections).toHaveLength(1);
    const entry = draft.sections[0]?.entries[0];
    expect(entry?.organization).toBe('Hanoi University of Science');
    expect(entry?.bullets).toHaveLength(2);
    expect(draft.uncertain[entry?.id ?? '']).toEqual(['endDate']);
  });

  /**
   * A start date on a skills entry is a field the editor has no input for, so it
   * would be invisible and unremovable. Dropped at the boundary instead.
   */
  it('drops fields that are not relevant to the section kind', () => {
    const draft = normaliseDraft({
      sections: [
        {
          kind: 'skills',
          entries: [
            { organization: 'Should be dropped', startDate: '2024', bullets: ['Python', 'SQL'] },
          ],
        },
      ],
    });

    const entry = draft.sections[0]?.entries[0];
    expect(entry?.bullets).toEqual(['Python', 'SQL']);
    expect(entry?.organization).toBeUndefined();
    expect(entry?.startDate).toBeUndefined();
  });

  it('drops entries with no content rather than making the student delete them', () => {
    const draft = normaliseDraft({
      sections: [
        {
          kind: 'experience',
          entries: [
            { organization: '', role: '', bullets: [] },
            { role: 'Intern', bullets: ['Did the thing'] },
          ],
        },
      ],
    });

    expect(draft.sections[0]?.entries).toHaveLength(1);
    expect(draft.sections[0]?.entries[0]?.role).toBe('Intern');
  });

  it('drops sections left empty once their entries are filtered', () => {
    const draft = normaliseDraft({
      sections: [{ kind: 'awards', entries: [{ bullets: [] }] }],
    });
    expect(draft.sections).toEqual([]);
  });

  it('ignores a confidence flag naming a field the section does not have', () => {
    const draft = normaliseDraft({
      sections: [
        { kind: 'skills', entries: [{ bullets: ['Python'], uncertainFields: ['startDate', 'bullets'] }] },
      ],
    });
    const entry = draft.sections[0]?.entries[0];
    // 'startDate' is not a skills field; 'bullets' is.
    expect(draft.uncertain[entry?.id ?? '']).toEqual(['bullets']);
  });

  it('falls back to a custom section for an unknown kind', () => {
    const draft = normaliseDraft({
      sections: [{ kind: 'hobbies_and_pets', title: 'Hobbies', entries: [{ role: 'Chess', bullets: [] }] }],
    });
    expect(draft.sections[0]?.kind).toBe('custom');
    expect(draft.sections[0]?.title).toBe('Hobbies');
  });

  it('survives garbage without throwing', () => {
    for (const raw of [{}, { sections: null }, { sections: 'nope' }, { sections: [null, 3, 'x'] }]) {
      expect(() => normaliseDraft(raw as Record<string, unknown>)).not.toThrow();
      expect(normaliseDraft(raw as Record<string, unknown>).sections).toEqual([]);
    }
  });

  it('gives every entry a unique id', () => {
    const draft = normaliseDraft({
      sections: [
        {
          kind: 'experience',
          entries: [{ role: 'A', bullets: ['x'] }, { role: 'B', bullets: ['y'] }],
        },
      ],
    });
    const ids = draft.sections[0]?.entries.map((e) => e.id) ?? [];
    expect(new Set(ids).size).toBe(2);
  });
});

describe('sectionsFromProfile', () => {
  it('always produces contact and education, so the CV has a spine', () => {
    const sections = sectionsFromProfile({ achievements: [], activities: [], academics: null });
    expect(sections.map((s) => s.kind)).toEqual(['contact', 'education']);
  });

  it('maps achievements to awards, keeping the recorded level as evidence', () => {
    const sections = sectionsFromProfile({
      achievements: [
        { title: 'Maths Olympiad', competition: 'VMO', year: 2025, level: 'National', detail: 'Silver medal' },
      ],
      activities: [],
      academics: null,
    });

    const awards = sections.find((s) => s.kind === 'awards');
    const entry = awards?.entries[0];
    expect(entry?.role).toBe('Maths Olympiad');
    expect(entry?.organization).toBe('VMO');
    expect(entry?.startDate).toBe('2025');
    // The level was recorded by the student, so it is confirmed evidence rather
    // than a claim we generated.
    expect(entry?.evidence).toBe('National');
    expect(entry?.bullets).toEqual(['Silver medal']);
  });

  it('maps activities with their period', () => {
    const sections = sectionsFromProfile({
      achievements: [],
      activities: [{ title: 'Robotics club', organisation: 'School', period: '2023–2025', description: 'Led the team' }],
      academics: null,
    });

    const entry = sections.find((s) => s.kind === 'activities')?.entries[0];
    expect(entry?.role).toBe('Robotics club');
    expect(entry?.organization).toBe('School');
    expect(entry?.startDate).toBe('2023–2025');
  });

  it('splits a multi-line academic background into bullets', () => {
    const sections = sectionsFromProfile({
      achievements: [],
      activities: [],
      academics: 'IB Diploma, 42 points\nHL Maths 7, HL Physics 7\n',
    });

    const entry = sections.find((s) => s.kind === 'education')?.entries[0];
    expect(entry?.bullets).toEqual(['IB Diploma, 42 points', 'HL Maths 7, HL Physics 7']);
  });

  it('does not invent an empty awards section when there are no achievements', () => {
    const sections = sectionsFromProfile({ achievements: [], activities: [], academics: 'IB' });
    expect(sections.some((s) => s.kind === 'awards')).toBe(false);
  });
});
