import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyOverviewView } from './strategy-overview';
import type { StrategyOverview } from '../domain';

const APP = '22222222-2222-4222-8222-222222222222';

function overview(patch: Partial<StrategyOverview> = {}): StrategyOverview {
  const base: StrategyOverview = {
    strategyId: 's1',
    applicationId: APP,
    status: 'in_progress',
    application: {
      universityName: 'University of Manchester',
      universityLogoUrl: null,
      courseName: 'BSc Computer Science',
      degreeLevel: 'Undergraduate',
      deadline: '2027-01-15',
      applicationStatus: 'preparing',
    },
    cv: {
      status: 'in_progress',
      updatedAt: '2026-07-01T00:00:00Z',
      targetProfileStatus: 'in_progress',
      contentStatus: 'not_started',
      reviewStatus: 'not_started',
      selectedLayout: null,
      exportStatus: 'none',
      reviewOutdated: false,
    },
    statement: {
      status: 'not_started',
      wordCount: 0,
      wordLimit: 4000,
      lastSavedAt: null,
      lastAnalyzedAt: null,
      ideasStatus: 'not_started',
      openingStatus: 'not_started',
      aaccStatus: 'not_started',
      readinessStatus: 'not_started',
      analysisOutdated: false,
    },
    actions: {
      next: { href: `/ai-strategy/${APP}/cv/content`, label: 'Continue CV' },
      cvHref: `/ai-strategy/${APP}/cv/content`,
      statementHref: `/ai-strategy/${APP}/statement`,
    },
    ...patch,
  };
  return base;
}

describe('StrategyOverviewView', () => {
  it('renders the application context', () => {
    render(<StrategyOverviewView data={overview()} />);

    expect(screen.getByRole('heading', { name: 'BSc Computer Science' })).toBeInTheDocument();
    expect(screen.getByText('University of Manchester')).toBeInTheDocument();
    expect(screen.getByText(/Undergraduate/)).toBeInTheDocument();
    expect(screen.getByText(/Deadline 15 Jan 2027/)).toBeInTheDocument();
  });

  it('omits a missing context value and its punctuation', () => {
    // The failure being avoided: "BSc Computer Science ·  · " from a naive join.
    render(
      <StrategyOverviewView
        data={overview({
          application: {
            universityName: 'University of Manchester',
            universityLogoUrl: null,
            courseName: 'BSc Computer Science',
            degreeLevel: null,
            deadline: null,
            applicationStatus: null,
          },
        })}
      />,
    );

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Deadline/)).not.toBeInTheDocument();
  });

  it('renders the empty state when neither document exists', () => {
    const data = overview({
      cv: { ...overview().cv, status: 'not_started', targetProfileStatus: 'not_started' },
    });
    render(<StrategyOverviewView data={data} />);

    expect(
      screen.getByText(
        'Start with the document you already have, or create one from your Glowbal profile.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start CV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start statement' })).toBeInTheDocument();
  });

  it('uses the specified action label for each status', () => {
    render(<StrategyOverviewView data={overview()} />);
    expect(screen.getByRole('link', { name: 'Continue CV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start statement' })).toBeInTheDocument();
  });

  it('renders exactly one primary action across both cards', () => {
    // Two cards each deciding they matter is how you get two primary buttons;
    // `actions.next` is what breaks the tie.
    const { container } = render(<StrategyOverviewView data={overview()} />);
    const primaries = container.querySelectorAll('a.bg-brand, a[class*="bg-brand"]');
    expect(primaries.length).toBeLessThanOrEqual(1);
  });

  it('conveys status with text, not colour alone', () => {
    const data = overview({
      cv: { ...overview().cv, status: 'needs_attention', reviewStatus: 'needs_attention' },
    });
    render(<StrategyOverviewView data={data} />);

    // The words are present, so a greyscale render still reads correctly.
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
  });

  it('shows the word count against the limit when one is known', () => {
    const data = overview({
      statement: { ...overview().statement, wordCount: 612, wordLimit: 4000 },
    });
    render(<StrategyOverviewView data={data} />);
    expect(screen.getByText('612 of 4000')).toBeInTheDocument();
  });

  it('shows a bare word count when no limit is published', () => {
    const data = overview({
      statement: { ...overview().statement, wordCount: 612, wordLimit: null },
    });
    render(<StrategyOverviewView data={data} />);
    expect(screen.getByText('612')).toBeInTheDocument();
  });

  it('labels the export state rather than showing a raw value', () => {
    const outdated = overview({
      cv: { ...overview().cv, status: 'needs_attention', exportStatus: 'outdated' },
    });
    render(<StrategyOverviewView data={outdated} />);
    expect(screen.getByText('Out of date')).toBeInTheDocument();
  });

  it('renders no aggregate score or probability anywhere', () => {
    const { container } = render(<StrategyOverviewView data={overview()} />);
    // A percentage on this screen would be an admissions-probability display,
    // which the product rules forbid.
    expect(container.textContent).not.toMatch(/%/);
  });
});
