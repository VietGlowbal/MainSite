import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchApplicationWorkspace: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: mocks.fetchApplicationWorkspace,
}));

import {
  buildCvBuilderContextData,
  isCvBuilderEnabled,
  loadCvBuilderContext,
} from './cv-builder-context';

afterEach(() => vi.unstubAllEnvs());

describe('isCvBuilderEnabled', () => {
  it('keeps the visible CV builder available in production when the flag is omitted', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CV_BUILDER_MVP_ENABLED', '');

    expect(isCvBuilderEnabled()).toBe(true);
  });

  it('does not disable the CV builder through the legacy flag', () => {
    vi.stubEnv('CV_BUILDER_MVP_ENABLED', 'false');

    expect(isCvBuilderEnabled()).toBe(true);
  });
});

describe('buildCvBuilderContextData', () => {
  it('maps Supabase fields into cited target sources and an editable CV prefill', () => {
    const context = buildCvBuilderContextData({
      user: {
        id: 'user-1',
        email: 'alex@example.com',
        name: 'Alex Nguyen',
      },
      application: {
        id: 'app-1',
        universityName: 'Example University',
        programmeName: 'BSc Computer Science',
        universityId: 9,
        courseId: 'course-1',
        degreeLevel: 'Bachelor',
        subject: 'Computer Science',
      },
      university: {
        name: 'Example University',
        country: 'United Kingdom',
        qs_rank: 25,
        strengths: 'Project-based learning',
        teaching_style: 'Hands-on seminars',
        international_environment: 'Global cohort',
        best_for: 'Curious builders',
        employability: 'Strong technology outcomes',
      },
      course: {
        id: 'course-1',
        course_name: 'BSc Computer Science',
        subject: 'Computer Science',
        degree_level: 'Bachelor',
        study_mode: 'On campus',
        duration: '3 years',
        entry_requirements_summary: 'Strong mathematics preparation',
        search_keywords: ['programming', 'algorithms'],
        extraction_status: 'extracted',
      },
      profile: {
        phone: '+84 123',
        location: 'Hanoi',
        current_institution: 'Example High School',
        current_qualification: 'High School Diploma',
        academic_background: 'STEM track',
        career_interests: ['Software Engineering'],
        goals: 'Build accessible learning tools',
        achievements: ['Regional robotics finalist'],
        skills: ['Python', 'Leadership'],
      },
      workExperiences: [
        {
          id: 'work-1',
          company: 'Robotics Club',
          role: 'Team Lead',
          start_date: '2025-01',
          end_date: null,
          is_current: true,
          description: 'Led six students to build a low-cost robot.',
        },
      ],
    });

    expect(context.sourceEntries).toContainEqual({
      ref: 'university:teaching_style',
      value: 'Hands-on seminars',
    });
    expect(context.sourceEntries).toContainEqual({
      ref: 'university:qs_rank',
      value: '25',
    });
    expect(context.sourceEntries).toContainEqual({
      ref: 'course:duration',
      value: '3 years',
    });
    expect(context.validSourceRefs.has('profile:career_interests')).toBe(true);
    expect(context.confidence).toBe('medium');
    expect(context.limitations.join(' ')).toMatch(/module/i);
    expect(context.prefill.personal.fullName).toBe('Alex Nguyen');
    expect(context.prefill.education[0].institution).toBe('Example High School');
    expect(context.prefill.entries[0].contributions[0].text).toContain('six students');
    expect(context.prefill.awards[0].title).toBe('Regional robotics finalist');
  });

  it('keeps an unreviewed programme usable but lowers Target Profile confidence', () => {
    const context = buildCvBuilderContextData({
      user: { id: 'user-1', email: 'alex@example.com', name: 'Alex Nguyen' },
      application: {
        id: 'app-1',
        universityName: 'Example University',
        programmeName: 'Computer Science',
        courseId: 'course-1',
      },
      university: { strengths: 'Research-led teaching' },
      course: {
        id: 'course-1',
        course_name: 'Computer Science',
        degree_level: 'bachelor',
        extraction_status: 'needs_review',
      },
      profile: null,
      workExperiences: [],
    });

    expect(context.confidence).toBe('low');
    expect(context.limitations.join(' ')).toMatch(/awaiting review/i);
    expect(context.validSourceRefs.has('course:course_name')).toBe(true);
  });

  it('prefers canonical structured achievements and activities over legacy profile JSON', () => {
    const context = buildCvBuilderContextData({
      user: { id: 'user-1', email: 'alex@example.com', name: 'Alex Nguyen' },
      application: {
        id: 'app-1',
        universityName: 'Example University',
        programmeName: 'Computer Science',
      },
      university: null,
      course: null,
      profile: {
        achievements: ['Legacy profile achievement string'],
        skills: ['TypeScript'],
      },
      workExperiences: [],
      achievements: [
        {
          id: 'ach-1',
          title: 'National Olympiad Gold',
          competition: 'National Science Contest',
          organisation: 'Ministry of Education',
          year: '2025',
          detail: 'First prize in physics',
        },
      ],
      activities: [
        {
          id: 'act-1',
          category: 'volunteering',
          title: 'Community Coding Club',
          organisation: 'Local Center',
          period: '2024 - 2025',
          description: 'Taught coding to under-represented youth',
        },
      ],
    });

    expect(context.prefill.awards).toHaveLength(1);
    expect(context.prefill.awards[0]).toEqual({
      id: 'ach-1',
      title: 'National Olympiad Gold',
      issuer: 'Ministry of Education',
      date: '2025',
      description: 'First prize in physics',
    });

    expect(context.prefill.entries).toHaveLength(1);
    expect(context.prefill.entries[0]).toMatchObject({
      id: 'act-1',
      category: 'volunteering',
      title: 'Community Coding Club',
      organization: 'Local Center',
      startDate: '2024 - 2025',
    });
    expect(context.prefill.entries[0].contributions[0].text).toBe(
      'Taught coding to under-represented youth',
    );
  });
});

