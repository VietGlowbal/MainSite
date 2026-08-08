import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseApplication } from '@/lib/apply-types';

const mocks = vi.hoisted(() => ({ prefetch: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: mocks.prefetch, refresh: vi.fn() }),
}));

import { MyApplicationSection } from '@/app/apply/my-application-section';

describe('MyApplicationSection workspace prefetch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefetches an application workspace only after hover or keyboard focus', () => {
    render(
      <MyApplicationSection
        applications={[
          {
            id: 'app-1',
            universityName: 'Example University',
            courseName: 'Computer Science',
            userId: 'user-1',
            status: 'researching',
            progressPercentage: 20,
            parseStatus: 'complete',
            importStatus: 'complete',
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          } as CourseApplication,
        ]}
        logoByUniversityId={{}}
        strategyReadyById={{}}
      />,
    );

    expect(mocks.prefetch).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: /continue applying/i });
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(mocks.prefetch).toHaveBeenCalledTimes(2);
    expect(mocks.prefetch).toHaveBeenLastCalledWith('/apply/app-1');
  });
});
