/**
 * OpenAI Client
 *
 * Lazily-instantiated wrapper around the OpenAI SDK for AI-powered features.
 *
 * The SDK (v6+) throws at construction time when no API key is provided. To
 * avoid crashing on import in environments where `OPENAI_API_KEY` is not set
 * (CI, tests, builds without the key), the underlying client is created lazily
 * on first use via a Proxy. Callers should guard usage with
 * `isOpenAIConfigured()` and handle failures gracefully.
 */

import OpenAI from 'openai';

export const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

let cachedClient: OpenAI | null = null;

/**
 * Get (or lazily create) the singleton OpenAI client instance.
 */
export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return cachedClient;
}

/**
 * Lazy proxy that defers client construction until a property is accessed.
 * This preserves the `openai.chat.completions.create(...)` call style while
 * ensuring that simply importing this module never throws.
 */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getOpenAIClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function defaultOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

/**
 * A single non-streaming, JSON-mode chat completion — the shape several
 * routes and `lib/ai/*` modules were built around when they called DeepSeek
 * directly. Kept as a raw `fetch` (rather than the `openai` SDK) so callers
 * that already hold an explicit `apiKey` (validated earlier in the request)
 * don't need to thread it through a second client construction.
 */
export async function openAiJsonCompletion(args: {
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
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        temperature: args.temperature,
        max_tokens: args.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 160)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') {
      throw new Error('OpenAI response exceeded the token limit.');
    }
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    throw new Error('OpenAI returned empty JSON content.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('OpenAI request timed out.');
    throw error instanceof Error ? error : new Error('OpenAI request failed.');
  } finally {
    clearTimeout(timeout);
  }
}
