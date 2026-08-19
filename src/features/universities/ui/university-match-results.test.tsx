import { render, screen } from '@testing-library/react';
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

describe('UniversityMatchResults', () => {
  it('renders reasons and warnings without admission-style labels or percentages', () => {
    render(<UniversityMatchResults recommendation={success} />);

    expect(screen.getByText('Why this university appears')).toBeInTheDocument();
    expect(screen.getByText('Things to check')).toBeInTheDocument();
    expect(screen.getByText(/A relevant programme was found/)).toBeInTheDocument();
    expect(screen.getByText(/Tuition currency or annual period/)).toBeInTheDocument();
    expect(screen.getByText('MSc Computer Science')).toBeInTheDocument();
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
