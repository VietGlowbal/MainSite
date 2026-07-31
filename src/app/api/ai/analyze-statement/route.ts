import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';
import { FREE_SOP_ANALYSES } from '@/lib/plus';

const AIAnalysisSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  suggestions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['weak', 'missing', 'impact']),
      category: z.string(),
      originalText: z.string(),
      replacement: z.string(),
      explanation: z.string(),
    }),
  ),
  checklist: z.array(
    z.object({
      id: z.number(),
      text: z.string(),
      met: z.boolean(),
    }),
  ),
});

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { text, docType, targetUniversity, applicationId } = body as {
    text: string;
    docType?: string;
    targetUniversity?: string;
    applicationId?: string;
  };
  const isLor = docType === 'recommendation_letter';
  const minimumLength = isLor ? 80 : 20;

  if (typeof text !== 'string' || text.trim().length < minimumLength || text.length > 15_000) {
    return NextResponse.json(
      {
        error: `Please provide between ${minimumLength} and 15,000 characters of text to analyze.`,
      },
      { status: 400 },
    );
  }

  const workspace = isLor && applicationId
    ? await fetchApplicationWorkspace(applicationId, user.id)
    : null;
  if (isLor && !applicationId) {
    return NextResponse.json({ error: 'Application ID is required.' }, { status: 400 });
  }
  if (isLor && !workspace) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Please set DEEPSEEK_API_KEY in .env.local.' },
      { status: 500 },
    );
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

  // ── Tiering ────────────────────────────────────────────────────────────────
  // Plus subscribers get a "full" analysis that draws on their uploaded CV +
  // profile for tailored strategic recommendations, with a generous token
  // budget. Everyone else gets a "limited" analysis (no CV, small budget),
  // capped at FREE_SOP_ANALYSES free runs.
  type ProfileRow = {
    plus_status?: boolean | null;
    sop_analyses_used?: number | null;
    profile_summary?: string | null;
    bio?: string | null;
    achievements?: unknown;
    skills?: unknown;
    goals?: string | null;
    grades_summary?: unknown;
    career_interests?: unknown;
  };
  let profile: ProfileRow | null;
  if (isLor) {
    const result = await supabase
      .from('student_profiles')
      .select('plus_status, sop_analyses_used')
      .eq('user_id', user.id)
      .maybeSingle();
    profile = result.data;
  } else {
    const result = await supabase
      .from('student_profiles')
      .select(
        'plus_status, sop_analyses_used, profile_summary, bio, achievements, skills, goals, grades_summary, career_interests',
      )
      .eq('user_id', user.id)
      .maybeSingle();
    profile = result.data as ProfileRow | null;
  }

  const isPlus = !!profile?.plus_status;
  const usedSoFar = (profile?.sop_analyses_used as number | undefined) ?? 0;

  if (!isPlus && usedSoFar >= FREE_SOP_ANALYSES) {
    return NextResponse.json(
      {
        error: `You've used your ${FREE_SOP_ANALYSES} free statement reviews. Upgrade to GlowBal Plus for unlimited, CV-tailored feedback.`,
        upgrade: true,
      },
      { status: 402 },
    );
  }

  // Build an optional "Student background" block (Plus only) from CV + profile.
  let backgroundBlock = '';
  if (isPlus && !isLor) {
    const { data: cv } = await supabase
      .from('uploaded_documents')
      .select('parsed_summary')
      .eq('user_id', user.id)
      .eq('type', 'cv')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const parts: string[] = [];
    if (cv?.parsed_summary) parts.push(`CV summary: ${cv.parsed_summary}`);
    if (profile?.profile_summary) parts.push(`Profile: ${profile.profile_summary}`);
    if (profile?.bio) parts.push(`Bio: ${profile.bio}`);
    if (Array.isArray(profile?.achievements) && profile!.achievements.length > 0) {
      parts.push(`Achievements: ${JSON.stringify(profile!.achievements)}`);
    }
    if (Array.isArray(profile?.skills) && profile!.skills.length > 0) {
      parts.push(`Skills: ${(profile!.skills as string[]).join(', ')}`);
    }
    if (profile?.goals) parts.push(`Goals: ${profile.goals}`);
    if (Array.isArray(profile?.career_interests) && profile!.career_interests.length > 0) {
      parts.push(`Career interests: ${(profile!.career_interests as string[]).join(', ')}`);
    }
    if (profile?.grades_summary) parts.push(`Grades: ${JSON.stringify(profile.grades_summary)}`);

    if (parts.length > 0) {
      // Cap length so we never blow up the prompt.
      backgroundBlock = parts.join('\n').slice(0, 2500);
    }
  }

  const maxTokens = isPlus ? 2000 : 1200;

  const lorContext = workspace
    ? [
        `University: ${workspace.application.universityName}`,
        `Programme: ${workspace.application.courseName}`,
        workspace.application.degreeLevel
          ? `Degree level: ${workspace.application.degreeLevel}`
          : '',
        workspace.application.subject ? `Subject: ${workspace.application.subject}` : '',
        workspace.course?.entryRequirementsSummary
          ? `Entry requirements: ${workspace.course.entryRequirementsSummary}`
          : '',
        workspace.application.aiSummary
          ? `Programme summary: ${workspace.application.aiSummary}`
          : '',
        ...workspace.requirements
          .slice(0, 8)
          .map(({ requirementText }) => `Requirement: ${requirementText}`),
        ...workspace.sources
          .filter(({ isOfficial }) => isOfficial)
          .slice(0, 5)
          .map(({ title, description, url }) =>
            `Official source: ${title}${description ? ` — ${description}` : ''} (${url})`,
          ),
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 4000)
    : '';

  const systemPrompt = isLor
    ? `You are an expert university admissions consultant reviewing a Letter of Recommendation for a specific university programme. Give specific, actionable feedback while preserving the recommender's authentic professional voice.

Use only facts present in the draft and the supplied programme context. Never invent an achievement, role, relationship, comparison, or personal detail. When evidence is missing, ask for it or use a clearly marked placeholder.

Evaluate:
- clarity of the recommender's relationship and point of view
- specific, credible evidence of the applicant's qualities and impact
- relevance to the target university and programme
- authentic, professional recommender voice
- avoidance of generic praise, unsupported claims, and CV-like listing
- persuasive structure and conclusion

You MUST respond with valid JSON only — no markdown, no code fences, no extra text. The JSON must match this exact schema:

{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "suggestions": [
    {
      "id": "<unique string like sug-1>",
      "type": "<one of: weak, missing, impact>",
      "category": "<e.g. Recommender Context, Evidence, Programme Fit, Voice, Structure>",
      "originalText": "<exact quote from the letter that needs improvement>",
      "replacement": "<improved version using no invented facts>",
      "explanation": "<why this change matters>"
    }
  ],
  "checklist": [
    {
      "id": <number>,
      "text": "<LOR criterion>",
      "met": <boolean>
    }
  ]
}

Provide ${isPlus ? '3-5' : '2-3'} suggestions and 5-7 checklist items. Every originalText must quote exact text from the letter.`
    : `You are an expert university admissions consultant who reviews personal statements and statements of purpose. You provide specific, actionable feedback to help students strengthen their applications.${
    backgroundBlock
      ? `\n\nYou are also given the student's background (CV + profile). Use it to make STRATEGIC, personalised recommendations — point out concrete experiences, achievements, or skills from their background they should weave in, and tailor advice to their stated goals.`
      : ''
  }

