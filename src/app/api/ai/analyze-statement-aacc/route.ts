/**
 * VinUniversity-specific SOP analyzer.
 *
 * Scores a Statement of Purpose against VinUni's official AACC rubric:
 *   - Outstanding Ability   (Năng lực Vượt trội)
 *   - Aspirations           (Khát vọng)
 *   - Creativity            (Sáng tạo)
 *   - Commitment            (Cam kết)
 *
 * Output schema is intentionally distinct from /api/ai/analyze-statement
 * (the generic writer endpoint) — VinUni wants per-pillar evidence, not
 * generic suggestions. Each request costs ~$0.003–0.005 on gpt-4o-mini
 * for an 800-word SOP.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MIN_LENGTH = 200;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text : '';

  if (!text || text.trim().length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `Please provide at least ${MIN_LENGTH} characters of SOP text.` },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured. Set OPENAI_API_KEY in .env.local.' },
      { status: 500 },
    );
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const systemPrompt = `You are a senior VinUniversity (Hanoi, Vietnam) admissions officer. VinUni evaluates candidates holistically against the AACC framework, which has FOUR pillars:

1. OUTSTANDING ABILITY (Năng lực Vượt trội): exceptional academic or skill-based capability that predicts future success. Evidence: high GPA, SAT/AP/National exam scores, competition results, published work, sharp analytical/English skills, excellence in sports/arts/tech.

2. ASPIRATIONS (Khát vọng): deep understanding of societal challenges plus drive to solve them. Evidence: purpose-driven goals, social impact projects, leadership stepping up, meaningful hobbies anchored in real-world problems.

3. CREATIVITY (Sáng tạo): high curiosity, adaptability, novel solutions. Evidence: divergent thinking, root-cause questioning, healthy norm-breaking for positive change, sharp logical debate.

4. COMMITMENT (Cam kết): resilience and grit. Evidence: perseverance through hardship, long-term dedication to one or two arcs, determination to push for top outcomes despite setbacks.

You will receive a Statement of Purpose. Score how strongly the SOP demonstrates each pillar with verifiable, lived evidence — NOT how nicely the prose flows. Reward specific quantified evidence; penalise generic claims like "I am a hard worker" without proof.

You MUST respond with valid JSON only — no markdown, no code fences, no commentary. Match this exact schema:

{
  "overall": {
    "score": <integer 0-100>,
    "verdict": <"strong-fit" | "promising" | "needs-work" | "misaligned">,
    "summary": "<2-3 sentence assessment of overall fit with VinUni>"
  },
  "pillars": {
    "ability":     { "score": <0-100>, "strengths": ["<bullet>", ...], "gaps": ["<bullet>", ...], "evidenceQuotes": ["<short verbatim quote>", ...] },
    "aspirations": { "score": <0-100>, "strengths": [...], "gaps": [...], "evidenceQuotes": [...] },
    "creativity":  { "score": <0-100>, "strengths": [...], "gaps": [...], "evidenceQuotes": [...] },
    "commitment":  { "score": <0-100>, "strengths": [...], "gaps": [...], "evidenceQuotes": [...] }
  },
  "topRecommendations": [
    { "id": "<rec-1>", "pillar": "<ability|aspirations|creativity|commitment>", "action": "<one-sentence imperative>", "rationale": "<why it strengthens VinUni fit>" }
  ],
  "redFlags": ["<short warning>", ...]
}

Rules:
- Each pillar object MUST have 1-3 strengths, 1-3 gaps, and 1-2 verbatim evidenceQuotes (exact substrings of the SOP — copy character-for-character, do not paraphrase). If a pillar has no evidence in the text, evidenceQuotes is an empty array and gaps must call that out.
- topRecommendations MUST have 3-5 items. Prioritise the pillar(s) with the lowest scores.
- redFlags is optional. Use it ONLY for serious issues: factual inconsistency, plagiarism signals, off-topic content, misalignment with VinUni's English-taught environment.
- Verdict mapping (use as a guide):
    90-100 strong-fit  | 70-89 promising | 50-69 needs-work | 0-49 misaligned`;

  const userPrompt = `Analyse this Statement of Purpose for VinUniversity admission against the AACC rubric:

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
        temperature: 0.4,
        max_tokens: 2200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI AACC error:', errorData);
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.' },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 502 },
      );
    }

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AACC analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyse SOP. Please try again.' },
      { status: 500 },
    );
  }
}
