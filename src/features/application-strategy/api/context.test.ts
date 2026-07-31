import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * The assembler decides what the model is allowed to know, so its edge cases are
 * the feature's trust guarantees: an unreadable upload must not read as "no CV",
 * and the in-app draft must win over a stale uploaded file.
 */
const extractDocumentText = vi.fn();

vi.mock('@/lib/ai/document-text', () => ({
  extractDocumentText: (...args: unknown[]) => extractDocumentText(...args),
}));

const USER = '11111111-1111-4111-8111-111111111111';
const APP = '22222222-2222-4222-8222-222222222222';
const STRATEGY = '33333333-3333-4333-8333-333333333333';

type TableData = Record<string, unknown[] | unknown | null>;

/**
 * A Supabase double driven by a table→data map. The query builder is
 * thenable-free: every terminal call resolves from whatever the table holds.
 */
function supabaseDouble(tables: TableData) {
  const updates: Array<{ table: string; values: unknown }> = [];

  function builder(table: string) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: () =>
        Promise.resolve({ data: single(tables[table]), error: null }),
      single: () => Promise.resolve({ data: single(tables[table]), error: null }),
      update: (values: unknown) => {
        updates.push({ table, values });
        return chain;
      },
      insert: () => chain,
      upsert: () => chain,
      // `await supabase.from(x).select(...).eq(...)` with no terminal call.
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: tables[table] ?? null, error: null }).then(resolve),
    };
    return chain;
  }

  return {
    client: { from: (table: string) => builder(table) } as unknown as SupabaseClient,
    updates,
  };
}

function single(value: unknown) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const APPLICATION = {
  university_name: 'University of Manchester',
  course_name: 'BSc Computer Science',
  deadline: '2027-01-15',
  ai_summary: 'Three-year CS degree with an industrial placement option.',
  courses: { entry_requirements_summary: 'AAA at A-level including Mathematics' },
};

async function subject() {
  return import('./context');
}

beforeEach(() => {
  vi.resetModules();
  extractDocumentText.mockReset();
});

