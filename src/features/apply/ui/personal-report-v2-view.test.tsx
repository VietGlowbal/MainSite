import { render, screen, waitFor, within } from '@testing-library/react';
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
      whyThisFits: [],
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
    if (url === '/api/applications/app-1/personal-report/supplement' || url === '/api/ai-strategy/personal-report/supplement') {
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    }
    if (url === '/api/applications/app-1/personal-report' || url === '/api/ai-strategy/personal-report') {
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
    if (url === '/api/applications/app-1/personal-report/versions' || url === '/api/ai-strategy/personal-report/versions') {
      return Promise.resolve(
        new Response(JSON.stringify({ versions: overrides.versions ?? [] }), { status: 200 }),
      );
    }
    if (typeof url === 'string' && (url.startsWith('/api/applications/app-1/personal-report/versions/') || url.startsWith('/api/ai-strategy/personal-report/versions/'))) {
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
  it('keeps the existing creation animation active while a queued report is polled to completion', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/applications/app-1/personal-report' && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ queued: true, generation: { status: 'pending' } }), { status: 202 }));
      }
      if (url === '/api/applications/app-1/personal-report') {
        return Promise.resolve(new Response(JSON.stringify({
          reportV2: reportWithDrivingForceGap(), versionId: 'v2', generatedAt: '2026-08-14T01:00:00.000Z',
        }), { status: 200 }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalReportV2View
        initialReport={null}
        initialVersionId={null}
        initialVersions={[]}
        applicationId="app-1"
        applicationConfirmed
        studentName="Olivia"
        generatedAt={null}
        migrationMissing={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create report' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/personal-report'));
    await screen.findByRole('heading', { name: 'Olivia' });
  });

  it('expands the Driving Force gap action into a textarea, saves it, and regenerates the report', async () => {
    const user = userEvent.setup();
    const fetchMock = fetchMockFor();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PersonalReportV2View
        initialReport={reportWithDrivingForceGap()}
        initialVersionId="v1"
        initialVersions={[{ id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' }]}
        applicationId="app-1"
        applicationConfirmed
        studentName="Olivia"
        generatedAt="2026-08-14T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    // The Personal Canvas shows nothing until a section is selected — open
    // "Driving Forces" first (both the mobile and desktop layouts render at
    // once in jsdom, so pick the first match; either opens the same panel).
    await user.click(screen.getAllByRole('button', { name: /Driving Forces/i })[0]!);

    await user.click(
      screen.getByRole('button', { name: 'Explain why you are interested in these subjects' }),
    );

    const textarea = screen.getByPlaceholderText('Explain why you are interested in these subjects');
    await user.type(textarea, 'I want to build accessible education tools.');
    await user.click(screen.getByRole('button', { name: 'Save & update report' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/applications/app-1/personal-report/supplement',
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
        '/api/applications/app-1/personal-report',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringMatching(/"trigger":"supplement_answer"/),
        }),
      );
      const regenerationCall = fetchMock.mock.calls.find(
        ([url]) => url === '/api/applications/app-1/personal-report',
      );
      expect(JSON.parse((regenerationCall?.[1]?.body as string) || '{}')).toEqual(
        expect.objectContaining({
          trigger: 'supplement_answer',
          force: true,
          idempotencyKey: expect.any(String),
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

    // The gap action only renders once its Canvas section is open.
    await user.click(screen.getAllByRole('button', { name: /Driving Forces/i })[0]!);
    const panel = within(screen.getByRole('dialog', { name: 'Driving Forces details' }));

    // Answering inline is disabled while viewing history — the gap action falls back to a
    // plain link instead of the inline textarea button.
    expect(
      panel.queryByRole('button', { name: 'Explain why you are interested in these subjects' }),
    ).not.toBeInTheDocument();
    expect(
      panel.getByRole('link', { name: 'Explain why you are interested in these subjects' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to latest' }));
    await waitFor(() => expect(screen.queryByText(/viewing an older version/i)).not.toBeInTheDocument());
  });
});

function reportWithAnalytics(): PersonalReportV2 {
  const base = reportWithDrivingForceGap();
  return {
    ...base,
    overview: { summary: 'A synopsis of the profile.', evidenceRefs: [] },
    overallSummary: { paragraphs: ['The strongest signal so far.'], evidenceRefs: [] },
    signaturePattern: { ...base.signaturePattern, available: false },
    emergingThemes: { ...base.emergingThemes, available: false },
    personalPositioning: { ...base.personalPositioning, available: false },
    proofOfMe: { ...base.proofOfMe, available: false },
    analytics: {
      competencyEvidenceProfile: [
        { key: 'hard', label: 'Hard-skill specificity', score: 60, confidence: 'medium', evidenceRefs: [] },
      ],
      narrativeIdentitySignals: [
        { key: 'patternConsistency', label: 'Pattern consistency', score: 70, confidence: 'medium', evidenceRefs: [] },
      ],
      signaturePatternSupport: [],
      themeMaturity: [],
      positioningDimensions: [],
      evidenceSummary: {
        totalItems: 0,
        verification: { verified: 0, attributable: 0, stated: 0 },
        strength: { strong: 0, moderate: 0, limited: 0 },
        competencyClaims: { hard: 0, soft: 0, meta: 0 },
      },
    },
  };
}

describe('PersonalReportV2View — analytics wiring', () => {
  it('renders the applicant synopsis and identity evidence profile when analytics are present', async () => {
    const user = userEvent.setup();

    render(
      <PersonalReportV2View
        initialReport={reportWithAnalytics()}
        initialVersionId="v1"
        initialVersions={[{ id: 'v1', generatedAt: '2026-08-13T00:00:00.000Z', trigger: 'manual' }]}
        studentName="Olivia"
        generatedAt="2026-08-14T00:00:00.000Z"
        migrationMissing={false}
      />,
    );

    expect(screen.getByText('A synopsis of the profile.')).toBeInTheDocument();

    // The identity evidence profile lives in the Core Identity Canvas
    // section's detail panel, which only renders once that section is
    // selected — see the Driving Forces test above for the same pattern.
    await user.click(screen.getAllByRole('button', { name: /Core Identity/i })[0]!);

    // Scoped to the open panel: the same content is also duplicated in the
    // print-only view (`aria-hidden`, so excluded from role queries, but
    // still real text `getByText` would otherwise match twice).
    const panel = within(screen.getByRole('dialog', { name: 'Core Identity details' }));
    expect(panel.getByText('Identity evidence profile')).toBeInTheDocument();
    expect(panel.getByRole('list', { name: 'Core identity evidence signals' })).toBeInTheDocument();
  });

  it('omits identity analytics for a report version predating analytics, without crashing', () => {
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

    expect(screen.queryByText('Identity evidence profile')).not.toBeInTheDocument();
  });
});
