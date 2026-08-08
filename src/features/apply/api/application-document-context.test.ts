import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@/server/db/server', () => ({ createClient: mocks.createClient }));

import { getApplicationDocumentContext } from './application-document-context';

describe('getApplicationDocumentContext', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses a narrow projection and filters by application and owner', async () => {
    const filters: Array<[string, string]> = [];
    let projection = '';
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: (value: string) => {
        projection = value;
        return builder;
      },
      eq: (column: string, value: string) => {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'app-1',
          university_id: 42,
          university_name: 'Oxford',
          course_name: 'Computer Science',
          parse_status: 'complete',
          ai_summary: 'Summary',
          courses: { entry_requirements_summary: 'Maths required' },
        },
        error: null,
      }),
    });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => builder) });

    const context = await getApplicationDocumentContext('app-1', 'user-1');

    expect(projection).not.toContain('*');
    expect(filters).toEqual([
      ['id', 'app-1'],
      ['user_id', 'user-1'],
    ]);
    expect(context).toEqual({
      id: 'app-1',
      universityId: 42,
      universityName: 'Oxford',
      courseName: 'Computer Science',
      parseStatus: 'complete',
      aiSummary: 'Summary',
      entryRequirementsSummary: 'Maths required',
    });
  });
});
