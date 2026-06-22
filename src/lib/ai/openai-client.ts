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
