import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, getApplicationDocumentContextMock, getServerIdentityMock, fromMock, strategyResultMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getApplicationDocumentContextMock: vi.fn(),
  getServerIdentityMock: vi.fn(),
  fromMock: vi.fn(),
  strategyResultMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/server/auth/server-identity', () => ({
  getServerIdentity: getServerIdentityMock,
}));
vi.mock('@/features/apply/api/application-document-context', () => ({
  getApplicationDocumentContext: getApplicationDocumentContextMock,
}));
vi.mock('@/components/statement/StatementFeedbackWorkspace', () => ({
  StatementFeedbackWorkspace: vi.fn(() => null),
}));

import LorFeedbackPage from '@/app/apply/[applicationId]/lor-feedback/page';

describe('LorFeedbackPage', () => {
  beforeEach(() => {
    const activityId = '22222222-2222-4222-8222-222222222222';
    const activitiesQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    Object.assign(activitiesQuery, {
      select: vi.fn(() => activitiesQuery),
      eq: vi.fn(() => activitiesQuery),
      order: vi.fn().mockResolvedValue({
        data: [{ id: activityId, title: 'Research project', description: 'Built a model.' }],
      }),
    });
    const achievementsQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    Object.assign(achievementsQuery, {
      select: vi.fn(() => achievementsQuery),
      eq: vi.fn(() => achievementsQuery),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'achievement-1', title: 'Science prize', detail: 'National finalist.' }],
      }),
    });
    const strategyQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    strategyResultMock.mockResolvedValue({
      data: {
        recommender_type: 'subject_teacher',
        relationship_context: 'Taught the applicant for two years.',
        known_duration: 'one_to_two_years',
        observed_evidence: [{ kind: 'activity', id: activityId }],
        perspective: { summary: 'Direct academic perspective.', strongInsights: [], limitedInsights: [] },
        recommendations: [
          {
            trait: 'Analytical thinking',
            rationale: 'Observed in the project.',
            evidenceRefs: [`activity:${activityId}`],
            howToRaise: 'Discuss the research process.',
            priority: 'high',
            confidence: 'high',
          },
        ],
        do_not_prioritize: [],
        recommendation_brief: 'Discuss the research project.',
      },
    });
    Object.assign(strategyQuery, {
      select: vi.fn(() => strategyQuery),
      eq: vi.fn(() => strategyQuery),
      maybeSingle: strategyResultMock,
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'student_activities') return activitiesQuery;
      if (table === 'student_achievements') return achievementsQuery;
      return strategyQuery;
    });
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'olivia@example.com',
              user_metadata: {
                full_name: 'Olivia',
                avatar_url: 'https://example.com/avatar.png',
              },
            },
          },
        }),
      },
      from: fromMock,
    };
    createClientMock.mockResolvedValue(supabase);
    getServerIdentityMock.mockResolvedValue({
      supabase,
      identity: {
        id: 'user-1',
        email: 'olivia@example.com',
        name: 'Olivia',
        avatarUrl: 'https://example.com/avatar.png',
        userMetadata: {},
      },
    });
    getApplicationDocumentContextMock.mockResolvedValue({
      id: 'app-1',
      courseName: 'Computer Science',
      universityName: 'Cambridge',
      aiSummary: 'Programme summary',
      entryRequirementsSummary: 'Entry requirements',
    });
  });

  it('opens the shared feedback workspace in LOR mode', async () => {
    const page = await LorFeedbackPage({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(page.props).toMatchObject({
      applicationId: 'app-1',
      targetName: 'Computer Science · Cambridge',
      contextNote: 'Entry requirements',
      reviewType: 'lor',
      lorEvidence: [
        { kind: 'activity', id: '22222222-2222-4222-8222-222222222222', title: 'Research project', description: 'Built a model.' },
        { kind: 'achievement', id: 'achievement-1', title: 'Science prize', description: 'National finalist.' },
      ],
      initialLorStrategy: expect.objectContaining({
        recommenderType: 'subject_teacher',
        recommendationBrief: 'Discuss the research project.',
      }),
      userName: 'Olivia',
      userAvatarUrl: 'https://example.com/avatar.png',
    });
    expect(fromMock).toHaveBeenCalledWith('student_activities');
    expect(fromMock).toHaveBeenCalledWith('student_achievements');
    expect(fromMock).toHaveBeenCalledWith('application_lor_strategies');
  });

  it('ignores a malformed stored strategy instead of passing it to the client', async () => {
    strategyResultMock.mockResolvedValue({
      data: {
        recommender_type: 'subject_teacher',
        relationship_context: 'Taught the applicant for two years.',
        known_duration: 'one_to_two_years',
        observed_evidence: [],
        perspective: null,
        recommendations: null,
        do_not_prioritize: [],
        recommendation_brief: 'Invalid stored data.',
      },
    });

    const page = await LorFeedbackPage({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(page.props.initialLorStrategy).toBeNull();
  });
});
