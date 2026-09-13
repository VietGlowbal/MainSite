import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import type { ComponentState, FinalCheckRecord, Readiness } from '../domain';
import { READINESS_DISCLAIMER } from '../domain';
import { FinalCheckView } from './final-check-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockReadiness: Readiness = {
  percent: 75,
  state: 'nearly_there',
  criticalActions: 1,
  missing: ['supporting'],
  unreviewed: ['essay'],
  excluded: ['lor'],
};

const baseComponents: ComponentState[] = [
  { key: 'cv', status: 'reviewed', updatedAt: '2026-09-01T00:00:00Z' },
  { key: 'essay', status: 'draft', updatedAt: '2026-09-02T00:00:00Z' },
  { key: 'lor', status: 'not_required', updatedAt: null },
  { key: 'supporting', status: 'missing', updatedAt: null },
];

const mockCheck: FinalCheckRecord = {
  id: 'check-1',
  createdAt: '2026-09-10T12:00:00Z',
  promptVersion: '1.0',
  readiness: mockReadiness,
  components: baseComponents,
  documentReviews: [
    {
      key: 'cv',
      tier: 'polish',
      purpose: 'Overview',
      evidence: 'Solid work experience',
      strength: 'Quantified metrics',
      gap: 'None',
      strategicContribution: 'Baseline credentials',
      recommendedAction: 'Format line spacing',
    },
    {
      key: 'essay',
      tier: 'critical',
      purpose: 'Motivation',
      evidence: 'Draft essay',
      strength: 'Good intro',
      gap: 'No specific professor or module mentioned',
      strategicContribution: 'Key discriminator',
      recommendedAction: 'Name 2 faculty members or specific modules',
    },
  ],
  narrativeAudit: {
    coreNarrative: 'Data-driven researcher',
    whatTheReaderRemembers: 'Strong technical grounding',
    pillars: [],
    checks: [
      {
        key: 'evidence',
        verdict: 'conflict',
        detail: 'CV says internship started in 2024, but essay claims 2025.',
      },
    ],
    unevidencedClaims: [],
    overweightedThemes: [],
  },
  limitations: [],
};

describe('FinalCheckView', () => {
  it('renders sections in action-first order: Action summary, then Inventory, then Readiness', () => {
    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={baseComponents}
        liveReadiness={mockReadiness}
        check={mockCheck}
        migrationMissing={false}
      />,
    );

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

    const actionIdx = headings.indexOf('Action-first summary');
    const inventoryIdx = headings.indexOf('What is attached');
    const readinessIdx = headings.indexOf('Overall readiness');

    expect(actionIdx).toBeGreaterThanOrEqual(0);
    expect(inventoryIdx).toBeGreaterThan(actionIdx);
    expect(readinessIdx).toBeGreaterThan(inventoryIdx);

    // Verifies readiness disclaimer is present and does not imply admission probability
    expect(screen.getByText(READINESS_DISCLAIMER)).toBeInTheDocument();
  });

  it('prioritizes a blocker (missing component) as the top next action', () => {
    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={baseComponents}
        liveReadiness={mockReadiness}
        check={mockCheck}
        migrationMissing={false}
      />,
    );

    // Blocker exists (supporting is missing)
    expect(screen.getByText('Priority next action')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: /Attach Supporting materials/i }),
    ).toBeInTheDocument();

    // Explicitly renders blockers, drafts, and critical findings sections
    expect(screen.getByRole('heading', { level: 3, name: 'Blockers' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Drafts needing review' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Critical findings & conflicts' }),
    ).toBeInTheDocument();
  });

  it('prioritizes critical document review when there are no blockers', () => {
    const noBlockers: ComponentState[] = [
      { key: 'cv', status: 'reviewed', updatedAt: null },
      { key: 'essay', status: 'draft', updatedAt: null },
      { key: 'lor', status: 'reviewed', updatedAt: null },
      { key: 'supporting', status: 'reviewed', updatedAt: null },
    ];

    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={noBlockers}
        liveReadiness={mockReadiness}
        check={mockCheck}
        migrationMissing={false}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Resolve critical finding in Essay/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Name 2 faculty members or specific modules/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('prioritizes narrative conflict when no blockers and no critical document review', () => {
    const noBlockers: ComponentState[] = [
      { key: 'cv', status: 'reviewed', updatedAt: null },
      { key: 'essay', status: 'draft', updatedAt: null },
    ];

    const checkWithConflictOnly: FinalCheckRecord = {
      ...mockCheck,
      documentReviews: [
        {
          ...mockCheck.documentReviews[0],
          tier: 'strategic',
        },
      ],
    };

    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={noBlockers}
        liveReadiness={mockReadiness}
        check={checkWithConflictOnly}
        migrationMissing={false}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Resolve conflict: Evidence/i,
      }),
    ).toBeInTheDocument();
  });

  it('prioritizes draft component when no blockers or critical findings exist', () => {
    const draftOnly: ComponentState[] = [
      { key: 'cv', status: 'reviewed', updatedAt: null },
      { key: 'essay', status: 'draft', updatedAt: null },
    ];

    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={draftOnly}
        liveReadiness={{ ...mockReadiness, criticalActions: 0 }}
        check={null}
        migrationMissing={false}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: /Review draft Essay/i,
      }),
    ).toBeInTheDocument();
  });

  it('shows ready state when all components are reviewed and no issues exist', () => {
    const allClean: ComponentState[] = [
      { key: 'cv', status: 'reviewed', updatedAt: null },
      { key: 'essay', status: 'reviewed', updatedAt: null },
    ];

    render(
      <FinalCheckView
        applicationId="app-1"
        universityName="Cambridge"
        courseName="MPhil in Machine Learning"
        components={allClean}
        liveReadiness={{ ...mockReadiness, percent: 100, criticalActions: 0, missing: [], unreviewed: [] }}
        check={null}
        migrationMissing={false}
      />,
    );

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Application materials complete',
      }),
    ).toBeInTheDocument();
  });

  it('formats Last checked date with en-GB for English and vi-VN for Vietnamese', () => {
    const { unmount } = render(
      <LanguageProvider defaultLang="en">
        <FinalCheckView
          applicationId="app-1"
          universityName="Cambridge"
          courseName="MPhil in Machine Learning"
          components={baseComponents}
          liveReadiness={mockReadiness}
          check={mockCheck}
          migrationMissing={false}
        />
      </LanguageProvider>,
    );

    const expectedEnDate = new Date(mockCheck.createdAt).toLocaleString('en-GB');
    expect(screen.getByText(new RegExp(expectedEnDate))).toBeInTheDocument();

    unmount();

    render(
      <LanguageProvider defaultLang="vi">
        <FinalCheckView
          applicationId="app-1"
          universityName="Cambridge"
          courseName="MPhil in Machine Learning"
          components={baseComponents}
          liveReadiness={mockReadiness}
          check={mockCheck}
          migrationMissing={false}
        />
      </LanguageProvider>,
    );

    const expectedViDate = new Date(mockCheck.createdAt).toLocaleString('vi-VN');
    expect(screen.getByText(new RegExp(expectedViDate))).toBeInTheDocument();
  });
});
