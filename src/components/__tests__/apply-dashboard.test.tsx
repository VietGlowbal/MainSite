import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyDashboard } from '@/app/apply/apply-dashboard';
import type { CourseApplication } from '@/lib/apply-types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const application: CourseApplication = {
  id: 'application-1',
  userId: 'user-1',
  universityName: 'Cambridge',
  courseName: 'Computer Science',
  courseUrl: 'https://example.edu/computer-science',
  status: 'researching',
  progressPercentage: 25,
  parseStatus: 'complete',
  importStatus: 'complete',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('ApplyDashboard application card', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  it('renders the official course link outside the application link', () => {
    render(
      <ApplyDashboard
        applications={[application]}
        shortlisted={[]}
        upcomingDeadlines={[]}
        overview={{
          activeApplications: 1,
          submitted: 0,
          offersReceived: 0,
          tasksCompleted: 0,
          totalTasks: 0,
        }}
        savedScholarshipsByUniversity={{}}
        matchByApplicationId={{}}
        focusUniversityId={null}
        courseSearchUniversityId={null}
        openCourseSearch={false}
      />,
    );

    const officialLink = screen.getByRole('link', { name: /^view official page$/i });
    const applicationLink = screen.getByRole('link', {
      name: /open computer science application/i,
    });

    expect(officialLink.parentElement?.closest('a')).toBeNull();
    expect(officialLink).toHaveAttribute('href', application.courseUrl);
    expect(applicationLink).toHaveAttribute('href', `/apply/${application.id}`);
  });
});
