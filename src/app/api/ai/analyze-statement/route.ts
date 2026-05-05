import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const systemPrompt = `You are an expert university admissions consultant who reviews personal statements and statements of purpose. You provide specific, actionable feedback to help students strengthen their applications.

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

Provide 3-5 suggestions. Each suggestion must quote EXACT text from the document.

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
        max_tokens: 2000,
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

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze statement. Please try again.' },
      { status: 500 },
    );
  }
}
