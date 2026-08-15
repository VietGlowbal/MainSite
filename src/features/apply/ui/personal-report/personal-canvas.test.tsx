import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PersonalReportV2 } from '../../domain';
import { PersonalCanvasView, PERSONAL_REPORT_SECTION_IDS } from './personal-canvas';

const NOT_AVAILABLE = {
  reason: 'Not enough evidence yet.',
  actions: [],
};

function report(): PersonalReportV2 {
  return {
    generatedAt: '2026-08-15T00:00:00.000Z',
    overallEvidenceConfidence: 'medium',
    coreIdentity: {
      available: true,
      headline: 'Someone who builds practical solutions',
      interpretation: 'A recurring builder pattern.',
      recurringRole: 'Builder',
      recurringBehaviours: ['Builds practical solutions'],
      valueOrientation: 'Impact',
      observations: [],
      evidenceRefs: [],
      confidence: 'medium',
      stillDeveloping: [],
      insufficientData: null,
    },
    drivingForce: {
      available: true,
      headline: 'Motivation clearly confirmed',
      explanation: 'Impact and learning recur.',
      repeatedMotivations: ['Impact', 'Learning'],
      evidenceRefs: [],
      confidence: 'medium',
      isHypothesis: false,
      missingPersonalGrounding: null,
      reflectionPrompt: null,
      insufficientData: null,
    },
    signaturePattern: {
      available: false,
      steps: [],
      patternStrength: 'insufficient',
      supportingExperienceCount: 1,
      confidence: 'low',
      distinctiveness: null,
      evidenceRefs: [],
      insufficientData: NOT_AVAILABLE,
    },
    emergingThemes: {
      available: true,
      themes: [
        {
          theme: 'Education',
          status: 'strong_emerging_theme',
          statusLabel: 'Strong emerging theme',
          explanation: 'Education recurs.',
          supportingExperiences: ['Tutoring'],
          confidence: 'medium',
          limitation: 'Needs more contexts.',
          evidenceRefs: [],
        },
      ],
      insufficientData: null,
    },
    personalPositioning: {
      available: true,
      statement: 'An impact-oriented builder.',
      positioningStatus: 'emerging_positioning',
      authentic: true,
      differentiated: false,
      coherent: true,
      directionAligned: true,
      credible: true,
      whyThisFits: [],
      whatPreventsStrongerPositioning: ['Needs broader evidence.'],
      confidence: 'medium',
      evidenceRefs: [],
      insufficientData: null,
    },
    proofOfMe: { available: false, cards: [], insufficientData: NOT_AVAILABLE },
    analytics: {
      competencyEvidenceProfile: [
        { key: 'hard', label: 'Hard-skill specificity', score: 80, confidence: 'medium', evidenceRefs: [] },
        { key: 'soft', label: 'Soft-skill specificity', score: 70, confidence: 'medium', evidenceRefs: [] },
      ],
      narrativeIdentitySignals: [],
      signaturePatternSupport: [],
      themeMaturity: [],
      positioningDimensions: [],
      evidenceSummary: {
        totalItems: 6,
        verification: { verified: 1, attributable: 2, stated: 3 },
        strength: { strong: 2, moderate: 3, limited: 1 },
        competencyClaims: { hard: 2, soft: 2, meta: 1 },
      },
    },
  };
}

describe('PersonalCanvasView', () => {
  it('links all six Personal Canvas areas to their report sections', () => {
    render(<PersonalCanvasView report={report()} />);

    const targets = [
      ['Core Identity', PERSONAL_REPORT_SECTION_IDS.coreIdentity],
      ['Driving Forces', PERSONAL_REPORT_SECTION_IDS.drivingForces],
      ['Proven Capabilities', PERSONAL_REPORT_SECTION_IDS.provenCapabilities],
      ['Social Proof', PERSONAL_REPORT_SECTION_IDS.socialProof],
      ['Areas for Growth', PERSONAL_REPORT_SECTION_IDS.areasForGrowth],
      ['Long-Term Vision', PERSONAL_REPORT_SECTION_IDS.longTermVision],
    ] as const;

    for (const [label, id] of targets) {
      expect(screen.getAllByRole('link', { name: new RegExp(label, 'i') })[0]).toHaveAttribute('href', `#${id}`);
    }
  });
});
