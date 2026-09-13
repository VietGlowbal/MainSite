import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UniversityMatchResults } from './university-match-results';
import type { RecommendationResponse } from '../domain';

const success: RecommendationResponse = {
  status: 'success',
  algorithmVersion: 'university-rec-v1',
  generatedAt: '2026-08-18T00:00:00.000Z',
  results: [
    {
      universityId: 1,
      universityName: 'Example University',
      country: 'Canada',
      recommendationRank: 1,
      recommendationBand: 'top_pick',
      selectivityContext: 'highly_selective',
      programmeMatches: [{
        programmeId: 'programme-1',
        programmeName: 'MSc Computer Science',
        degreeLevel: 'postgraduate',
        normalizedSubject: 'Computer Science',
        officialUrl: 'https://example.com/programme-1',
        verificationStatus: 'RULE_VALIDATED',
        retrievedAt: '2026-08-18T00:00:00.000Z',
        subjectScore: 1,
      }],
      positiveEvidence: 0.9,
      negativeEvidence: 0,
      evidenceCoverage: 1,
      rankingScoreInternal: 0.9,
      dataQuality: 'high',
      reasons: [
        { code: 'PROGRAMME_FOUND', value: 'MSc Computer Science' },
        { code: 'DESTINATION_MATCH', value: 'Canada' },
      ],
      warnings: [{ code: 'COST_NEEDS_VERIFICATION' }],
      algorithmVersion: 'university-rec-v1',
    },
  ],
};

function resultFixture(overrides: Partial<RecommendationResponse['results'][number]> = {}) {
  const base = success.results[0]!;
  return {
    ...base,
    programmeMatches: base.programmeMatches.map((programme) => ({ ...programme })),
    reasons: base.reasons.map((reason) => ({ ...reason })),
    warnings: base.warnings.map((warning) => ({ ...warning })),
    ...overrides,
  };
}

function recommendationWith(...results: RecommendationResponse['results']) {
  return { ...success, results };
}

