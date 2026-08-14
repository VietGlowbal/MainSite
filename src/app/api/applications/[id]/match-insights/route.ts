import { NextResponse } from 'next/server';
import {
  getPersonalReportV2Record,
  loadCandidateContext,
  stableHash,
} from '@/features/apply/api';
import { candidateConfidence, programmeFitSchema } from '@/features/apply/domain';
import { analyzeCourseMatchInsights } from '@/lib/ai/match-insights';
import { extractDocumentText } from '@/lib/ai/document-text';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  weightedScore,
  matchLabel,
  maxMatchLabel,
  MATCH_PILLARS,
  MATCH_PROMPT_VERSION,
  type PillarKey,
} from '@/lib/match-insights';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const ESSAY_TYPES = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];

type DocRow = {
  id: string;
  type: string;
  storage_key: string;
  mime_type: string | null;
  parsed_text: string | null;
};

function text(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        /input_hash|fit_dimensions|fit_eligibility|fit_classification|fit_confidence|fit_limitations/i.test(
          error.message ?? '',
        )),
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = user.id;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });

  const { data: application, error: appError } = await supabase
    .from('course_applications')
    .select('*, courses (*)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();
  if (appError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const universityId = application.university_id ?? application.courses?.university_id ?? null;
  const [candidate, profileResult, documentsResult, personalResult, universityResult] =
    await Promise.all([
      loadCandidateContext(supabase, userId),
      supabase.from('student_profiles').select('plus_status').eq('user_id', userId).maybeSingle(),
      supabase
        .from('uploaded_documents')
        .select('id,type,storage_key,mime_type,parsed_text')
        .eq('user_id', userId),
      getPersonalReportV2Record(supabase, userId),
      universityId == null
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('universities').select('*').eq('id', universityId).maybeSingle(),
    ]);
  const isPlus = Boolean(profileResult.data?.plus_status);
  const university = (universityResult.data ?? null) as Record<string, unknown> | null;
  const course = (application.courses ?? {}) as Record<string, unknown>;
  const docs = (documentsResult.data ?? []) as DocRow[];
  const admin = createAdminClient();

  async function textFor(doc: DocRow | undefined): Promise<string | undefined> {
    if (!doc) return undefined;
    if (doc.parsed_text?.trim()) return doc.parsed_text.slice(0, 12_000);
    const extracted = await extractDocumentText(admin, doc.storage_key, doc.mime_type);
    if (!extracted) return undefined;
    await admin
      .from('uploaded_documents')
      .update({ parsed_text: extracted })
      .eq('id', doc.id)
      .eq('user_id', userId);
    return extracted.slice(0, 12_000);
  }

  const cvDoc = docs.find((document) => document.type === 'cv');
  const essayDoc = docs.find((document) => ESSAY_TYPES.includes(document.type));
  const [cvText, essayText] = await Promise.all([textFor(cvDoc), textFor(essayDoc)]);
  const notes: string[] = [];
  if (cvDoc && !cvText) {
    notes.push('The candidate uploaded a CV but the system could not read its content.');
  }
  if (essayDoc && !essayText) {
    notes.push('The candidate uploaded an essay but the system could not read its content.');
  }

  const structuredEvidence = JSON.stringify({
    achievements: candidate.achievements,
    activities: candidate.activities,
  }).slice(0, 12_000);
  const profile = candidate.profile;
  const hasAnyInput = Boolean(
    cvText ||
      essayText ||
      profile.academic_background ||
      profile.grades_summary ||
      profile.curriculum_grades ||
      candidate.achievements.length ||
      candidate.activities.length,
  );
  if (!hasAnyInput) {
    return NextResponse.json(
      {
        error: cvDoc || essayDoc
          ? "We couldn't read your document. Use a PDF with selectable text, or add your grades instead."
          : 'Add a CV, essay, grades, or an activity before generating a Matching Report.',
        needsInputs: true,
      },
      { status: 422 },
    );
  }

  const courseInput = {
    universityName: text(application.university_name) ?? 'Unknown university',
    courseName: text(application.course_name) ?? 'Unknown programme',
    subject: text(application.subject ?? course.subject),
    degreeLevel: text(application.degree_level ?? course.degree_level),
    entryRequirements: text(course.entry_requirements_summary),
    englishRequirements: text(course.english_requirements_summary),
    summary: text(application.ai_summary),
    country: text(application.country ?? course.country ?? university?.country),
    duration: text(course.duration),
    studyMode: text(application.study_mode ?? course.study_mode),
    intake: text(application.intake ?? course.intake),
    tuition: text(course.tuition_fee_text ?? university?.tuition_usd),
    deadline: text(application.deadline ?? university?.application_deadline),
    universityInsight: university
      ? [university.specific_insight, university.best_for, university.teaching_style]
          .filter(Boolean)
          .join(' ')
      : null,
    universityRequirements: university
      ? [
          university.gpa_range,
          university.english_requirement,
          university.standardized_test,
          university.special_test,
        ]
          .filter(Boolean)
          .join(' ')
      : null,
    careerOutcomes: university
      ? [university.employability, university.industry_connections, university.internship_coop]
          .filter(Boolean)
          .join(' ')
      : null,
    scholarships: text(university?.scholarship),
    officialUrl: text(application.course_url ?? course.course_url),
  };
  const profileInput = {
    academicBackground: text(profile.academic_background ?? profile.current_qualification),
    grades: text(profile.curriculum_grades ?? profile.grades_summary ?? profile.gpa_value),
    testScores: text({
      english: candidate.englishTests,
      standardized: candidate.standardizedTests,
    }),
    activities: text(candidate.activities),
    achievements: text(candidate.achievements),
    personalContext:
      [
        personalResult.record?.reportV2.coreIdentity.interpretation,
        personalResult.record?.reportV2.drivingForce.explanation,
      ]
        .filter(Boolean)
        .join(' ') || text(profile.goals),
    budget: text({
      budget: profile.budget_range,
      tuitionBudget: profile.tuition_budget_usd,
      funding: profile.funding_source,
    }),
    careerDirection: text({
      interests: profile.career_interests,
      goals: profile.goals,
      subjects: profile.target_subjects,
    }),
    structuredEvidence,
  };
  const inputHash = stableHash({
    candidate,
    course: courseInput,
    profile: profileInput,
    cvText,
    essayText,
  });

  const { data: latestV2, error: latestError } = await supabase
    .from('application_match_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .eq('prompt_version', MATCH_PROMPT_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (migrationMissing(latestError)) {
    return NextResponse.json(
      { error: 'Matching Report needs a database update before it can be used.' },
      { status: 503 },
    );
  }
  if (latestV2?.input_hash === inputHash) {
    return NextResponse.json({ ok: true, cached: true, analysis: latestV2 });
  }
  if (latestV2 && !isPlus) {
    const nextAt = new Date(new Date(latestV2.created_at).getTime() + COOLDOWN_MS);
    if (nextAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: "Your information has changed, but a free report regeneration isn't available yet.",
          stale: true,
          analysis: latestV2,
          nextRegenerationAt: nextAt.toISOString(),
        },
        { status: 429 },
      );
    }
  }

  let insights;
  try {
    insights = await analyzeCourseMatchInsights({
      course: courseInput,
      profile: profileInput,
      cvText,
      essayText,
      notes,
      apiKey,
      model: defaultOpenAIModel(),
    });
  } catch (error) {
    console.error('[match-insights] analysis failed', {
      code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
    return NextResponse.json(
      {
        error: 'The AI could not produce a valid Matching Report. Your previous report has been kept.',
        ...(latestV2 ? { analysis: latestV2 } : {}),
      },
      { status: 502 },
    );
  }

  const candidateQuality = candidateConfidence(candidate).score;
  const courseSignals = [
    courseInput.entryRequirements,
    courseInput.englishRequirements,
    courseInput.tuition,
    courseInput.careerOutcomes,
    courseInput.universityInsight,
  ].filter(Boolean).length;
  const systemFitConfidence = Math.round(
    candidateQuality * 0.55 + (courseSignals / 5) * 100 * 0.45,
  );
  const fit = programmeFitSchema.parse({
    ...insights.programmeFit,
    confidence: Math.min(insights.programmeFit.confidence, systemFitConfidence),
    limitations: [
      ...insights.programmeFit.limitations,
      ...(courseSignals < 3
        ? ['Official programme data is not sufficient to assess every fit dimension.']
        : []),
    ].slice(0, 10),
  });

  const currentScore = weightedScore(insights.pillars, 'current');
  const maxScore = weightedScore(insights.pillars, 'max');
  const strengths = MATCH_PILLARS.flatMap(
    (pillar) => insights.pillars[pillar.key]?.strengths ?? [],
  ).slice(0, 6);
  const weaknesses = MATCH_PILLARS.flatMap(
    (pillar) => insights.pillars[pillar.key]?.gaps ?? [],
  ).slice(0, 6);
  const improvementActions = MATCH_PILLARS.flatMap(
    (pillar) => insights.pillars[pillar.key]?.improvements ?? [],
  );
  const explanation = MATCH_PILLARS.map((pillar) => {
    const breakdown = insights.pillars[pillar.key];
    return breakdown?.summary ? `${pillar.label}: ${breakdown.summary}` : null;
  })
    .filter(Boolean)
    .join(' ');

  const { data: inserted, error: insertError } = await supabase
    .from('application_match_analyses')
    .insert({
      application_id: applicationId,
      user_id: userId,
      profile_version: 1,
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
      model_name: defaultOpenAIModel(),
      prompt_version: MATCH_PROMPT_VERSION,
      input_hash: inputHash,
      fit_dimensions: fit.dimensions,
      fit_eligibility: fit.eligibility,
      fit_classification: fit.classification,
      fit_confidence: fit.confidence,
      fit_limitations: fit.limitations,
      analysis_status: 'complete',
    })
    .select()
    .single();
  if (insertError) {
    console.error('[match-insights] store failed', insertError);
    return NextResponse.json(
      {
        error: migrationMissing(insertError)
          ? 'Matching Report needs a database update before it can be used.'
          : 'Could not save the Matching Report.',
      },
      { status: migrationMissing(insertError) ? 503 : 500 },
    );
  }

  const unassessed = MATCH_PILLARS.filter(
    (pillar) => !insights.pillars[pillar.key]?.assessed,
  ).map((pillar) => pillar.key as PillarKey);
  return NextResponse.json({ ok: true, cached: false, analysis: inserted, unassessed });
}
