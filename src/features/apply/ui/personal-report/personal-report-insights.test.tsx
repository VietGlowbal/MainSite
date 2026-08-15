import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PersonalReportV2, ProofCard } from '../../domain';
import {
  CapabilityProfileView,
  FuturePathwaysView,
  GrowthMatrixView,
  MotivationProfileView,
  SocialProofSummaryView,
} from './personal-report-insights';

const NO_DATA = { reason: 'More evidence needed.', actions: [] };

function proof(overrides: Partial<ProofCard> & Pick<ProofCard, 'activityId' | 'title'>): ProofCard {
  return {
    activityId: overrides.activityId,
    title: overrides.title,
    role: null,
    personalContribution: null,
    outcome: null,
    competenciesDemonstrated: [],
    supports: [],
    evidenceStrength: 'limited',
    verificationStatus: 'stated',
    evidenceSource: null,
    evidenceRefs: [],
    ...overrides,
  };
}

function report(): PersonalReportV2 {
  return {
    generatedAt: '2026-08-15T00:00:00.000Z',
    overallEvidenceConfidence: 'medium',
    coreIdentity: {
      available: true,
      headline: 'Someone who builds practical solutions',
      interpretation: 'A builder pattern appears across several activities.',
      recurringRole: 'Builder',
      recurringBehaviours: ['Builds practical solutions'],
      valueOrientation: 'Impact',
      observations: [],
      evidenceRefs: [],
      confidence: 'medium',
      stillDeveloping: ['The pattern is still limited to a narrow scope — activities in other themes are needed.'],
      insufficientData: null,
    },
    drivingForce: {
      available: true,
      headline: 'Motivation clearly confirmed',
      explanation: 'The candidate repeatedly states a desire to improve access to education.',
      repeatedMotivations: ['Improve access to education', 'Improve access to education', 'Build useful technology'],
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
      insufficientData: NO_DATA,
    },
    emergingThemes: {
      available: true,
      themes: [
        {
          theme: 'Education technology',
          status: 'strong_emerging_theme',
          statusLabel: 'Strong emerging theme',
          explanation: 'Education technology appears across three experiences.',
          supportingExperiences: ['Tutor platform', 'Study app', 'Workshop'],
          confidence: 'high',
          limitation: 'More activities clearly linked to "Education technology" are needed for this theme to become more confident.',
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
      differentiated: true,
      coherent: true,
      directionAligned: false,
      credible: false,
      whyThisFits: [],
      whatPreventsStrongerPositioning: ['Not every element of this positioning is backed by linked evidence.'],
      confidence: 'medium',
      evidenceRefs: [],
      insufficientData: null,
    },
    proofOfMe: {
      available: true,
      cards: [
        proof({
          activityId: 'a1',
          title: 'Tutor platform',
          outcome: 'Used by 120 students',
          competenciesDemonstrated: ['Leadership', 'Product Design'],
          evidenceStrength: 'strong',
          verificationStatus: 'verified',
        }),
        proof({
          activityId: 'a2',
          title: 'Study app',
          outcome: 'Tested with 30 students',
          competenciesDemonstrated: ['Leadership', 'Product Design'],
          evidenceStrength: 'strong',
          verificationStatus: 'attributable',
        }),
        proof({
          activityId: 'a3',
          title: 'Workshop',
          outcome: 'Delivered six sessions',
          competenciesDemonstrated: ['Leadership'],
          evidenceStrength: 'moderate',
          verificationStatus: 'attributable',
        }),
      ],
      insufficientData: null,
    },
  };
}

describe('Personal Report Pass 2 insights', () => {
  it('turns repeated named capabilities into an evidence radar and star ratings', () => {
    render(<CapabilityProfileView report={report()} />);
    expect(screen.getByRole('list', { name: 'Named capability evidence profile' })).toBeInTheDocument();
    expect(screen.getByText('Leadership')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/out of 5 evidence stars/i).length).toBeGreaterThan(0);
  });

  it('shows motivation recurrence without presenting it as a personality score', () => {
    render(<MotivationProfileView report={report()} />);
    expect(screen.getByRole('list', { name: 'Repeated stated motivations' })).toBeInTheDocument();
    expect(screen.getByText(/not personality scores/i)).toBeInTheDocument();
  });

  it('summarises social proof with grounded counts', () => {
    render(<SocialProofSummaryView report={report()} />);
    expect(screen.getByText('Experiences analysed')).toBeInTheDocument();
    expect(screen.getByText('Strong evidence')).toBeInTheDocument();
    expect(screen.getByText('Quantified outcomes')).toBeInTheDocument();
  });

  it('places existing limitations into an estimated impact-effort growth matrix', () => {
    render(<GrowthMatrixView report={report()} />);
    expect(screen.getByText('Growth priority matrix')).toBeInTheDocument();
    expect(screen.getByText('Quick wins')).toBeInTheDocument();
    expect(screen.getByText(/Not every element of this positioning/i)).toBeInTheDocument();
  });

  it('renders emerging themes as possible future directions, not predictions', () => {
    render(<FuturePathwaysView report={report()} />);
    expect(screen.getByText('Possible future directions')).toBeInTheDocument();
    expect(screen.getByText('Education technology')).toBeInTheDocument();
    expect(screen.getByText(/not career predictions/i)).toBeInTheDocument();
  });
});