describe('UniversityMatchResults', () => {
  it('renders reasons and warnings without admission-style labels or percentages', () => {
    render(<UniversityMatchResults recommendation={success} />);

    expect(screen.getByText('Why this university appears')).toBeInTheDocument();
    expect(screen.getByText('Things to check')).toBeInTheDocument();
    expect(screen.getByText(/overall university acceptance data/)).toBeInTheDocument();
    expect(screen.getByText(/A relevant programme was found/)).toBeInTheDocument();
    expect(screen.getByText(/Tuition currency or annual period/)).toBeInTheDocument();
    expect(screen.getByText('MSc Computer Science')).toBeInTheDocument();
    expect(screen.getAllByText('Top pick')).toHaveLength(2);
    expect(screen.getAllByText('Highly selective overall')).toHaveLength(2);
    expect(screen.getByLabelText('Recommendation rank 1')).toHaveTextContent('#1');
    expect(screen.queryByText('More complete data')).not.toBeInTheDocument();
    expect(screen.queryByText('Some data available')).not.toBeInTheDocument();
    expect(screen.queryByText('More data needed')).not.toBeInTheDocument();
    expect(screen.queryByText('Strong Chance')).not.toBeInTheDocument();
    expect(screen.queryByText('Target')).not.toBeInTheDocument();
    expect(screen.queryByText('Reach')).not.toBeInTheDocument();
    expect(screen.queryByText('90%')).not.toBeInTheDocument();
  });

  it('does not render a needs-review programme as confirmed availability', () => {
    render(<UniversityMatchResults recommendation={{
      ...success,
      results: [{
        ...success.results[0]!,
        programmeMatches: [{ ...success.results[0]!.programmeMatches[0]!, verificationStatus: 'NEEDS_REVIEW' }],
        warnings: [{ code: 'PROGRAMME_NOT_VERIFIED', value: 'MSc Computer Science' }],
      }],
    }} />);

    expect(screen.getByText(/Programme availability needs verification/)).toBeInTheDocument();
    expect(screen.getByText('Programme review pending')).toBeInTheDocument();
    expect(screen.queryByText(/confirmed availability/i)).not.toBeInTheDocument();
  });

  it('labels every related programme by its own verification state', () => {
    render(<UniversityMatchResults recommendation={{
      ...success,
      results: [{
        ...success.results[0]!,
        programmeMatches: [
          success.results[0]!.programmeMatches[0]!,
          {
            ...success.results[0]!.programmeMatches[0]!,
            programmeId: 'programme-2',
            programmeName: 'MSc Artificial Intelligence',
            verificationStatus: 'NEEDS_REVIEW',
          },
          {
            ...success.results[0]!.programmeMatches[0]!,
            programmeId: 'programme-3',
            programmeName: 'MSc Data Science',
            verificationStatus: null,
          },
        ],
      }],
    }} />);

    expect(screen.getByText('Verified programme')).toBeInTheDocument();
    expect(screen.getByText('Programme review pending')).toBeInTheDocument();
    expect(screen.getByText('Programme verification unavailable')).toBeInTheDocument();
  });

  it('starts with no filters, disabled show all, and global recommendation ranks', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'selective' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'good_fit', selectivityContext: 'highly_selective' }),
    )} />);

    expect(screen.getByRole('button', { name: 'Top pick' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Highly selective overall' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Show all' })).toBeDisabled();
    expect(screen.getByLabelText('Recommendation rank 1')).toHaveTextContent('#1');
    expect(screen.getByLabelText('Recommendation rank 2')).toHaveTextContent('#2');
  });

  it('filters by recommendation band without renumbering global ranks', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'selective' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'good_fit', selectivityContext: 'selective' }),
      resultFixture({ universityId: 3, universityName: 'Third University', recommendationRank: 3, recommendationBand: 'top_pick', selectivityContext: 'highly_selective' }),
    )} />);

    fireEvent.click(screen.getByRole('button', { name: 'Top pick' }));

    expect(screen.getByLabelText('Recommendation rank 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 2')).not.toBeInTheDocument();
  });

  it('filters breadth-capped worth-exploring results through the normal band filter', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'worth_exploring', selectivityContext: 'not_assessed' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'top_pick', selectivityContext: 'not_assessed' }),
    )} />);

    fireEvent.click(screen.getByRole('button', { name: 'Top pick' }));
    expect(screen.queryByLabelText('Recommendation rank 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Worth exploring' }));
    expect(screen.getByLabelText('Recommendation rank 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 2')).not.toBeInTheDocument();
  });

  it('combines recommendation and selectivity filters with AND semantics', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'selective' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'top_pick', selectivityContext: 'highly_selective' }),
      resultFixture({ universityId: 3, universityName: 'Third University', recommendationRank: 3, recommendationBand: 'good_fit', selectivityContext: 'highly_selective' }),
    )} />);

    fireEvent.click(screen.getByRole('button', { name: 'Highly selective overall' }));
    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Top pick' }));

    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 3')).not.toBeInTheDocument();
  });

  it('toggles filters off and show all clears both groups', () => {
    render(<UniversityMatchResults recommendation={success} />);
    const topPick = screen.getByRole('button', { name: 'Top pick' });
    const highlySelective = screen.getByRole('button', { name: 'Highly selective overall' });

    fireEvent.click(topPick);
    expect(topPick).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(topPick);
    expect(topPick).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(topPick);
    fireEvent.click(highlySelective);
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

    expect(topPick).toHaveAttribute('aria-pressed', 'false');
    expect(highlySelective).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters lower selectivity separately from not assessed and resets it with show all', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'lower_selectivity' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'good_fit', selectivityContext: 'not_assessed' }),
    )} />);

    const lowerSelectivity = screen.getByRole('button', { name: 'Lower selectivity overall' });
    const notAssessed = screen.getByRole('button', { name: 'Selectivity not assessed' });
    expect(lowerSelectivity).toBeInTheDocument();
    expect(notAssessed).toBeInTheDocument();

    fireEvent.click(lowerSelectivity);
    expect(screen.getByLabelText('Recommendation rank 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 2')).not.toBeInTheDocument();
    expect(lowerSelectivity).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(lowerSelectivity).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();
  });

  it('combines recommendation and lower-selectivity filters without reranking', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'not_assessed' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'top_pick', selectivityContext: 'lower_selectivity' }),
      resultFixture({ universityId: 3, universityName: 'Third University', recommendationRank: 3, recommendationBand: 'good_fit', selectivityContext: 'lower_selectivity' }),
    )} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lower selectivity overall' }));
    fireEvent.click(screen.getByRole('button', { name: 'Top pick' }));

    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 3')).not.toBeInTheDocument();
  });

  it('shows a filter-specific empty state with a reset action', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({ recommendationRank: 1, recommendationBand: 'top_pick', selectivityContext: 'selective' }),
      resultFixture({ universityId: 2, universityName: 'Second University', recommendationRank: 2, recommendationBand: 'good_fit', selectivityContext: 'highly_selective' }),
    )} />);

    fireEvent.click(screen.getByRole('button', { name: 'Good fit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Selective overall' }));

    expect(screen.getByText('No recommendations match these filters.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show all' })).toHaveLength(2);
  });

  it('progressively renders recommendation windows and resets the window after filtering', () => {
    const results = Array.from({ length: 30 }, (_, index) => resultFixture({
      universityId: index + 1,
      universityName: `University ${index + 1}`,
      recommendationRank: index + 1,
      recommendationBand: index % 2 === 0 ? 'top_pick' : 'good_fit',
      selectivityContext: 'not_assessed',
    }));
    render(<UniversityMatchResults recommendation={recommendationWith(...results)} />);

    expect(screen.getAllByLabelText(/Recommendation rank/)).toHaveLength(6);
    expect(screen.getByText('Showing 6 of 30 recommendations')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Best Fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth Considering' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Explore All' }));
    expect(screen.getByRole('heading', { name: 'Explore All' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Recommendation rank/)).toHaveLength(12);
    expect(screen.getByText('Showing 12 of 30 recommendations')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more recommendations' }));
    expect(screen.getAllByLabelText(/Recommendation rank/)).toHaveLength(24);
    expect(screen.getByText('Showing 24 of 30 recommendations')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more recommendations' }));
    expect(screen.getAllByLabelText(/Recommendation rank/)).toHaveLength(30);
    expect(screen.queryByRole('button', { name: 'Show more recommendations' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Good fit' }));
    expect(screen.getByText('Showing 12 of 15 recommendations')).toBeInTheDocument();
  });

  it('renders exact six-result split into Best Fits (top 3) and Worth Considering (next 3) with Explore All toggle', () => {
    const results = Array.from({ length: 7 }, (_, index) => resultFixture({
      universityId: index + 1,
      universityName: `University ${index + 1}`,
      recommendationRank: index + 1,
      recommendationBand: 'top_pick',
      selectivityContext: 'not_assessed',
    }));
    render(<UniversityMatchResults recommendation={recommendationWith(...results)} />);

    expect(screen.getByRole('heading', { name: 'Best Fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth Considering' })).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 6')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 7')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 6 of 7 recommendations')).toBeInTheDocument();

    const exploreButton = screen.getByRole('button', { name: 'Explore All' });
    expect(exploreButton).toBeInTheDocument();

    fireEvent.click(exploreButton);
    expect(screen.getByRole('heading', { name: 'Explore All' })).toBeInTheDocument();
    expect(screen.getByLabelText('Recommendation rank 7')).toBeInTheDocument();
    expect(screen.getByText('Showing 7 of 7 recommendations')).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: 'Back to shortlist' });
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(screen.getByRole('heading', { name: 'Best Fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth Considering' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Recommendation rank 7')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 6 of 7 recommendations')).toBeInTheDocument();
  });

  it('renders only Best Fits section when 3 or fewer results exist', () => {
    const results = Array.from({ length: 3 }, (_, index) => resultFixture({
      universityId: index + 1,
      universityName: `University ${index + 1}`,
      recommendationRank: index + 1,
    }));
    render(<UniversityMatchResults recommendation={recommendationWith(...results)} />);

    expect(screen.getByRole('heading', { name: 'Best Fits' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Worth Considering' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore All' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 3 of 3 recommendations')).toBeInTheDocument();
  });

  it('renders Best Fits and Worth Considering without Explore All when results are between 4 and 6', () => {
    const results = Array.from({ length: 5 }, (_, index) => resultFixture({
      universityId: index + 1,
      universityName: `University ${index + 1}`,
      recommendationRank: index + 1,
    }));
    render(<UniversityMatchResults recommendation={recommendationWith(...results)} />);

    expect(screen.getByRole('heading', { name: 'Best Fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Worth Considering' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Explore All' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 5 of 5 recommendations')).toBeInTheDocument();
  });

  it('surfaces exact deterministic reasons, warnings, budget compatibility, and university links', () => {
    render(<UniversityMatchResults recommendation={recommendationWith(
      resultFixture({
        universityId: 42,
        universityName: 'Explanatory University',
        reasons: [
          { code: 'BUDGET_COMPATIBLE' },
          { code: 'SUBJECT_MATCH', value: 'Computer Science' },
          { code: 'DESTINATION_MATCH', value: 'Canada' },
          { code: 'CAMPUS_MATCH' },
        ],
        warnings: [
          { code: 'SCHOLARSHIP_DEPENDENT_BUDGET' },
          { code: 'COST_NEEDS_VERIFICATION' },
        ],
      }),
    )} />);

    expect(screen.getByText('Published tuition fits within your maximum annual budget')).toBeInTheDocument();
    expect(screen.getByText('The programme matches your subject preference: Computer Science')).toBeInTheDocument();
    expect(screen.getByText('The country matches your destination preference')).toBeInTheDocument();
    expect(screen.getByText('The campus information matches your preference')).toBeInTheDocument();
    expect(screen.getByText('Your budget depends on scholarships, so affordability needs verification')).toBeInTheDocument();
    expect(screen.getByText('Tuition currency or annual period needs verification')).toBeInTheDocument();

    const universityLinks = screen.getAllByRole('link', { name: /Explanatory University|View university details/ });
    expect(universityLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of universityLinks) {
      expect(link).toHaveAttribute('href', '/universities/42');
    }
  });

  it('distinguishes incomplete profile from an infrastructure error', () => {
    const { rerender } = render(
      <UniversityMatchResults recommendation={{
        ...success,
        status: 'incomplete_profile',
        results: [],
      }} />,
    );
    expect(screen.getByText('Tell us what you want to study')).toBeInTheDocument();
    expect(screen.queryByText('Recommendations are temporarily unavailable')).not.toBeInTheDocument();

    rerender(
      <UniversityMatchResults recommendation={{
        ...success,
        status: 'error',
        results: [],
      }} />,
    );
    expect(screen.getByText('Recommendations are temporarily unavailable')).toBeInTheDocument();
  });
});
