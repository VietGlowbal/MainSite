import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getIdentity: vi.fn(),
  getContext: vi.fn(),
  fetchWorkspace: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/server/auth/server-identity', () => ({ getServerIdentity: mocks.getIdentity }));
vi.mock('@/features/apply/api/application-document-context', () => ({
  getApplicationDocumentContext: mocks.getContext,
}));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: mocks.fetchWorkspace,
}));
vi.mock('@/components/cv/CvReviewWorkspace', () => ({ CvReviewWorkspace: vi.fn(() => null) }));
vi.mock('@/components/statement/StatementFeedbackWorkspace', () => ({
  StatementFeedbackWorkspace: vi.fn(() => null),
}));

import CvReviewPage from '@/app/apply/[applicationId]/(features)/cv-review/page';
import StatementFeedbackPage from '@/app/apply/[applicationId]/(features)/statement-feedback/page';

const context = {
  id: 'app-1',
  universityId: 42,
  universityName: 'Oxford',
  courseName: 'Computer Science',
  parseStatus: 'complete',
  aiSummary: 'Summary',
  entryRequirementsSummary: 'Maths required',
};

describe('application document page data loading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const identity = {
      id: 'user-1',
      email: 'student@example.com',
      name: 'Student',
      avatarUrl: null,
      userMetadata: {},
    };
    mocks.getIdentity.mockResolvedValue({ supabase: {}, identity });
    mocks.getContext.mockResolvedValue(context);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
    mocks.fetchWorkspace.mockResolvedValue({
      application: {
        id: 'app-1',
        universityId: 42,
        universityName: 'Oxford',
        courseName: 'Computer Science',
        aiSummary: 'Summary',
      },
      course: { entryRequirementsSummary: 'Maths required' },
    });
  });

  it.each([
    ['CV review', CvReviewPage],
    ['statement feedback', StatementFeedbackPage],
  ])('%s uses the narrow document context instead of the full workspace', async (_label, page) => {
    await page({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(mocks.getContext).toHaveBeenCalledWith('app-1', 'user-1');
    expect(mocks.fetchWorkspace).not.toHaveBeenCalled();
  });

  it('reuses the request-scoped identity in the feature layout and navigation', () => {
    const layout = readFileSync('src/app/apply/[applicationId]/(features)/layout.tsx', 'utf8');

    expect(layout).toContain('getServerIdentity()');
    expect(layout).toContain('userId={user.id}');
    expect(layout).not.toContain('auth.getUser()');
  });
});
