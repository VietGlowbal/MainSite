import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersonalReportV2 } from '../../domain';
import {
  PersonalCanvasView,
  type PersonalCanvasSectionKey,
} from './personal-canvas';
import { PersonalCanvasWorkspace } from './personal-canvas-workspace';

const NOT_AVAILABLE = {
  reason: 'Not enough evidence yet.',
  actions: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

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
      observations: ['Takes an active role in shaping practical responses.'],
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
    proofOfMe: {
      available: true,
      cards: [
        {
          activityId: 'activity-1',
          title: 'Birmingham Project Award',
          role: 'Team lead',
          personalContribution: 'Led a team to complete the project.',
          outcome: 'Won the Birmingham Project Award.',
          competenciesDemonstrated: ['Team Leadership'],
          supports: ['Core Identity'],
          evidenceStrength: 'strong',
          verificationStatus: 'attributable',
          evidenceSource: 'Birmingham Project Award',
          evidenceRefs: [],
        },
      ],
      insufficientData: null,
    },
    analytics: {
      competencyEvidenceProfile: [
        {
          key: 'hard',
          label: 'Hard-skill specificity',
          score: 80,
          confidence: 'medium',
          evidenceRefs: [],
        },
        {
          key: 'soft',
          label: 'Soft-skill specificity',
          score: 70,
          confidence: 'medium',
          evidenceRefs: [],
        },
      ],
      narrativeIdentitySignals: [
        {
          key: 'patternConsistency',
          label: 'Pattern consistency',
          score: 62,
          confidence: 'medium',
          evidenceRefs: [],
        },
      ],
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
  it('renders all six Personal Canvas areas as interactive controls without the old intro block', () => {
    const onSelect = vi.fn();

    render(
      <PersonalCanvasView
        report={report()}
        activeSection={null}
        onSelect={onSelect}
      />,
    );

    expect(
      screen.queryByText('Your applicant profile, in six connected parts'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Start with the whole picture/i),
    ).not.toBeInTheDocument();

    const labels = [
      'Core Identity',
      'Driving Forces',
      'Proven Capabilities',
      'Social Proof',
      'Areas for Growth',
      'Long-Term Vision',
    ];

    for (const label of labels) {
      expect(
        screen.getAllByRole('button', { name: new RegExp(label, 'i') }).length,
      ).toBeGreaterThan(0);
    }

    fireEvent.click(screen.getAllByRole('button', { name: /social proof/i })[0]!);
    expect(onSelect).toHaveBeenCalledWith('socialProof' satisfies PersonalCanvasSectionKey);
  });

  it('marks the selected Canvas section as active', () => {
    render(
      <PersonalCanvasView
        report={report()}
        activeSection="coreIdentity"
        onSelect={() => undefined}
      />,
    );

    expect(screen.getAllByRole('button', { name: /core identity/i })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('PersonalCanvasWorkspace', () => {
  it('opens a contextual detail panel, has no sound toggle, and animates closed', async () => {
    render(
      <PersonalCanvasWorkspace
        report={report()}
        returnTo={undefined}
        onRegenerate={undefined}
      />,
    );

    expect(screen.queryByRole('button', { name: /sounds/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /social proof/i })[0]!);

    expect(
      screen.getByRole('complementary', { name: /social proof details/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /focus this section/i })).toContainHTML('<svg');

    fireEvent.click(screen.getByRole('button', { name: /close section/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole('complementary', { name: /social proof details/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('captures new supporting evidence inside an insufficient Canvas section and regenerates', async () => {
    const withGap = report();
    withGap.coreIdentity = {
      ...withGap.coreIdentity,
      available: false,
      headline: null,
      interpretation: null,
      recurringRole: null,
      recurringBehaviours: [],
      valueOrientation: null,
      insufficientData: {
        reason: 'A second experience is needed to establish a recurring pattern.',
        actions: [
          {
            kind: 'add_activity',
            label: 'Add another activity or achievement',
            href: '/ai-strategy/reflection/achievements',
          },
        ],
      },
    };

    const onRegenerate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalCanvasWorkspace
        report={withGap}
        returnTo={undefined}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /core identity/i })[0]!);
    expect(screen.getByText('More evidence needed')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add another activity or achievement' }),
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'I organised a peer mentoring programme and matched 18 students with mentors.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & update report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai-strategy/personal-report/evidence',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onRegenerate).toHaveBeenCalledWith('supplement_answer');
    });
  });
});
