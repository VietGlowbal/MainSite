import { describe, expect, it } from 'vitest';
import {
  CV_BUILDER_LEGACY_SCHEMA_VERSION,
  CV_BUILDER_SCHEMA_VERSION,
  CV_BUILDER_V2_SCHEMA_VERSION,
  cvBuilderDraftKey,
  restoreCvBuilderDraft,
  type CvBuilderFormV1,
} from './cv-builder';

const form: CvBuilderFormV1 = {
  personal: { fullName: 'Alex Nguyen', email: 'alex@example.com', links: [] },
  education: [
    {
      id: 'edu-1',
      institution: 'Example School',
      qualification: 'A-levels',
      details: [],
    },
  ],
  entries: [],
  awards: [],
  skillGroups: [],
};

const unavailable = {
  text: 'Not enough data',
  status: 'unavailable' as const,
  sourceRefs: [],
};
const validTargetProfile = (strategyProvenance: {
  version: 1;
  recommendationId: string;
  createdAt: string;
  selectedDirection?: string;
}) => ({
  universityName: 'Example University',
  programmeName: 'Computer Science',
  universityDna: {
    positioning: unavailable,
    educationalPhilosophy: unavailable,
    environment: unavailable,
    studentSignals: [unavailable],
  },
  programmeDna: {
    objectives: [unavailable],
    modules: [unavailable],
    learningOutcomes: [unavailable],
    competencies: [unavailable],
    entrySignals: [unavailable],
  },
  careerAlignment: [unavailable],
  evidenceSignals: Array.from({ length: 5 }, (_, index) => ({
    id: `S00${index + 1}`,
    label: `Signal ${index + 1}`,
    description: 'The CV needs to prove this signal with concrete evidence.',
    evidenceExamples: ['A concrete example from the applicant'],
    sourceRefs: ['course:subject'],
  })),
  keywords: ['Builder', 'Analytical', 'Collaborative'],
  confidence: 'low' as const,
  limitations: [],
  strategyProvenance,
});

describe('CV Builder draft v3 migration', () => {
  it('preserves v1 form/template while discarding old AI output', () => {
    const restored = restoreCvBuilderDraft(
      {
        schemaVersion: CV_BUILDER_LEGACY_SCHEMA_VERSION,
        applicationId: 'app-1',
        form,
        selectedTemplate: 'technical',
        targetProfile: { legacy: true },
        generatedCv: { legacy: true },
      },
      'app-1',
      'rec-current',
    );
    expect(restored).toMatchObject({
      schemaVersion: CV_BUILDER_SCHEMA_VERSION,
      form,
      selectedTemplate: 'technical',
    });
    expect(restored).not.toHaveProperty('targetProfile');
    expect(restored).not.toHaveProperty('generatedCv');
  });

  it('restores v3 AI only when recommendation and selected direction match current F7', () => {
    const draft = {
      schemaVersion: CV_BUILDER_SCHEMA_VERSION,
      applicationId: 'app-1',
      sourceRecommendationId: 'rec-current',
      selectedDirection: 'Accessible systems builder',
      targetProfile: validTargetProfile({
        version: 1,
        recommendationId: 'rec-current',
        createdAt: '2026-08-15T00:00:00.000Z',
        selectedDirection: 'Accessible systems builder',
      }),
      form,
      selectedTemplate: 'academic' as const,
      generatedCv: { plainText: 'AI CV' },
    };
    expect(
      restoreCvBuilderDraft(draft, 'app-1', {
        version: 1,
        recommendationId: 'rec-current',
        createdAt: '2026-08-15T00:00:00.000Z',
        selectedDirection: 'Accessible systems builder',
      }),
    ).toMatchObject({ sourceRecommendationId: 'rec-current', generatedCv: draft.generatedCv });
    expect(restoreCvBuilderDraft(draft, 'app-1', 'rec-new')).toMatchObject({
      form,
      selectedTemplate: 'academic',
    });
    expect(
      restoreCvBuilderDraft(draft, 'app-1', 'rec-new'),
    ).not.toHaveProperty('generatedCv');
  });

  it('discards all AI output when the outer id matches but nested provenance is missing or stale', () => {
    const current = {
      version: 1,
      recommendationId: 'rec-current',
      createdAt: '2026-08-15T00:00:00.000Z',
    } as const;
    const base = {
      schemaVersion: CV_BUILDER_SCHEMA_VERSION,
      applicationId: 'app-1',
      sourceRecommendationId: current.recommendationId,
      selectedDirection: 'Accessible systems builder',
      form,
      selectedTemplate: 'technical' as const,
      generatedCv: { plainText: 'AI CV' },
    };

    for (const targetProfile of [
      undefined,
      validTargetProfile({
        version: 1,
        recommendationId: 'rec-other',
        createdAt: current.createdAt,
        selectedDirection: 'Accessible systems builder',
      }),
      validTargetProfile({
        version: 1,
        recommendationId: current.recommendationId,
        createdAt: '2026-08-14T00:00:00.000Z',
        selectedDirection: 'Accessible systems builder',
      }),
    ]) {
      const restored = restoreCvBuilderDraft(
        {
          ...base,
          ...(targetProfile ? { targetProfile } : {}),
        },
        'app-1',
        current,
      );
      expect(restored).toMatchObject({ form, selectedTemplate: 'technical' });
      expect(restored).not.toHaveProperty('targetProfile');
      expect(restored).not.toHaveProperty('generatedCv');
    }
  });

  it('discards AI from a v2 draft even when its old provenance matches', () => {
    const restored = restoreCvBuilderDraft(
      {
        schemaVersion: CV_BUILDER_V2_SCHEMA_VERSION,
        applicationId: 'app-1',
        sourceRecommendationId: 'rec-current',
        targetProfile: validTargetProfile({
          version: 1,
          recommendationId: 'rec-current',
          createdAt: '2026-08-15T00:00:00.000Z',
          selectedDirection: 'Accessible systems builder',
        }),
        form,
        generatedCv: { plainText: 'old AI CV' },
        selectedTemplate: 'academic',
      },
      'app-1',
      {
        version: 1,
        recommendationId: 'rec-current',
        createdAt: '2026-08-15T00:00:00.000Z',
        selectedDirection: 'Accessible systems builder',
      },
    );
    expect(restored).toMatchObject({ form, selectedTemplate: 'academic' });
    expect(restored).not.toHaveProperty('generatedCv');
    expect(restored).not.toHaveProperty('targetProfile');
  });

  it('keeps the existing localStorage key for v2 drafts', () => {
    expect(cvBuilderDraftKey('user-1', 'app-1')).toBe(
      'glowbal:cv-builder:v1:user-1:app-1',
    );
  });
});
