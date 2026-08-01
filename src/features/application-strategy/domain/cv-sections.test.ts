import { describe, expect, it } from 'vitest';
import {
  CV_SECTION_KINDS,
  SECTION_FIELDS,
  countEntries,
  defaultSections,
  emptySection,
  essentialGaps,
  isOptionalSection,
  isRenameableSection,
  reorder,
  sectionTitle,
  sectionUsesField,
  structuredCvPatchSchema,
} from './cv-sections';
import type { CvSection } from './types';

function withEntries(kind: CvSection['kind'], bullets: string[][]): CvSection {
  return {
    id: `s-${kind}`,
    kind,
    entries: bullets.map((b, i) => ({ id: `${kind}-${i}`, bullets: b })),
  };
}

describe('section field relevance', () => {
  it('covers every section kind', () => {
    for (const kind of CV_SECTION_KINDS) {
      expect(SECTION_FIELDS[kind], kind).toBeDefined();
      expect(SECTION_FIELDS[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it('does not offer dates or an organisation on a skills entry', () => {
    expect(sectionUsesField('skills', 'startDate')).toBe(false);
    expect(sectionUsesField('skills', 'organization')).toBe(false);
    expect(sectionUsesField('skills', 'bullets')).toBe(true);
  });

  it('offers the full dated shape on education and experience', () => {
    for (const field of ['organization', 'role', 'startDate', 'endDate', 'current'] as const) {
      expect(sectionUsesField('education', field), field).toBe(true);
      expect(sectionUsesField('experience', field), field).toBe(true);
    }
  });

  it('only links profile items on the sections a profile item could come from', () => {
    expect(sectionUsesField('experience', 'linkedProfileItem')).toBe(true);
    expect(sectionUsesField('activities', 'linkedProfileItem')).toBe(true);
    expect(sectionUsesField('awards', 'linkedProfileItem')).toBe(true);
    expect(sectionUsesField('contact', 'linkedProfileItem')).toBe(false);
    expect(sectionUsesField('interests', 'linkedProfileItem')).toBe(false);
  });
});

describe('removal and renaming rules', () => {
  it('refuses to make contact or education optional', () => {
    expect(isOptionalSection('contact')).toBe(false);
    expect(isOptionalSection('education')).toBe(false);
  });

  it('allows everything else to be removed', () => {
    for (const kind of CV_SECTION_KINDS) {
      if (kind === 'contact' || kind === 'education') continue;
      expect(isOptionalSection(kind), kind).toBe(true);
    }
  });

  it('only allows a custom section to be renamed', () => {
    expect(isRenameableSection('custom')).toBe(true);
    for (const kind of CV_SECTION_KINDS) {
      if (kind === 'custom') continue;
      expect(isRenameableSection(kind), kind).toBe(false);
    }
  });

  it('ignores a title set on a non-renameable section', () => {
    // Belt and braces: even if a title reaches the row, the catalogue label wins,
    // so a stale or imported title cannot relabel Education as something else.
    expect(sectionTitle({ kind: 'education', title: 'My schooling' })).toBe('Education');
    expect(sectionTitle({ kind: 'custom', title: 'Languages' })).toBe('Languages');
    expect(sectionTitle({ kind: 'custom', title: null })).toBe('Custom section');
  });
});

describe('reorder', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item down and up', () => {
    expect(reorder(items, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
    expect(reorder(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('returns the list unchanged for a no-op or an out-of-range move', () => {
    // "Move the first item up" is a real click on a real button, and the correct
    // response is nothing at all.
    expect(reorder(items, 0, -1)).toEqual(items);
    expect(reorder(items, 3, 4)).toEqual(items);
    expect(reorder(items, 2, 2)).toEqual(items);
    expect(reorder(items, -1, 0)).toEqual(items);
  });

  it('does not mutate the input', () => {
    const original = [...items];
    reorder(items, 0, 2);
    expect(items).toEqual(original);
  });
});

describe('essentialGaps', () => {
  it('names every gap for an empty CV', () => {
    const gaps = essentialGaps(defaultSections());
    expect(gaps.some((g) => g.includes('contact'))).toBe(true);
    expect(gaps.some((g) => g.includes('education'))).toBe(true);
    expect(gaps.some((g) => g.includes('experience'))).toBe(true);
  });

  it('is empty for a CV with contact, education and experience filled in', () => {
    const sections: CvSection[] = [
      withEntries('contact', [['name@example.com']]),
      withEntries('education', [['Studied maths']]),
      withEntries('experience', [['Built a thing']]),
    ];
    expect(essentialGaps(sections)).toEqual([]);
  });

  it('counts entries that have no description', () => {
    const sections: CvSection[] = [
      withEntries('contact', [['name@example.com']]),
      withEntries('education', [['Studied maths']]),
      withEntries('experience', [[''], ['   ']]),
    ];
    const gaps = essentialGaps(sections);
    expect(gaps.some((g) => g.includes('2 entries have no description'))).toBe(true);
  });

  it('accepts activities or projects in place of work experience', () => {
    const sections: CvSection[] = [
      withEntries('contact', [['name@example.com']]),
      withEntries('education', [['Studied maths']]),
      withEntries('projects', [['Built a thing']]),
    ];
    expect(essentialGaps(sections)).toEqual([]);
  });
});

describe('construction helpers', () => {
  it('starts a contact section with one entry and other sections empty', () => {
    expect(emptySection('contact').entries).toHaveLength(1);
    expect(emptySection('experience').entries).toHaveLength(0);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => emptySection('projects').id));
    expect(ids.size).toBe(50);
  });

  it('counts entries across sections', () => {
    expect(countEntries([withEntries('education', [['a'], ['b']]), withEntries('skills', [['c']])])).toBe(3);
  });
});

describe('structuredCvPatchSchema', () => {
  it('accepts a well-formed patch', () => {
    const result = structuredCvPatchSchema.safeParse({
      sections: [{ id: 's1', kind: 'education', entries: [{ id: 'e1', bullets: ['Studied'] }] }],
      selectedLayout: 'academic',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown section kind', () => {
    const result = structuredCvPatchSchema.safeParse({
      sections: [{ id: 's1', kind: 'hobbies', entries: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown layout', () => {
    expect(structuredCvPatchSchema.safeParse({ selectedLayout: 'creative' }).success).toBe(false);
  });

  it('accepts clearing the layout', () => {
    expect(structuredCvPatchSchema.safeParse({ selectedLayout: null }).success).toBe(true);
  });
});
