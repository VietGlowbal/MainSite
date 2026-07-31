import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, fetchApplicationWorkspaceMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fetchApplicationWorkspaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: fetchApplicationWorkspaceMock,
}));
vi.mock('@/components/statement/StatementFeedbackWorkspace', () => ({
  StatementFeedbackWorkspace: vi.fn(() => null),
}));

import LorFeedbackPage from '@/app/apply/[applicationId]/lor-feedback/page';

describe('LorFeedbackPage', () => {
  beforeEach(() => {
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
    fetchApplicationWorkspaceMock.mockResolvedValue({
      application: {
        id: 'app-1',
        courseName: 'Computer Science',
        universityName: 'Cambridge',
        aiSummary: 'Programme summary',
      },
      course: { entryRequirementsSummary: 'Entry requirements' },
    });
  });

  it('opens the shared feedback workspace in LOR mode', async () => {
    const page = await LorFeedbackPage({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(page.props).toMatchObject({
      applicationId: 'app-1',
      targetName: 'Computer Science · Cambridge',
      contextNote: 'Entry requirements',
      reviewType: 'lor',
    });
  });
});