describe('assembleStrategyContext', () => {
  it('assembles candidate, programme and document facts', async () => {
    extractDocumentText.mockResolvedValue('Led a team of four on a robotics project.');

    const { client } = supabaseDouble({
      student_profiles: {
        academic_background: 'Nguyen Hue High School for the Gifted',
        current_qualification: 'Vietnamese High School Diploma',
        grades_summary: { gpa: '9.2', ielts: '7.5' },
        career_goals: 'Build accessible software',
        preferred_countries: ['UK'],
        target_subjects: ['Computer Science'],
        study_level: 'undergraduate',
      },
      student_achievements: [{ title: 'National Informatics Olympiad, second prize' }],
      student_activities: [{ title: 'Founded the school coding club' }],
      uploaded_documents: [
        { id: 'd1', type: 'cv', storage_key: 'k/cv.pdf', mime_type: 'application/pdf', parsed_text: null },
      ],
      application_sources: [
        { source_type: 'entry_requirements', title: 'Entry requirements', url: 'https://x.ac.uk/entry' },
      ],
      structured_cvs: null,
      personal_statements: null,
    });

    const { assembleStrategyContext } = await subject();
    const ctx = await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: APPLICATION,
    });

    expect(ctx.application.universityName).toBe('University of Manchester');
    expect(ctx.application.requirements).toBe('AAA at A-level including Mathematics');
    expect(ctx.application.sources[0]?.url).toBe('https://x.ac.uk/entry');
    expect(ctx.candidate.academics).toContain('Nguyen Hue High School');
    expect(ctx.candidate.academics).toContain('9.2');
    expect(ctx.candidate.goals).toBe('Build accessible software');
    expect(ctx.documents.cvText).toContain('robotics project');
    expect(ctx.inputsPresent).toMatchObject({ profile: true, cv: true, activities: true });
    expect(ctx.notes).toEqual([]);
  });

  it('notes an uploaded-but-unreadable CV instead of reporting none', async () => {
    // The failure this prevents: the model saying "no CV provided" to a student
    // who uploaded a scan, which reads as their upload being ignored.
    extractDocumentText.mockResolvedValue(null);

    const { client } = supabaseDouble({
      student_profiles: null,
      student_achievements: [],
      student_activities: [],
      uploaded_documents: [
        { id: 'd1', type: 'cv', storage_key: 'k/scan.pdf', mime_type: 'application/pdf', parsed_text: null },
      ],
      application_sources: [],
      structured_cvs: null,
      personal_statements: null,
    });

    const { assembleStrategyContext } = await subject();
    const ctx = await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: APPLICATION,
    });

    expect(ctx.documents.cvText).toBeNull();
    expect(ctx.notes.join(' ')).toContain('could not be extracted');
    expect(ctx.notes.join(' ')).toContain('Do not state that no CV was provided');
    expect(ctx.inputsPresent.cv).toBe(false);
  });

  it('caches extracted text back so the next call does not re-download', async () => {
    extractDocumentText.mockResolvedValue('Extracted CV body.');

    const { client, updates } = supabaseDouble({
      student_profiles: null,
      student_achievements: [],
      student_activities: [],
      uploaded_documents: [
        { id: 'd1', type: 'cv', storage_key: 'k/cv.pdf', mime_type: 'application/pdf', parsed_text: null },
      ],
      application_sources: [],
      structured_cvs: null,
      personal_statements: null,
    });

    const { assembleStrategyContext } = await subject();
    await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: APPLICATION,
    });

    expect(updates).toEqual([
      { table: 'uploaded_documents', values: { parsed_text: 'Extracted CV body.' } },
    ]);
  });

  it('does not re-extract when text is already cached', async () => {
    const { client } = supabaseDouble({
      student_profiles: null,
      student_achievements: [],
      student_activities: [],
      uploaded_documents: [
        { id: 'd1', type: 'cv', storage_key: 'k/cv.pdf', mime_type: 'application/pdf', parsed_text: 'Cached body.' },
      ],
      application_sources: [],
      structured_cvs: null,
      personal_statements: null,
    });

    const { assembleStrategyContext } = await subject();
    const ctx = await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: APPLICATION,
    });

    expect(extractDocumentText).not.toHaveBeenCalled();
    expect(ctx.documents.cvText).toBe('Cached body.');
  });

  it('prefers the in-app draft over an older uploaded statement', async () => {
    // Analysing the upload would produce feedback on passages the student has
    // already rewritten.
    extractDocumentText.mockResolvedValue('The uploaded, older statement.');

    const { client } = supabaseDouble({
      student_profiles: null,
      student_achievements: [],
      student_activities: [],
      uploaded_documents: [
        {
          id: 'd2',
          type: 'personal_statement',
          storage_key: 'k/ps.pdf',
          mime_type: 'application/pdf',
          parsed_text: null,
        },
      ],
      application_sources: [],
      structured_cvs: null,
      personal_statements: {
        id: 7,
        content: 'The draft I am actually writing.',
        version: 4,
        updated_at: '2026-07-01T00:00:00Z',
      },
    });

    const { assembleStrategyContext } = await subject();
    const ctx = await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: APPLICATION,
    });

    expect(ctx.documents.statementText).toBe('The draft I am actually writing.');
    expect(ctx.inputsPresent.statement).toBe(true);
  });

  it('degrades to an empty context rather than throwing for a bare profile', async () => {
    // Requirement: missing recommended inputs produce an actionable incomplete
    // state, never a blocked feature.
    const { client } = supabaseDouble({
      student_profiles: null,
      student_achievements: [],
      student_activities: [],
      uploaded_documents: [],
      application_sources: [],
      structured_cvs: null,
      personal_statements: null,
    });

    const { assembleStrategyContext } = await subject();
    const ctx = await assembleStrategyContext({
      supabase: client,
      admin: client,
      userId: USER,
      applicationId: APP,
      strategyId: STRATEGY,
      application: { university_name: 'X', course_name: 'Y' },
    });

    expect(ctx.candidate.academics).toBeNull();
    expect(ctx.documents.cvText).toBeNull();
    expect(ctx.documents.statementText).toBeNull();
    expect(ctx.notes).toEqual([]);
    expect(ctx.inputsPresent).toEqual({
      profile: false,
      cv: false,
      statement: false,
      activities: false,
      programme: false,
    });
  });
});
