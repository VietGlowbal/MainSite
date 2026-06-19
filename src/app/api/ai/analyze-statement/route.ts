import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FREE_SOP_ANALYSES } from '@/lib/plus';

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
  const { text, docType, targetUniversity } = body as {
    text: string;
    docType?: string;
    targetUniversity?: string;
  };

  if (!text || text.trim().length < 20) {
    return NextResponse.json(
      { error: 'Please provide at least 20 characters of text to analyze.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Please set OPENAI_API_KEY in .env.local.' },
      { status: 500 },
    );
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // ── Tiering ────────────────────────────────────────────────────────────────
  // Plus subscribers get a "full" analysis that draws on their uploaded CV +
  // profile for tailored strategic recommendations, with a generous token
  // budget. Everyone else gets a "limited" analysis (no CV, small budget),
  // capped at FREE_SOP_ANALYSES free runs.
  const { data: profile } = await supabase
    .from('student_profiles')
    .select(
      'plus_status, sop_analyses_used, profile_summary, bio, achievements, skills, goals, grades_summary, career_interests',
    )
    .eq('user_id', user.id)
    .maybeSingle();

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
  if (isPlus) {
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

  const maxTokens = isPlus ? 2000 : 600;

  const systemPrompt = `You are an expert university admissions consultant who reviews personal statements and statements of purpose. You provide specific, actionable feedback to help students strengthen their applications.${
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

  const userPrompt = `Analyze this ${docType || 'personal statement'}${targetUniversity ? ` for ${targetUniversity}` : ''}:

---
${text}
---
${backgroundBlock ? `\nStudent background (use for strategic, personalised recommendations):\n${backgroundBlock}\n` : ''}
Respond with JSON only.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
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
    const analysis = JSON.parse(cleaned);

    // Meter free usage (best-effort; only when we have a profile row to update).
    if (!isPlus && profile) {
      await supabase
        .from('student_profiles')
        .update({ sop_analyses_used: usedSoFar + 1 })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ ...analysis, limited: !isPlus });
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze statement. Please try again.' },
      { status: 500 },
    );
  }
}
