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
import { KeyTakeawaysView } from './key-takeaways';
import { ProofOfMeView } from './proof-of-me';

const NO_DATA = { reason: 'More evidence needed.', actions: [] };

function proof({
  activityId,
  title,
  ...overrides
}: Partial<ProofCard> & Pick<ProofCard, 'activityId' | 'title'>): ProofCard {
  return {
    activityId,
    title,
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
          personalContribution: 'Led a five-person team',
          outcome: 'Used by 120 students',
          period: '2023–2025',
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
    expect(screen.getAllByText('Leadership').length).toBeGreaterThan(0);
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
    expect(screen.getByText('Team members led')).toBeInTheDocument();
    expect(screen.getByText('Community reach')).toBeInTheDocument();
    expect(screen.getByText('Years of commitment')).toBeInTheDocument();
  });

  it('renders the stored key-takeaway reasoning graph instead of hiding its grounding', () => {
    const current = report();
    current.keyTakeaways = {
      whatMakesYouStandOut: {
        kind: 'takeaway',
        statement: 'Grounded standout',
        scope: 'repeated',
        strength: 'strong',
        confidence: 'high',
        evidenceIds: ['e1', 'e2'],
        limitations: [],
        importance: 'This matters because it is repeated across activities.',
      },
      competitiveAdvantage: {
        kind: 'competitive_advantage',
        statement: 'Grounded advantage',
        scope: 'repeated',
        strength: 'moderate',
        confidence: 'medium',
        evidenceIds: ['e1'],
        limitations: [],
      },
      growthOpportunity: {
        kind: 'growth_area',
        statement: 'Grounded growth',
        scope: 'insufficient',
        strength: 'weak',
        confidence: 'low',
        evidenceIds: [],
        limitations: ['Needs more evidence.'],
        currentGap: 'Needs more evidence.',
        direction: 'Add one specific outcome.',
      },
    };
    render(<KeyTakeawaysView report={current} />);
    expect(screen.getByText('Grounded standout')).toBeInTheDocument();
    expect(screen.getAllByText('Evidence basis:').length).toBe(3);
    expect(screen.getByText('This matters because it is repeated across activities.')).toBeInTheDocument();
    expect(screen.getByText('Add one specific outcome.')).toBeInTheDocument();
  });

  it('renders every structured AI takeaway field without mixing in legacy prose', () => {
    const current = report();
    current.narrativeDetails = {
      keyTakeaways: {
        whatMakesYouStandOut: {
          title: 'Structured standout title',
          insight: 'Structured standout insight',
          evidencePattern: 'Structured standout evidence pattern',
          whyItMatters: 'Structured standout importance',
          evidenceIds: ['e1'],
        },
        competitiveAdvantage: {
          title: 'Structured advantage title',
          advantageStatement: 'Structured advantage statement',
          supportingEvidence: 'Structured advantage evidence',
          applicationRelevance: 'Structured advantage relevance',
          evidenceIds: ['e1'],
        },
        growthOpportunity: {
          title: 'Structured growth title',
          growthArea: 'Structured growth area',
          currentGap: 'Structured current gap',
          recommendedDirection: 'Structured recommendation',
          whyItMatters: 'Structured growth importance',
          evidenceIds: ['e1'],
        },
      },
    };

    render(<KeyTakeawaysView report={current} />);
    for (const text of [
      'Structured standout insight', 'Structured standout evidence pattern', 'Structured standout importance',
      'Structured advantage statement', 'Structured advantage evidence', 'Structured advantage relevance',
      'Structured growth area', 'Structured current gap', 'Structured recommendation', 'Structured growth importance',
    ]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('Grounded standout')).not.toBeInTheDocument();
  });

  it('surfaces social-proof metadata on each evidence card', () => {
    const current = report();
    current.proofOfMe.cards[0] = proof({
      activityId: 'a1',
      title: 'Tutor platform',
      organisation: 'Example Org',
      level: 'National',
      year: 2024,
      period: '2023–2024',
      competition: 'Education Challenge',
      sources: [{ id: 'doc-1' }],
    });
    render(
      <ProofOfMeView
        section={current.proofOfMe}
        evidenceSummary={undefined}
        overallSummary={null}
        returnTo={undefined}
      />,
    );
    expect(screen.getByText('Example Org')).toBeInTheDocument();
    expect(screen.getByText('National')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('2023–2024')).toBeInTheDocument();
    expect(screen.getByText('Education Challenge')).toBeInTheDocument();
    expect(screen.getByText(/Supporting documents:/)).toBeInTheDocument();
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