describe('loadCvBuilderContext', () => {
  it('starts the narrow application, profile, work, achievement, and activity reads together', async () => {
    const started: string[] = [];
    const selects: Record<string, string[]> = {};
    let resolveApplication!: (value: unknown) => void;
    const applicationResult = new Promise((resolve) => {
      resolveApplication = resolve;
    });

    const query = (table: string, result: Promise<unknown> | unknown) => {
      const resolved = Promise.resolve(result).then((value) => value);
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      Object.assign(builder, {
        select: vi.fn((columns: string) => {
          selects[table] = (selects[table] ?? []).concat(columns);
          return builder;
        }),
        eq: chain,
        ilike: chain,
        order: chain,
        limit: chain,
        maybeSingle: () => resolved,
        then: resolved.then.bind(resolved),
      });
      return builder;
    };
    const supabase = {
      from: vi.fn((table: string) => {
        started.push(table);
        if (table === 'course_applications') return query(table, applicationResult);
        if (table === 'work_experiences') return query(table, { data: [], error: null });
        if (table === 'student_achievements') return query(table, { data: [], error: null });
        if (table === 'student_activities') return query(table, { data: [], error: null });
        return query(table, { data: null, error: null });
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.fetchApplicationWorkspace.mockResolvedValue(null);

    const loading = loadCvBuilderContext('app-1', {
      id: 'user-1',
      email: 'alex@example.com',
      name: 'Alex Nguyen',
      userMetadata: {},
    });

    await vi.waitFor(() => expect(started).toContain('course_applications'));
    expect(started).toEqual(
      expect.arrayContaining([
        'student_profiles',
        'work_experiences',
        'student_achievements',
        'student_activities',
      ]),
    );
    const profileSelect = selects['student_profiles']?.join(' ') ?? '';
    expect(profileSelect).not.toContain('achievements');
    expect(mocks.fetchApplicationWorkspace).not.toHaveBeenCalled();

    resolveApplication({ data: null, error: null });
    await expect(loading).resolves.toBeNull();
  });
});
