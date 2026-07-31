export const DEEPSEEK_CHAT_COMPLETIONS_URL =
  'https://api.deepseek.com/chat/completions';

export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function defaultDeepSeekModel(): string {
  return process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
}

export async function deepSeekJsonCompletion(args: {
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 45_000);

  try {
    const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        thinking: { type: 'disabled' },
        temperature: args.temperature,
        max_tokens: args.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`DeepSeek request failed (${response.status}): ${detail.slice(0, 160)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new Error('DeepSeek response exceeded the token limit.');
    }
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    throw new Error('DeepSeek returned empty JSON content.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('DeepSeek request timed out.');
    throw error instanceof Error ? error : new Error('DeepSeek request failed.');
  } finally {
    clearTimeout(timeout);
  }
}
