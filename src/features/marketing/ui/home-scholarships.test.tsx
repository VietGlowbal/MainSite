import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeScholarships, type ScholarshipTeaser } from './home-scholarships';
import { getOfficialScholarshipBranding } from './home-scholarship-branding';

const ENTRIES: ScholarshipTeaser[] = [
  {
    id: 147,
    title: 'Rhodes Scholarship',
    href: '/scholarships?q=Rhodes%20Scholarship',
    organization: 'University of Oxford',
    scholarshipLogoUrl: 'https://example.test/rhodes.svg',
    universityLogoUrl: 'https://example.test/oxford.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Most prestigious',
    deadline: 'Aug–Oct',
    fundingTypes: ['full_ride', 'merit'],
    country: 'United Kingdom',
  },
  {
    id: 140,
    title: 'Gates Cambridge',
    href: '/scholarships?q=Gates%20Cambridge',
    organization: 'University of Cambridge',
    universityLogoUrl: 'https://example.test/cambridge.webp',
    value: 'Full ride',
    valueLabel: 'What it covers',
    ranking: 'Top global',
    deadline: 'Oct–Dec',
    fundingTypes: ['full_ride'],
    country: 'United Kingdom',
  },
];

describe('HomeScholarships', () => {
  it('uses verified programme branding only for registered scholarships', () => {
    expect(getOfficialScholarshipBranding('Rhodes Scholarship')?.logoUrl).toContain(
      'rhodes-logo-main-dark',
    );
    expect(getOfficialScholarshipBranding('Gates Cambridge')?.logoTone).toBe('dark');
    expect(getOfficialScholarshipBranding('Knight Hennessy Scholarships')?.logoUrl).toContain(
      'khs_logo_primary_rgb.png',
    );
    expect(getOfficialScholarshipBranding('Yenching Academy')).toBeNull();
    expect(getOfficialScholarshipBranding('Lester B. Pearson Scholarship')).toBeNull();
  });

  it('highlights the live library total and scholarship identity', () => {
    render(<HomeScholarships entries={ENTRIES} total={2_877} />);

    expect(screen.getByText('2,877')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rhodes Scholarship' })).toBeInTheDocument();
    expect(screen.getByAltText('Rhodes Scholarship logo')).toHaveAttribute(
      'src',
      'https://example.test/rhodes.svg',
    );
    expect(screen.getByAltText('University of Cambridge logo')).toHaveAttribute(
      'src',
      'https://example.test/cambridge.webp',
    );
    fireEvent.error(screen.getByAltText('Rhodes Scholarship logo'));
    expect(screen.getByAltText('University of Oxford logo')).toHaveAttribute(
      'src',
      'https://example.test/oxford.webp',
    );
    expect(screen.getByRole('link', { name: 'View Rhodes Scholarship' })).toHaveAttribute(
      'href',
      '/scholarships?q=Rhodes%20Scholarship',
    );
  });

  it('moves between cards with only the requested directional controls', () => {
    render(<HomeScholarships entries={ENTRIES} total={2_877} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next scholarship' }));
    expect(screen.getByRole('heading', { name: 'Gates Cambridge' }).closest('article')).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Pause automatic rotation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Scroll or swipe to see more scholarships.')).not.toBeInTheDocument();
    expect(screen.queryByText('Scholarship logo')).not.toBeInTheDocument();
    expect(screen.queryByText('University crest')).not.toBeInTheDocument();
  });
});
