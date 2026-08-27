import { describe, expect, it } from 'vitest';
import type { TargetProfile } from '@/lib/ai/target-profile/domain';
import { normalizeTargetProfile } from './criteria';

const profile: TargetProfile = {
  programme: {
    id: 'programme-1',
    name: 'BSc Data Science',
    university: 'Example University',
    level: 'Bachelor',
    subject: 'Data Science',
  },
  universityValues: ['Research-led teaching', 'research-led   teaching'],
  programmeThemes: {
    description: 'Applied, research-led learning.',
    themes: ['Applied statistics', 'Machine learning'],
  },
  requirements: [
    {
      id: 'adm-1',
      category: 'academic',
      label: 'Minimum mathematics grade',
      detail: 'Required grade B in mathematics.',
      status: 'required',
      sourceRefs: ['source:admissions'],
      missingInformation: null,
    },
    {
      id: 'comp-1',
      category: 'competency',
      label: 'Collaborative problem solving',
      detail: 'Work effectively in teams.',
      status: null,
      sourceRefs: ['source:outcomes'],
      missingInformation: null,
    },
    {
      id: 'sel-1',
      category: 'selection',
      label: 'Personal Statement',
      detail: 'Explain your academic motivation.',
      status: 'optional',
      sourceRefs: ['source:selection'],
      missingInformation: null,
    },
    {
      id: 'sel-2',
      category: 'selection',
      label: 'personal statement',
      detail: 'Describe your direction.',
      status: 'optional',
      sourceRefs: ['source:selection-2'],
      missingInformation: null,
    },
    {
      id: 'app-1',
      category: 'application',
      label: 'Portfolio',
      detail: 'Required portfolio of projects.',
      status: null,
      sourceRefs: ['source:application'],
      missingInformation: null,
    },
    {
      id: 'sch-1',
      category: 'scholarship',
      label: 'Merit scholarship',
      detail: 'Required academic distinction.',
      status: 'required',
      sourceRefs: ['source:scholarship'],
      missingInformation: null,
    },
    {
      id: 'missing-1',
      category: 'academic',
      label: 'Unstated requirement',
      detail: null,
      status: 'unknown',
      sourceRefs: [],
      missingInformation: 'The source does not publish this requirement.',
    },
  ],
  deadlines: [],
  missingInformation: [{ area: 'competency', note: 'Add examples of collaboration.' }],
  sources: [],
};

describe('normalizeTargetProfile', () => {
  it('maps target categories and keeps hard requirements separate from soft criteria', () => {
    const criteria = normalizeTargetProfile(profile);

    expect(criteria.find((criterion) => criterion.metadata.targetRequirementId === 'adm-1')).toMatchObject({
      category: 'academic_requirement',
      requirementType: 'hard',
    });
    expect(criteria.find((criterion) => criterion.metadata.targetRequirementId === 'comp-1')).toMatchObject({
      category: 'competency',
      requirementType: 'soft',
    });
    expect(criteria.find((criterion) => criterion.metadata.targetRequirementId === 'app-1')).toMatchObject({
      category: 'selection_criterion',
      requirementType: 'hard',
    });
    expect(criteria.find((criterion) => criterion.metadata.targetRequirementId === 'sch-1')).toMatchObject({
      category: 'scholarship',
      requirementType: 'hard',
    });
    expect(criteria.filter((criterion) => criterion.category === 'scholarship')).toHaveLength(1);
    expect(criteria.every((criterion) => criterion.category !== 'scholarship' || criterion.requirementType !== 'soft')).toBe(true);
  });

  it('assigns stable IDs from category and source identity, not array position', () => {
    const original = normalizeTargetProfile(profile);
    const reordered = normalizeTargetProfile({
      ...profile,
      requirements: [...profile.requirements].reverse(),
    });

    expect(reordered.map((criterion) => criterion.id).sort()).toEqual(
      original.map((criterion) => criterion.id).sort(),
    );
    expect(original.find((criterion) => criterion.metadata.targetRequirementId === 'adm-1')?.id).toContain(
      'adm-1',
    );
  });

  it('merges duplicate labels within a category and unions provenance', () => {
    const criteria = normalizeTargetProfile(profile);
    const statements = criteria.filter(
      (criterion) => criterion.category === 'selection_criterion' && criterion.label.toLowerCase() === 'personal statement',
    );

    expect(statements).toHaveLength(1);
    expect(statements[0]?.sourceRefs).toEqual(['source:selection', 'source:selection-2']);
  });

  it('defaults unknown importance without inventing a criterion from missingInformation', () => {
    const criteria = normalizeTargetProfile(profile);
    const optional = criteria.find((criterion) => criterion.metadata.targetRequirementId === 'sel-1');
    const missing = criteria.find((criterion) => criterion.metadata.targetRequirementId === 'missing-1');

    expect(optional).toMatchObject({
      importance: 'medium',
      metadata: { importanceSource: 'default' },
    });
    expect(missing?.sourceRefs).toEqual([]);
    expect(criteria.some((criterion) => criterion.label.includes('Add examples'))).toBe(false);
  });

  it('keeps values and themes separate with explicit source text but no fabricated source IDs', () => {
    const criteria = normalizeTargetProfile(profile);
    const value = criteria.find((criterion) => criterion.category === 'programme_value');
    const theme = criteria.find((criterion) => criterion.category === 'academic_preparation');

    expect(value).toMatchObject({
      requirementType: 'preference',
      sourceRefs: [],
      sourceText: 'Research-led teaching',
      metadata: { targetRequirementId: null, importanceSource: 'default' },
    });
    expect(theme).toMatchObject({
      requirementType: 'soft',
      sourceRefs: [],
      sourceText: 'Applied statistics',
    });
    expect(value?.id).not.toContain('source');
  });

  it('normalizes expected signals from labels and details', () => {
    const criterion = normalizeTargetProfile(profile).find(
      (item) => item.metadata.targetRequirementId === 'adm-1',
    );

    expect(criterion?.expectedSignals).toEqual(
      expect.arrayContaining(['minimum', 'mathematics', 'grade', 'required']),
    );
  });
});
