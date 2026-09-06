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
import { openAiCompletionParameters } from '@/lib/ai/openai-client';
import {
  streamOpenAIText,
  streamVinUniEvaluation,
  VINUNI_EVALUATION_CONFIG,
  type VinUniStreamEvent,
} from '@/lib/ai/vinuni-grounded-evaluation';
import {
  buildVinUniEvaluationContext,
  streamVinUniEvaluationV2,
  VINUNI_EVALUATION_CONFIG_V2,
  type VinUniRequestedSection,
  type VinUniV2StreamEvent,
} from '@/lib/ai/vinuni-evaluation-v2';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';
import {
  VINUNI_DEMO_APPLICATION_ID,
  VINUNI_DEFAULT_ESSAY_PROMPT,
} from '@/lib/ai/vinuni-evaluation-shared';

const MIN_LENGTH = 200;
const MAX_LENGTH = 15_000;
const MAX_PROMPT_LENGTH = 2_000;
const GROUNDED_PIPELINE_ENABLED = true;
const V2_SECTION_KEYS = new Set<VinUniRequestedSection>([
  'A',
  'B',
  'C',
  'D:ability',
  'D:aspirations',
  'D:creativity',
  'D:commitment',
  'E',
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const applicationId =
    typeof body?.applicationId === 'string' ? body.applicationId.trim() : '';
  const isPublicContext = body?.contextMode === 'vinuni_public';
  const useV2 = Boolean(applicationId || isPublicContext);
  const isDemoId = applicationId === VINUNI_DEMO_APPLICATION_ID;
  const isLocalDemo = useV2 && isDemoId && process.env.NODE_ENV === 'development';

  if (isDemoId && !isLocalDemo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (isPublicContext && applicationId) {
    return NextResponse.json(
      { error: 'vinuni_public context must not include an application ID.' },
      { status: 400 },
    );
  }

  const supabase = isLocalDemo ? null : await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  if (!isLocalDemo && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!text || text.trim().length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `Please provide at least ${MIN_LENGTH} characters of SOP text.` },
      { status: 400 },
    );
  }
  if (text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Bài luận không được vượt quá ${MAX_LENGTH.toLocaleString('vi-VN')} ký tự.` },
      { status: 400 },
    );
  }

  let v2Input:
    | {
        essayPrompt: string;
        requestedSections?: VinUniRequestedSection[];
        context: ReturnType<typeof buildVinUniEvaluationContext>;
      }
    | undefined;
  if (useV2) {
    const essayPrompt =
      typeof body?.essayPrompt === 'string' && body.essayPrompt.trim()
        ? body.essayPrompt.trim()
        : isPublicContext
          ? VINUNI_DEFAULT_ESSAY_PROMPT
          : '';
    const requestedSections = Array.isArray(body?.requestedSections)
      ? body.requestedSections.filter(
          (section: unknown): section is VinUniRequestedSection =>
            typeof section === 'string' &&
            V2_SECTION_KEYS.has(section as VinUniRequestedSection),
        )
      : undefined;
    if (!applicationId && !isPublicContext) {
      return NextResponse.json({ error: 'Application ID is required.' }, { status: 400 });
    }
    if (!essayPrompt || essayPrompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Essay prompt phải có từ 1 đến ${MAX_PROMPT_LENGTH.toLocaleString('vi-VN')} ký tự.` },
        { status: 400 },
      );
    }
    if (
      body?.requestedSections !== undefined &&
      (!Array.isArray(body.requestedSections) ||
        !requestedSections?.length ||
        requestedSections.length !== body.requestedSections.length)
    ) {
      return NextResponse.json(
        { error: 'requestedSections contains an unsupported section.' },
        { status: 400 },
      );
    }

    if (isPublicContext) {
      v2Input = {
        essayPrompt,
        ...(requestedSections ? { requestedSections } : {}),
        context: buildVinUniEvaluationContext({
          application: { id: null, universityName: 'VinUniversity', courseName: null },
          course: null,
          profile: null,
        }),
      };
    } else if (isLocalDemo) {
      v2Input = {
        essayPrompt,
        ...(requestedSections ? { requestedSections } : {}),
        context: buildVinUniEvaluationContext({
          application: {
            id: VINUNI_DEMO_APPLICATION_ID,
            universityName: 'VinUniversity',
            courseName: 'Bachelor of Computer Science',
          },
          course: {
            courseName: 'Bachelor of Computer Science',
            degreeLevel: 'Bachelor',
            subject: 'Computer Science',
          },
          profile: null,
        }),
      };
    } else {
      const workspace = await fetchApplicationWorkspace(applicationId, user!.id);
      if (!workspace) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      const profile =
        process.env.VINUNI_PROFILE_CONTEXT_ENABLED === 'true'
          ? (
              await supabase!
                .from('student_profiles')
                .select(
                  'academic_background, grades_summary, goals, career_interests, achievements, skills, profile_summary, bio',
                )
                .eq('user_id', user!.id)
                .maybeSingle()
            ).data
          : null;
      v2Input = {
        essayPrompt,
        ...(requestedSections ? { requestedSections } : {}),
        context: buildVinUniEvaluationContext({
          application: {
            id: workspace.application.id,
            universityName: workspace.application.universityName,
            courseName: workspace.application.courseName,
          },
          course: workspace.course
            ? {
                courseName: workspace.course.courseName,
                degreeLevel: workspace.course.degreeLevel,
                subject: workspace.course.subject,
              }
            : null,
          profile: profile ?? null,
        }),
      };
    }
  }

  if (GROUNDED_PIPELINE_ENABLED) {
    if (!useV2 && !VINUNI_EVALUATION_CONFIG) {
      return NextResponse.json(
        { error: 'Grounded VinUni evaluation is not configured yet.' },
        { status: 503 },
      );
    }
    const evaluationConfig = VINUNI_EVALUATION_CONFIG!;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Set OPENAI_API_KEY in .env.local.' },
        { status: 500 },
      );
    }
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const abortController = new AbortController();
    request.signal.addEventListener('abort', () => abortController.abort(), { once: true });
    const encoder = new TextEncoder();
    const encodeEvent = (event: VinUniStreamEvent | VinUniV2StreamEvent) =>
      encoder.encode(`${JSON.stringify(event)}\n`);

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const events = useV2
            ? streamVinUniEvaluationV2({
                essay: text,
                essayPrompt: v2Input!.essayPrompt,
                context: v2Input!.context,
                config: VINUNI_EVALUATION_CONFIG_V2,
                apiKey,
                model,
                ...(v2Input!.requestedSections
                  ? { requestedSections: v2Input!.requestedSections }
                  : {}),
                stream: streamOpenAIText,
                signal: abortController.signal,
              })
            : streamVinUniEvaluation({
                essay: text,
                config: evaluationConfig,
                apiKey,
                model,
                stream: streamOpenAIText,
                signal: abortController.signal,
              });
          for await (const event of events) {
            controller.enqueue(encodeEvent(event));
            if (event.type === 'complete') {
              console.info('VinUni AI stream complete', {
                provider: 'openai',
                model,
                pipeline: useV2 ? 'v2' : 'v1',
                firstSectionMs: event.timing.firstSectionMs,
                totalMs: event.timing.totalMs,
              });
            }
          }
        } catch (error) {
          if (abortController.signal.aborted) return;
          console.error('VinUni AI stream failed', {
            provider: 'openai',
            model,
            code: 'STREAM_FAILED',
            message: error instanceof Error ? error.message : String(error),
          });
          controller.enqueue(
            encodeEvent({
              type: 'error',
              code: 'STREAM_FAILED',
              sections: [],
              message: 'Phân tích AI chưa hoàn tất. Vui lòng thử lại.',
              retryable: true,
            }),
          );
        } finally {
          if (!abortController.signal.aborted) controller.close();
        }
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
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
        ...openAiCompletionParameters({ model, temperature: 0.4, maxTokens: 2200 }),
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
