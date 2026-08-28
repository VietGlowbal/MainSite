// ============================================================================
// AI Coach reply — one plain-text OpenAI chat completion per turn
// ----------------------------------------------------------------------------
// requirements.md Requirement 12. Non-streaming (design.md, Open decision 3):
// a single JSON-mode-free chat completion, because a coach reply is
// conversational prose, not structured data — unlike every other AI call in
// this feature, there is nothing here for match-insights' JSON-mode
// convention to buy. Still the same provider (OpenAI) and the same "throw on
// hard failure" contract as analyzeApplicant/analyzeCourseMatchInsights.
// ============================================================================

import { openAiCompletionParameters } from '@/lib/ai/openai-client';

export type CoachMessageInput = {
  role: 'user' | 'assistant';
  content: string;
};

export type CoachContext = {
  recommendationTitle: string;
  recommendationReason?: string | null;
  courseName: string;
  universityName: string;
};

function buildSystemPrompt(context: CoachContext): string {
  return `You are an encouraging, practical university-admissions coach helping a student act on one specific recommendation from their AI Strategy Dashboard.

RECOMMENDATION: "${context.recommendationTitle}"
${context.recommendationReason ? `WHY IT MATTERS: ${context.recommendationReason}` : ''}
COURSE: ${context.courseName} at ${context.universityName}

RULES:
- Stay focused on this one recommendation. If the student asks something unrelated, gently redirect.
- Be concrete: concrete next steps, not generic encouragement.
- Keep replies short — 2-4 short paragraphs or a short list, not an essay.
- Never claim to know the university's actual admission decision or probability — you are coaching effort, not predicting outcomes.
- If you don't have enough information to give specific advice, ask one clarifying question rather than guessing.`;
}

/**
 * One coach turn. Throws on a hard failure (no key, network, empty response)
 * so the caller can surface an error — same contract as the other AI calls
 * in this feature.
 */
export async function generateCoachReply(args: {
  context: CoachContext;
  history: CoachMessageInput[];
  apiKey: string;
  model?: string;
}): Promise<string> {
  const { context, history, apiKey, model = 'gpt-4o-mini' } = args;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...history],
      ...openAiCompletionParameters({ model, temperature: 0.6, maxTokens: 500 }),
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty AI response');

  return content.trim().slice(0, 3000);
}
