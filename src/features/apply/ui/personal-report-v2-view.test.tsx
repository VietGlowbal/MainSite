import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersonalReportV2 } from '../domain';
import { PersonalReportV2View } from './personal-report-v2-view';

afterEach(() => {
  vi.unstubAllGlobals();
});

const NOT_AVAILABLE = {
  available: false as const,
  insufficientData: { reason: 'Not enough evidence yet.', actions: [] },
};

function reportWithDrivingForceGap(): PersonalReportV2 {
  return {
    generatedAt: '2026-08-14T00:00:00.000Z',
    overallEvidenceConfidence: 'low',
    coreIdentity: {
      available: false,
      headline: null,
      interpretation: null,
      recurringRole: null,
      recurringBehaviours: [],
      valueOrientation: null,
      observations: [],
      evidenceRefs: [],
      confidence: 'low',
      stillDeveloping: [],
      insufficientData: NOT_AVAILABLE.insufficientData,
    },
    drivingForce: {
      available: false,
      headline: null,
      explanation: null,
      repeatedMotivations: [],
      evidenceRefs: [],
      confidence: 'low',
      isHypothesis: false,
      missingPersonalGrounding: null,
      reflectionPrompt: null,
      insufficientData: {
        reason: 'Not enough activities or clearly stated motivations exist yet.',
        actions: [
          {
            kind: 'answer_reflection_question',
            label: 'Explain why you are interested in these subjects',
            href: '/ai-strategy/reflection',
            fieldKey: 'study_motivation',
          },
        ],
      },
    },
    signaturePattern: {
      available: false,
      steps: [],
      patternStrength: 'insufficient',
      supportingExperienceCount: 0,
      confidence: 'low',
      distinctiveness: null,
      evidenceRefs: [],
      insufficientData: NOT_AVAILABLE.insufficientData,
    },
    emergingThemes: { available: false, themes: [], insufficientData: NOT_AVAILABLE.insufficientData },
    personalPositioning: {
      available: false,
      statement: null,
      positioningStatus: 'insufficient_data',
      authentic: false,
      differentiated: false,
      coherent: false,
      directionAligned: false,
      credible: false,
      whatPreventsStrongerPositioning: [],
      confidence: 'low',
      evidenceRefs: [],
      insufficientData: NOT_AVAILABLE.insufficientData,
    },
    proofOfMe: { available: false, cards: [], insufficientData: NOT_AVAILABLE.insufficientData },
  };
}

function fetchMockFor(overrides: { versions?: unknown[] } = {}) {
  return vi.fn().mockImplementation((url: string) => {
    if (url === '/api/ai-strategy/personal-report/supplement') {
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    }
    if (url === '/api/ai-strategy/personal-report') {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            reportV2: reportWithDrivingForceGap(),
            cached: false,
            versionId: 'v2',
            generatedAt: '2026-08-14T01:00:00.000Z',
          }),
          { status: 200 },
        ),
      );
    }
    if (url === '/api/ai-strategy/personal-report/versions') {
      return Promise.resolve(
        new Response(JSON.stringify({ versions: overrides.versions ?? [] }), { status: 200 }),
      );
    }
    if (typeof url === 'string' && url.startsWith('/api/ai-strategy/personal-report/versions/')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            reportV2: reportWithDrivingForceGap(),
            generatedAt: '2026-08-13T00:00:00.000Z',
            trigger: 'manual',
          }),
          { status: 200 },
        ),
      );
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('PersonalReportV2View — inline report answers', () => {
  it('expands the Driving Force gap action into a textarea, saves it, and regenerates the report', async () => {
    const user = userEvent.setup();
    const fetchMock = fetchMockFor();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalReportV2View
        initialReport={reportWithDrivingForceGap()}
        initialVersionId="v1"
        initialVersions={[{ id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' }]}
        studentName="Olivia"
        generatedAt="2026-08-14T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Explain why you are interested in these subjects' }),
    );

    const textarea = screen.getByPlaceholderText('Explain why you are interested in these subjects');
    await user.type(textarea, 'I want to build accessible education tools.');
    await user.click(screen.getByRole('button', { name: 'Save & update report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai-strategy/personal-report/supplement',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            fieldKey: 'study_motivation',
            answer: 'I want to build accessible education tools.',
          }),
        }),
      );
    });

    // Saving triggers the same regeneration path, tagged as an answered-question update.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai-strategy/personal-report',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ trigger: 'supplement_answer' }),
        }),
      );
    });
  });

  it('never links the inline-answerable action to the (possibly locked) reflections page', () => {
    render(
      <PersonalReportV2View
        initialReport={reportWithDrivingForceGap()}
        initialVersionId="v1"
        initialVersions={[{ id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' }]}
        studentName="Olivia"
        generatedAt="2026-08-14T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    expect(
      screen.queryByRole('link', { name: 'Explain why you are interested in these subjects' }),
    ).not.toBeInTheDocument();
  });
});

describe('PersonalReportV2View — version history', () => {
  const versions = [
    { id: 'v2', generatedAt: '2026-08-14T00:00:00.000Z', trigger: 'matching_report' as const },
    { id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' as const },
  ];

  it('shows no version picker when there is only one version', () => {
    render(
      <PersonalReportV2View
        initialReport={reportWithDrivingForceGap()}
        initialVersionId="v1"
        initialVersions={[versions[1]!]}
        studentName="Olivia"
        generatedAt="2026-08-13T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    expect(screen.queryByLabelText('Version history')).not.toBeInTheDocument();
  });

  it('loads and displays a past version read-only, then returns to latest', async () => {
    const user = userEvent.setup();
    const fetchMock = fetchMockFor({ versions });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalReportV2View
        initialReport={reportWithDrivingForceGap()}
        initialVersionId="v2"
        initialVersions={versions}
        studentName="Olivia"
        generatedAt="2026-08-14T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    expect(screen.queryByText(/viewing an older version/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Version history'), 'v1');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/ai-strategy/personal-report/versions/v1');
    });
    await screen.findByText(/viewing an older version/i);

    // Answering inline is disabled while viewing history — the gap action falls back to a
    // plain link instead of the inline textarea button.
    expect(
      screen.queryByRole('button', { name: 'Explain why you are interested in these subjects' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Explain why you are interested in these subjects' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to latest' }));
    await waitFor(() => expect(screen.queryByText(/viewing an older version/i)).not.toBeInTheDocument());
  });
});
