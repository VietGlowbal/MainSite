import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeCourseMatchInsights } from '@/lib/ai/match-insights';
import { extractDocumentText } from '@/lib/ai/document-text';
import {
  weightedScore,
  matchLabel,
  maxMatchLabel,
  MATCH_PILLARS,
  MATCH_PROMPT_VERSION,
  type PillarKey,
} from '@/lib/match-insights';

/**
 * POST /api/applications/[id]/match-insights
 *
 * Runs (or returns a cached) five-pillar match analysis for a course
 * application. Free users are rate-limited to one fresh analysis per 24h per
 * application; Plus users can re-run on demand. Stores the result on
 * application_match_analyses (pillars + aggregates) and returns it.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  // Application (must belong to the user) + its course row.
  const { data: application, error: appErr } = await supabase
    .from('course_applications')
    .select('*, courses (*)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .single();
  if (appErr || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Profile (for Plus gating + the candidate's details).
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPlus = Boolean(profile?.plus_status);

  // Free-tier rate limit: reuse a recent analysis instead of paying for another.
  const { data: latest } = await supabase
    .from('application_match_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isPlus && latest) {
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, cached: true, analysis: latest });
    }
  }

  // Candidate documents (CV + statement/essay). NB: the table columns are
  // `type` (not document_type) and the file text is extracted on demand —
  // nothing pre-populates it. We read it once and cache it back to parsed_text.
  const admin = createAdminClient();
  const { data: documents } = await supabase
    .from('uploaded_documents')
    .select('id, type, storage_key, mime_type, parsed_text')
    .eq('user_id', user.id);

  // Document types as actually stored by our upload flows.
  const ESSAY_TYPES = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];

  type DocRow = {
    id: string;
    type: string;
    storage_key: string;
    mime_type: string | null;
    parsed_text: string | null;
  };
  const docs = (documents ?? []) as DocRow[];

  // Get a document's text from the cache, or extract it from storage and cache it.
  async function textFor(doc: DocRow | undefined): Promise<string | undefined> {
    if (!doc) return undefined;
    if (doc.parsed_text && doc.parsed_text.trim()) return doc.parsed_text;
    const text = await extractDocumentText(admin, doc.storage_key, doc.mime_type);
    if (text) {
      await admin.from('uploaded_documents').update({ parsed_text: text }).eq('id', doc.id);
      return text;
    }
    return undefined;
  }

  const cvDoc = docs.find((d) => d.type === 'cv');
  const essayDoc = docs.find((d) => ESSAY_TYPES.includes(d.type));
  const cvText = await textFor(cvDoc);
  const essayText = await textFor(essayDoc);

  // A document was uploaded but we couldn't read its text (e.g. a scanned image
  // PDF or a .docx). We tell the AI so it doesn't claim "no CV provided".
  const notes: string[] = [];
  if (cvDoc && !cvText) notes.push('The candidate uploaded a CV, but its text could not be extracted (it may be a scanned image or an unsupported format).');
  if (essayDoc && !essayText) notes.push('The candidate uploaded a statement/essay, but its text could not be extracted.');

  const achievements: string[] = Array.isArray(profile?.achievements) ? profile.achievements : [];

  // Don't burn an AI call (or store a misleading 0%) when there's genuinely
  // nothing readable to assess — guide the user instead.
  const hasAnyInput = Boolean(
    cvText ||
      essayText ||
      profile?.academic_background ||
      profile?.grades_summary ||
      achievements.length > 0,
  );
  if (!hasAnyInput) {
    const couldntRead = (cvDoc || essayDoc) ? true : false;
    return NextResponse.json(
      {
        error: couldntRead
          ? 'We couldn’t read your uploaded document — try a text-based PDF (not a scan) or add your grades, then re-analyse.'
          : 'Add your CV, personal statement or grades first so we can score your match.',
        needsInputs: true,
      },
      { status: 422 },
    );
  }

  let insights;
  try {
    insights = await analyzeCourseMatchInsights({
      course: {
        universityName: application.university_name,
        courseName: application.course_name,
        subject: application.subject ?? application.courses?.subject,
        degreeLevel: application.degree_level ?? application.courses?.degree_level,
        entryRequirements: application.courses?.entry_requirements_summary,
        englishRequirements: application.courses?.english_requirements_summary,
        summary: application.ai_summary,
      },
      profile: {
        academicBackground: profile?.academic_background,
        grades: profile?.grades_summary,
        testScores: profile?.grades_summary,
        activities: achievements.join(', '),
        achievements: achievements.join(', '),
        personalContext: profile?.bio,
      },
      cvText,
      essayText,
      notes,
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('[match-insights] analysis failed', err);
    return NextResponse.json({ error: 'Match analysis failed. Please try again.' }, { status: 502 });
  }

  // Aggregates for the legacy scalar columns + list views.
  const currentScore = weightedScore(insights.pillars, 'current');
  const maxScore = weightedScore(insights.pillars, 'max');

  const strengths = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.strengths ?? []).slice(0, 6);
  const weaknesses = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.gaps ?? []).slice(0, 6);
  const improvementActions = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.improvements ?? []);
  const explanation = MATCH_PILLARS.map((p) => {
    const b = insights.pillars[p.key];
    return b?.summary ? `${p.label}: ${b.summary}` : null;
  })
    .filter(Boolean)
    .join(' ');

  const { data: inserted, error: insErr } = await supabase
    .from('application_match_analyses')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      profile_version: profile?.profile_version ?? 1,
      current_match_score: currentScore,
      max_possible_match_score: maxScore,
      score_label: matchLabel(currentScore),
      max_score_label: maxMatchLabel(maxScore),
      pillars: insights.pillars,
      confidence: insights.confidence,
      inputs_present: insights.inputsPresent,
      strengths,
      weaknesses,
      improvement_actions: improvementActions,
      explanation,
      model_name: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      prompt_version: MATCH_PROMPT_VERSION,
      analysis_status: 'complete',
    })
    .select()
    .single();

  if (insErr) {
    console.error('[match-insights] store failed', insErr);
    // The pillars/confidence/inputs_present columns come from
    // supabase-match-insights.sql. If they're missing, Postgres raises an
    // undefined_column (42703) error — surface a clear, actionable message
    // instead of a generic 500 so it's obvious the migration must be applied.
    const needsMigration =
      insErr.code === '42703' || /pillars|confidence|inputs_present/i.test(insErr.message ?? '');
    if (needsMigration) {
      return NextResponse.json(
        {
          error:
            'Match Insights needs a one-time database update. Run supabase-match-insights.sql in the Supabase SQL editor, then try again.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not save the analysis.' }, { status: 500 });
  }

  // Tell the client which pillars are unlockable (for the "unlock X%" nudges).
  const unassessed = MATCH_PILLARS.filter((p) => !insights.pillars[p.key]?.assessed).map(
    (p) => p.key as PillarKey,
  );

  return NextResponse.json({ ok: true, cached: false, analysis: inserted, unassessed });
}
