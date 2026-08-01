import { isOpenAIConfigured, openai } from '@/lib/ai/openai-client';

/**
 * The one place a Feature 2 model call happens.
 *
 * WHY A WRAPPER. Five call sites need identical behaviour on the failure paths:
 * distinguish "not configured" from "the provider broke" from "it returned
 * something that is not JSON", never leak the provider's message, and always time
 * out rather than hold a serverless function open until the platform kills it.
 * Five copies of that would agree today and drift within a month, and the drift
 * would show up as a student seeing a raw upstream error.
 *
 * WHY A TAGGED RESULT AND NOT AN EXCEPTION. The routes above need to map failures
 * to different HTTP responses and different student-facing copy — "AI provider
 * unavailable" is a 503 the student should retry, a malformed response is a 502
 * they should also retry, and a missing key is a 500 nobody should retry. A thrown
 * Error flattens all three into one catch block.
 *
 * WHY `json_object` AND NOT `json_schema`. `strict: true` schemas require every
 * property to be required and forbid optional fields, and these five calls all
 * have genuinely optional output — a finding may have no suggested revision, a
 * field may be legitimately empty. The alternative is declaring everything
 * required and having the model emit empty strings, which loses the distinction
 * between "nothing to say" and "said nothing". So the shape is described in the
 * prompt and coerced by hand, which is also what `extract-course.ts` settled on.
 */

/** Generous, but below the 60s `maxDuration` the routes set. */
const TIMEOUT_MS = 45_000;

export type AiCallResult =
  | { ok: true; data: Record<string, unknown>; model: string }
  | { ok: false; reason: 'not_configured' | 'provider_failed' | 'bad_response' };

export type AiCallArgs = {
  system: string;
  user: string;
  /** Rises for creative work; every call here is analytical, so it stays low. */
  temperature?: number | undefined;
  maxTokens?: number | undefined;
};

export function strategyModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

export async function callStrategyModel(args: AiCallArgs): Promise<AiCallResult> {
  if (!isOpenAIConfigured()) return { ok: false, reason: 'not_configured' };

  const model = strategyModel();

  let completion;
  try {
    completion = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.user },
        ],
        temperature: args.temperature ?? 0.2,
        max_tokens: args.maxTokens ?? 4000,
        response_format: { type: 'json_object' },
      },
      { timeout: TIMEOUT_MS },
    );
  } catch (error) {
    // Logged server-side in full; the caller gets a reason code and nothing else.
    console.error('[ai/strategy] provider call failed:', error);
    return { ok: false, reason: 'provider_failed' };
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return { ok: false, reason: 'bad_response' };

  // Models still occasionally wrap JSON in a fenced block despite json_object.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[ai/strategy] response was not valid JSON');
    return { ok: false, reason: 'bad_response' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'bad_response' };
  }

  return { ok: true, data: parsed as Record<string, unknown>, model };
}

// ── Coercion helpers ──────────────────────────────────────────────────────

/**
 * These exist because model output is untrusted input. Every field is coerced to
 * the type the domain expects, and anything unexpected degrades to an empty value
 * rather than propagating `undefined` into a database column or a `.map()` call.
 */

export function asString(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/** Empty string becomes null, for columns where "unset" and "blank" differ. */
export function asNullableString(value: unknown, maxLength = 2000): string | null {
  const str = asString(value, maxLength);
  return str.length > 0 ? str : null;
}

export function asStringArray(value: unknown, maxItems = 20, maxLength = 600): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

export function asObjectArray(value: unknown, maxItems = 20): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .slice(0, maxItems);
}

export function asScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Source citations, dropping anything without a usable http(s) url.
 *
 * A citation the student cannot click is worse than no citation: it looks like
 * verification and provides none.
 */
export function asSources(
  value: unknown,
  maxItems = 20,
): { field: string; url: string; heading?: string | null; snippet?: string | null }[] {
  return asObjectArray(value, maxItems)
    .map((raw) => ({
      field: asString(raw.field, 80),
      url: asString(raw.url, 600),
      heading: asNullableString(raw.heading, 200),
      snippet: asNullableString(raw.snippet, 500),
    }))
    .filter((source) => /^https?:\/\//i.test(source.url));
}
