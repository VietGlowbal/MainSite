import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudentProfile } from '@/lib/types';
import { ProfileClient } from './profile-client';

/**
 * The grouping of the eight section cards, and the tally each group banner
 * carries.
 *
 * WHY THIS IS WORTH A TEST. The grouping is not cosmetic — it mirrors the
 * onboarding flow so a student can find the answer they came back to change
 * (see the note above SECTION_GROUPS). Nothing in the type system stops a card
 * being moved to a different group, or a group's `sections` being reordered, so
 * the mapping is asserted here rather than left to review.
 *
 * The tally is arithmetic over `pct`, which is the part most likely to drift:
 * every editor scores itself, and a card added to a group silently changes the
 * denominator its banner prints.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/shared/ui/loading-overlay', () => ({
  useLoadingIndicator: () => {},
  GlobalLoadingOverlay: () => null,
  beginLoading: () => {},
  useBeginLoading: () => () => {},
  useLoadingSnapshot: () => ({}),
}));

/** Enough of a profile to finish exactly one card: Target preferences. */
const PROFILE = {
  preferred_countries: ['UK'],
  target_subjects: ['Computer Science'],
  budget_range: '20-30k',
  campus_preferences: 'City',
  support_needs: 'Scholarships and funding',
  study_mode_preference: 'Full-time',
  target_intake: '2027-09',
} as unknown as StudentProfile;

function renderProfile(profile: StudentProfile | null = PROFILE) {
  return render(
    <ProfileClient
      displayName="Demo Student"
      email="demo@example.com"
      memberSince="Jan 2026"
      profile={profile}
      documents={[]}
      activeApplications={0}
      workEntries={0}
      testScores={0}
      isMentor={false}
      plusStatus={false}
      plusPlan={null}
    />,
  );
}

/** The banner is the group's accessible name, so the section is findable by it. */
function group(name: string) {
  return screen.getByRole('region', { name });
}

describe('profile section groups', () => {
  it('renders the three groups in onboarding order', () => {
    renderProfile();

    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent);

    expect(headings).toEqual([
      'Your study direction',
      'Your academic record',
      'Documents & personal details',
    ]);
  });

  it('puts each card in the group that matches where onboarding asked for it', () => {
    renderProfile();

    const cardsIn = (name: string) =>
      within(group(name))
        .getAllByRole('link')
        .map((node) => within(node).getByRole('heading', { level: 4 }).textContent);

    // Quiz-backed cards lead each group; never-asked ones follow.
    expect(cardsIn('Your study direction')).toEqual(['Target preferences', 'Application goals']);
    expect(cardsIn('Your academic record')).toEqual([
      'Academic background',
      'Test scores',
      'Achievements',
      'Work experience',
    ]);
    expect(cardsIn('Documents & personal details')).toEqual([
      'Documents',
      'Personal information',
    ]);
  });

  it('counts finished cards per group, not across the page', () => {
    renderProfile();

    // PROFILE fills every preferences field and nothing else.
    expect(within(group('Your study direction')).getByText('1 of 2 done')).toBeInTheDocument();
    expect(within(group('Your academic record')).getByText('0 of 4 done')).toBeInTheDocument();
    expect(
      within(group('Documents & personal details')).getByText('0 of 2 done'),
    ).toBeInTheDocument();
  });

  it('marks a card with nothing in it as not started', () => {
    renderProfile(null);

    // Every card is empty, so every group tallies zero.
    expect(within(group('Your study direction')).getByText('0 of 2 done')).toBeInTheDocument();
    expect(screen.getAllByText('Not started')).toHaveLength(8);
  });

  it('threads returnTo through section card hrefs and back navigation when present', () => {
    const returnTarget = '/ai-strategy/app-99/strategy/analysis';
    render(
      <ProfileClient
        displayName="Demo Student"
        email="demo@example.com"
        memberSince="Jan 2026"
        profile={PROFILE}
        documents={[]}
        activeApplications={1}
        workEntries={0}
        testScores={0}
        isMentor={false}
        plusStatus={false}
        plusPlan={null}
        returnTo={returnTarget}
        applicationLabel="Oxford · Law"
      />,
    );

    const backLink = screen.getByRole('link', { name: '← Oxford · Law' });
    expect(backLink).toHaveAttribute('href', returnTarget);

    const personalCard = screen.getByRole('link', { name: /Personal information/i });
    expect(personalCard).toHaveAttribute(
      'href',
      `/profile/personal?return=${encodeURIComponent(returnTarget)}`,
    );

    const preferencesCard = screen.getByRole('link', { name: /Target preferences/i });
    expect(preferencesCard).toHaveAttribute(
      'href',
      `/profile/preferences?return=${encodeURIComponent(returnTarget)}`,
    );

    const editProfileBtn = screen.getByRole('link', { name: /Edit profile/i });
    expect(editProfileBtn).toHaveAttribute(
      'href',
      `/profile/personal?return=${encodeURIComponent(returnTarget)}`,
    );
  });
});
