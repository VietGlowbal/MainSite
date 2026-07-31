import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDocumentText } from '@/lib/ai/document-text';
import type { ApplicationStrategyContext, StrategySource, StructuredCv } from '../domain';
import { getStatementDraft, getStructuredCv } from './strategy-repository';

/**
 * Everything a Feature 2 AI operation is allowed to know, assembled once.
 *
 * WHY ONE ASSEMBLER. Five operations need overlapping slices of the same facts —
 * the candidate, the programme, and the two documents. Assembling per operation
 * is how they drift: the CV reviewer would end up seeing achievements that the
 * statement analyzer does not, and a claim the AI made in one place would be
 * unsupportable in the other. It also means the trust rules have one place to
 * be enforced, because there is one place the model's knowledge comes from.
 *
 * WHY THE `notes` FIELD. A CV that was uploaded but could not be read (a scan, a
 * .docx) is NOT the same as no CV. Without being told, the model reports "no CV
 * provided", which reads to the student as their upload having been ignored. The
 * match-insights route already learned this; the same fix is applied here.
 *
 * WHY THE ADMIN CLIENT IS A SEPARATE ARGUMENT. Text extraction downloads from
 * the `student-documents` bucket and caches the result back to
 * `uploaded_documents.parsed_text`. That is the one part of this that needs to
 * escape RLS, so it is passed in explicitly rather than constructed here — the
 * caller can see what it granted.
 */

/** Document types the upload flows actually write for a statement. */
const ESSAY_TYPES = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];

type DocRow = {
  id: string;
  type: string;
  storage_key: string;
  mime_type: string | null;
  parsed_text: string | null;
};

export type StrategyContextResult = ApplicationStrategyContext & {
  /** Which inputs were genuinely available, for the "incomplete" states. */
  inputsPresent: {
    profile: boolean;
    cv: boolean;
    statement: boolean;
    activities: boolean;
    programme: boolean;
  };
};

export async function assembleStrategyContext(args: {
  supabase: SupabaseClient;
  /** Service-role client, needed only to read storage and cache parsed text. */
  admin: SupabaseClient;
  userId: string;
  applicationId: string;
  strategyId: string;
  application: Record<string, unknown>;
}): Promise<StrategyContextResult> {
  const { supabase, admin, userId, applicationId, strategyId, application } = args;

  const [{ data: profile }, { data: achievements }, { data: activities }, { data: documents }, { data: sources }] =
    await Promise.all([
      supabase.from('student_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('student_achievements')
        .select('category, title, competition, organisation, level, year, detail')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('student_activities')
        .select('category, title, organisation, level, period, description')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('uploaded_documents')
        .select('id, type, storage_key, mime_type, parsed_text')
        .eq('user_id', userId),
      supabase
        .from('application_sources')
        .select('source_type, title, url, is_official')
        .eq('application_id', applicationId),
    ]);

  const docs = (documents ?? []) as DocRow[];
  const cvDoc = docs.find((d) => d.type === 'cv');
  const essayDoc = docs.find((d) => ESSAY_TYPES.includes(d.type));

  /** Cached text, or extract once and cache it back. */
  async function textFor(doc: DocRow | undefined): Promise<string | null> {
    if (!doc) return null;
    if (doc.parsed_text && doc.parsed_text.trim()) return doc.parsed_text;
    const text = await extractDocumentText(admin, doc.storage_key, doc.mime_type);
    if (text) {
      await admin.from('uploaded_documents').update({ parsed_text: text }).eq('id', doc.id);
      return text;
    }
    return null;
  }

  const [cvText, uploadedStatementText, structuredCv, draft] = await Promise.all([
    textFor(cvDoc),
    textFor(essayDoc),
    getStructuredCv(supabase, strategyId),
    getStatementDraft(supabase, applicationId),
  ]);

  /*
   * The in-app draft wins over an uploaded file. If a student has been writing
   * in the editor, that is the current statement; the upload is what they
   * started from. Analysing the older text would produce feedback on passages
   * that no longer exist.
   */
  const statementText = draft?.content?.trim() ? draft.content : uploadedStatementText;

  const notes: string[] = [];
  if (cvDoc && !cvText) {
    notes.push(
      'The candidate uploaded a CV, but its text could not be extracted (it may be a scanned image or an unsupported format). Do not state that no CV was provided.',
    );
  }
  if (essayDoc && !uploadedStatementText && !statementText) {
    notes.push(
      'The candidate uploaded a personal statement, but its text could not be extracted. Do not state that no statement was provided.',
    );
  }
  if (structuredCv && structuredCv.sections.length > 0 && !cvText) {
    notes.push(
      'The candidate has structured CV content in Glowbal even though no CV file text is available. Assess the structured content.',
    );
  }

  const courses = (application.courses ?? null) as Record<string, unknown> | null;

  const requirements =
    str(courses?.entry_requirements_summary) ??
    str(application.entry_requirements_summary) ??
    null;

  return {
    candidate: {
      academics: buildAcademics(profile),
      achievements: achievements ?? [],
      activities: activities ?? [],
      goals: str(profile?.career_goals) ?? str(profile?.bio) ?? null,
      preferences: {
        preferredCountries: profile?.preferred_countries ?? null,
        targetSubjects: profile?.target_subjects ?? null,
        studyLevel: str(profile?.study_level) ?? null,
        fundingSource: str(profile?.funding_source) ?? null,
      },
    },
    application: {
      universityName: str(application.university_name) ?? '',
      courseName: str(application.course_name) ?? '',
      requirements,
      courseSummary: str(application.ai_summary) ?? str(courses?.course_summary) ?? null,
      deadline: str(application.deadline) ?? null,
      sources: mapSources(sources),
    },
    documents: {
      cvText,
      structuredCv: structuredCv as StructuredCv | null,
      statementText: statementText ?? null,
    },
    notes,
    inputsPresent: {
      profile: Boolean(profile?.academic_background || profile?.grades_summary),
      cv: Boolean(cvText || (structuredCv && structuredCv.sections.length > 0)),
      statement: Boolean(statementText),
      activities: (achievements?.length ?? 0) + (activities?.length ?? 0) > 0,
      programme: Boolean(requirements || courses),
    },
  };
}

/**
 * The candidate's academic picture as one readable block.
 *
 * Flattened rather than passed as fields because the model reads it as prose and
 * because `grades_summary` is a JSONB blob whose shape has changed twice; a
 * stringified version that says what it is beats a nested object the prompt has
 * to explain.
 */
function buildAcademics(profile: Record<string, unknown> | null): string | null {
  if (!profile) return null;
  const parts: string[] = [];
  const background = str(profile.academic_background);
  if (background) parts.push(background);
  const qualification = str(profile.current_qualification);
  if (qualification) parts.push(`Current qualification: ${qualification}`);
  const grades = profile.grades_summary;
  if (grades && typeof grades === 'object') {
    parts.push(`Grades: ${JSON.stringify(grades)}`);
  } else {
    const gradesText = str(grades);
    if (gradesText) parts.push(`Grades: ${gradesText}`);
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

function mapSources(
  rows: Array<{ source_type?: string | null; title?: string | null; url?: string | null }> | null,
): StrategySource[] {
  if (!rows) return [];
  return rows
    .filter((r): r is { source_type: string; title: string; url: string } => Boolean(r.url))
    .map((r) => ({
      field: r.source_type ?? 'programme',
      url: r.url,
      heading: r.title ?? null,
      snippet: null,
    }));
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