You MUST respond with valid JSON only — no markdown, no code fences, no extra text. The JSON must match this exact schema:

{
  "score": <number 0-100>,
  "summary": "<2-3 sentence overall assessment>",
  "suggestions": [
    {
      "id": "<unique string like sug-1>",
      "type": "<one of: weak, missing, impact>",
      "category": "<e.g. Vocabulary/Tone, Course Fit, Specificity, Impact, Structure>",
      "originalText": "<exact quote from the text that needs improvement>",
      "replacement": "<improved version of that text>",
      "explanation": "<why this change matters>"
    }
  ],
  "checklist": [
    {
      "id": <number>,
      "text": "<criteria description>",
      "met": <boolean>
    }
  ]
}

Scoring guide:
- 90-100: Publication-ready, compelling, specific, well-structured
- 70-89: Strong but needs minor improvements
- 50-69: Decent foundation but significant gaps
- 30-49: Needs substantial revision
- 0-29: Major rewrite needed

Provide ${isPlus ? '3-5' : '2-3'} suggestions. Each suggestion must quote EXACT text from the document.

Checklist should include 5-7 items covering:
- Clear academic motivation
- Specific course/university alignment
- Quantified achievements
- Professional academic tone
- Future goals articulated
- Relevant experience highlighted
- Logical structure and flow`;

  const userPrompt = isLor
    ? `Review this Letter of Recommendation against the stored programme context.

Programme context:
${lorContext || 'No detailed programme context is available. Review the letter generally and state that programme-fit feedback is limited.'}

Letter:
---
${text}
---

Respond with JSON only.`
    : `Analyze this ${docType || 'personal statement'}${targetUniversity ? ` for ${targetUniversity}` : ''}:

---
${text}
---
${backgroundBlock ? `\nStudent background (use for strategic, personalised recommendations):\n${backgroundBlock}\n` : ''}
Respond with JSON only.`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.' },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 502 },
      );
    }

    // Parse the JSON response (strip any markdown fences if present)
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let analysis: unknown;
    try {
      analysis = JSON.parse(cleaned) as unknown;
    } catch {
      return NextResponse.json(
        { error: 'AI returned an invalid analysis. Please try again.' },
        { status: 502 },
      );
    }
    const parsedAnalysis = AIAnalysisSchema.safeParse(analysis);
    if (!parsedAnalysis.success) {
      return NextResponse.json(
        { error: 'AI returned an invalid analysis. Please try again.' },
        { status: 502 },
      );
    }

    // Meter free usage (best-effort; only when we have a profile row to update).
    if (!isPlus && profile) {
      await supabase
        .from('student_profiles')
        .update({ sop_analyses_used: usedSoFar + 1 })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ ...parsedAnalysis.data, limited: !isPlus });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze statement. Please try again.' },
      { status: 500 },
    );
  }
}
