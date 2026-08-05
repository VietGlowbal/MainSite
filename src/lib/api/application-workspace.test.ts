import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));

import { fetchApplicationWorkspace } from './application-workspace';

type QueryResult = { data: unknown; error: unknown };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const application = {
  id: 'app-1',
  user_id: 'user-1',
  course_id: 'course-1',
  university_id: 82,
  university_name: 'Test University',
  course_name: 'Computer Science',
  course_url: 'https://example.com/course',
  degree_level: 'undergraduate',
  subject: 'Computer Science',
  study_mode: 'full_time',
  intake: '2027',
  country: 'Vietnam',
  country_flag: '🇻🇳',
  status: 'planning',
  current_stage_id: 'stage-1',
  progress_percentage: 20,
  parse_status: 'complete',
  parse_error: null,
  deadline: null,
  deadline_source: null,
  deadline_confidence: null,
  imported_from_url: null,
  import_status: 'complete',
  ai_summary: null,
  user_notes: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  university: { logo_url: 'https://example.com/logo.png' },
};

const course = {
  id: 'course-1',
  university_id: 82,
  university_name: 'Test University',
  course_name: 'Computer Science',
  course_url: 'https://example.com/course',
  degree_level: 'undergraduate',
  subject: 'Computer Science',
  study_mode: 'full_time',
  duration: '3 years',
  intake: '2027',
  country: 'Vietnam',
  city: 'Hanoi',
  tuition_fee_text: '$10,000',
  tuition_fee_min: 10000,
  tuition_fee_max: 10000,
  tuition_currency: 'USD',
  entry_requirements_summary: 'Strong grades',
  english_requirements_summary: 'IELTS 6.5',
  application_method: 'Direct',
  application_code: null,
  source_confidence: 0.9,
  extraction_status: 'complete',
  last_extracted_at: '2026-08-01T00:00:00Z',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

const stage = {
  id: 'stage-1',
  application_id: 'app-1',
  name: 'Prepare',
  slug: 'prepare',
  description: 'Prepare documents',
  order_num: 1,
  status: 'in_progress',
  is_required: true,
  icon: 'file',
  why_this_matters: 'Required',
  ai_generated: false,
  confidence: 1,
  started_at: null,
  completed_at: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

const requirement = {
  id: 'requirement-1',
  application_id: 'app-1',
  course_id: 'course-1',
  requirement_type: 'academic',
  title: 'Transcript',
  requirement_text: 'Submit transcript',
  is_mandatory: true,
  student_status: 'not_started',
  source_url: 'https://example.com/course',
  source_id: null,
  confidence: 1,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

const recommendation = {
  id: 'recommendation-1',
  application_id: 'app-1',
  recommendation_type: 'tip',
  title: 'Start early',
  body: 'Prepare the transcript early.',
  priority: 1,
  action_label: null,
  action_type: null,
  action_target: null,
  confidence: 1,
  is_dismissed: false,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

describe('fetchApplicationWorkspace', () => {
  beforeEach(() => vi.resetAllMocks());

  it('starts every independent workspace read together after loading the application', async () => {
    const started: string[] = [];
    const applicationResult = deferred<QueryResult>();
    const results = new Map<string, ReturnType<typeof deferred<QueryResult>>>([
      ['courses', deferred<QueryResult>()],
      ['application_stages', deferred<QueryResult>()],
      ['application_tasks', deferred<QueryResult>()],
      ['application_requirements', deferred<QueryResult>()],
      ['application_sources', deferred<QueryResult>()],
      ['application_match_analyses', deferred<QueryResult>()],
      ['application_recommendations', deferred<QueryResult>()],
    ]);

    const queryFor = (table: string) => {
      const result = table === 'course_applications' ? applicationResult : results.get(table);
      if (!result) throw new Error(`Unexpected table: ${table}`);
      const query: Record<string, unknown> = {};
      const chain = () => query;
      Object.assign(query, {
        select: chain,
        eq: chain,
        is: chain,
        order: chain,
        limit: chain,
        single: () => result.promise,
        then: result.promise.then.bind(result.promise),
      });
      return query;
    };

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        started.push(table);
        return queryFor(table);
      }),
    });

    const workspacePromise = fetchApplicationWorkspace('app-1', 'user-1');
    await vi.waitFor(() => expect(started).toEqual(['course_applications']));
    applicationResult.resolve({ data: application, error: null });
    await Promise.resolve();
    await Promise.resolve();

    const expectedReads = [
      'course_applications',
      'courses',
      'application_stages',
      'application_tasks',
      'application_requirements',
      'application_sources',
      'application_match_analyses',
      'application_recommendations',
    ];
    let schedulingError: unknown;
    try {
      expect(started).toEqual(expectedReads);
    } catch (error) {
      schedulingError = error;
    }

    results.get('courses')!.resolve({ data: course, error: null });
    results.get('application_stages')!.resolve({ data: [stage], error: null });
    results.get('application_tasks')!.resolve({ data: [], error: null });
    results.get('application_requirements')!.resolve({ data: [requirement], error: null });
    results.get('application_sources')!.resolve({ data: [], error: null });
    results.get('application_match_analyses')!.resolve({ data: null, error: null });
    results.get('application_recommendations')!.resolve({ data: [recommendation], error: null });

    const workspace = await workspacePromise;
    expect(workspace).toMatchObject({
      application: { logoUrl: 'https://example.com/logo.png' },
      course: { id: 'course-1', entryRequirementsSummary: 'Strong grades' },
      requirements: [{ id: 'requirement-1', requirementText: 'Submit transcript' }],
      recommendations: [{ id: 'recommendation-1', title: 'Start early' }],
    });
    if (schedulingError) throw schedulingError;
  });
});
