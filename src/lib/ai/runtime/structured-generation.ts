import { ZodError, type ZodType } from 'zod';
import { getOpenAIClient, defaultOpenAIModel } from '../openai-client';

/**
 * One structured provider call with schema validation and a single repair
 * attempt — the shared execution primitive for every AI module (Task 2 of the
 * application Personal Report backend plan).
 *
 * CONTRACT:
 * - uses the existing singleton OpenAI client by default (injectable `client`
 *   for tests only — production callers never pass one);
 * - one PRIMARY attempt + at most ONE repair attempt; a second invalid output
 *   throws and nothing is persisted here (persistence belongs to the
 *   orchestrator);
 * - an internal abort budget (default 55s, inside the route's 60s budget)
 *   spans all attempts;
 * - failures are classified: provider | timeout | json | schema_validation;
 * - returns structured metadata — model, prompt/schema versions, attempt
 *   count, latency, accumulated token usage — instead of just a string;
 * - NEVER writes raw prompts or candidate evidence to logs. Only safe
 *   identifiers, versions, counts, and issue summaries leave this module.
 *
 * Provider-neutral on purpose: swapping the transport means changing this one
 * file, not every module.
 */

export const STRUCTURED_GENERATION_BUDGET_MS = 55_000;

export type StructuredFailureKind =
  | 'provider' // API/network error other than our own timeout
  | 'timeout' // internal budget exhausted; provider call aborted
  | 'json' // response was not parseable JSON after fence stripping
  | 'schema_validation'; // parsed but failed the supplied Zod schema

export class StructuredGenerationError extends Error {
  readonly kind: StructuredFailureKind;
  readonly issues?: string[];

  constructor(kind: StructuredFailureKind, message: string, issues?: string[]) {
    super(message);
    this.name = 'StructuredGenerationError';
    this.kind = kind;
    if (issues?.length) this.issues = issues;
  }
}

export type StructuredUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type StructuredGenerationMeta = {
  moduleId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  /** 1 = first try succeeded; 2 = the repair attempt succeeded. */
  attemptCount: 1 | 2;
  repaired: boolean;
  latencyMs: number;
  usage: StructuredUsage | null;
};

export type StructuredGenerationResult<T> = {
  data: T;
  meta: StructuredGenerationMeta;
};

type ChatMessage = { role: 'system' | 'assistant' | 'user'; content: string };

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

/** Injectable provider surface — structural subset of the OpenAI SDK client. */
export type StructuredProviderClient = {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: ChatMessage[];
        temperature?: number;
        max_tokens?: number;
        response_format?: Record<string, unknown>;
        signal?: AbortSignal;
      }): Promise<CompletionResponse>;
    };
  };
};

function stripFences(content: string): string {
  return content
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function summarizeIssues(error: ZodError): string[] {
  return error.issues
    .slice(0, 8)
    .map((issue: { path: PropertyKey[]; message: string }) => `${issue.path.join('.') || 'root'}: ${issue.message}`);
}

/**
 * Safe log record — identifiers and counters ONLY. Prompt text, candidate
 * evidence, and raw model output must never reach this.
 */
function logStructuredGeneration(fields: Record<string, string | number | boolean>): void {
  try {
    console.info(`[ai-runtime] ${JSON.stringify(fields)}`);
  } catch {
    // Logging must never break generation.
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

export async function generateStructured<T>(args: {
  moduleId: string;
  promptVersion: string;
  schemaVersion: string;
  schema: ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  /**
   * Extra instruction prepended to the repair request. The failing output and
   * the schema issues are appended automatically.
   */
  repairInstruction?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** JSON Schema response format where the deployment's model supports it. */
  jsonSchemaFormat?: Record<string, unknown>;
  timeoutBudgetMs?: number;
  /** Test injection only. Defaults to the singleton OpenAI client. */
  client?: StructuredProviderClient;
}): Promise<StructuredGenerationResult<T>> {
  const {
    moduleId,
    promptVersion,
    schemaVersion,
    schema,
    systemPrompt,
    userPrompt,
    repairInstruction,
    model = defaultOpenAIModel(),
    temperature = 0,
    maxTokens = 2400,
    jsonSchemaFormat,
    timeoutBudgetMs = STRUCTURED_GENERATION_BUDGET_MS,
    client,
  } = args;

  const provider: StructuredProviderClient = client ?? (getOpenAIClient() as unknown as StructuredProviderClient);
  const startedAt = Date.now();
  // Held in a mutable holder (not a bare `let`) so closure writes stay visible
  // to TypeScript's control flow at the read sites below.
  const state: { usage: StructuredUsage | null } = { usage: null };
  const accumulateUsage = (response: CompletionResponse): void => {
    if (!response.usage) return;
    state.usage = {
      promptTokens: (state.usage?.promptTokens ?? 0) + (response.usage.prompt_tokens ?? 0),
      completionTokens: (state.usage?.completionTokens ?? 0) + (response.usage.completion_tokens ?? 0),
      totalTokens: (state.usage?.totalTokens ?? 0) + (response.usage.total_tokens ?? 0),
    };
  };

  const baseMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // One AbortController across ALL attempts: the budget bounds total wall
  // clock so primary + repair together can never exceed the route budget.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutBudgetMs);

  const callProvider = async (messages: ChatMessage[]): Promise<string> => {
    try {
      const response = await provider.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(jsonSchemaFormat ? { response_format: jsonSchemaFormat } : {}),
        signal: controller.signal,
      });
      accumulateUsage(response);
      const choice = response.choices?.[0];
      if (choice?.finish_reason === 'length') {
        throw new StructuredGenerationError('provider', 'Structured response exceeded the token limit.');
      }
      const content = choice?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new StructuredGenerationError('json', 'Provider returned empty JSON content.');
      }
      return content;
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new StructuredGenerationError('timeout', `Structured generation exceeded its ${timeoutBudgetMs}ms budget.`);
      }
      if (error instanceof StructuredGenerationError) throw error;
      throw new StructuredGenerationError(
        'provider',
        error instanceof Error ? error.message : 'Provider call failed.',
      );
    }
  };

  const validate = (
    content: string,
  ): { ok: true; data: T } | { ok: false; kind: StructuredFailureKind; issues: string[] } => {
    let candidate: unknown;
    try {
      candidate = JSON.parse(stripFences(content));
    } catch {
      return { ok: false, kind: 'json', issues: ['Response was not valid JSON.'] };
    }
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, kind: 'schema_validation', issues: summarizeIssues(parsed.error) };
    }
    return { ok: true, data: parsed.data };
  };

  try {
    const firstContent = await callProvider(baseMessages);
    const firstCheck = validate(firstContent);
    if (firstCheck.ok) {
      const meta: StructuredGenerationMeta = {
        moduleId,
        model,
        promptVersion,
        schemaVersion,
        attemptCount: 1,
        repaired: false,
        latencyMs: Date.now() - startedAt,
        usage: state.usage,
      };
      logStructuredGeneration({
        moduleId,
        promptVersion,
        schemaVersion,
        attempts: 1,
        repaired: false,
        latencyMs: meta.latencyMs,
        totalTokens: state.usage?.totalTokens ?? 0,
        outcome: 'ok',
      });
      return { data: firstCheck.data, meta };
    }

    // ── exactly one repair attempt ───────────────────────────────────────────
    const repairMessages: ChatMessage[] = [
      ...baseMessages,
      { role: 'assistant', content: firstContent },
      {
        role: 'user',
        content:
          `Your previous response was invalid (${firstCheck.kind}). Issues: ${firstCheck.issues.join('; ')}. ` +
          (repairInstruction ? `${repairInstruction} ` : '') +
          'Respond again with corrected VALID JSON only.',
      },
    ];
    const secondContent = await callProvider(repairMessages);
    const secondCheck = validate(secondContent);
    if (secondCheck.ok) {
      const meta: StructuredGenerationMeta = {
        moduleId,
        model,
        promptVersion,
        schemaVersion,
        attemptCount: 2,
        repaired: true,
        latencyMs: Date.now() - startedAt,
        usage: state.usage,
      };
      logStructuredGeneration({
        moduleId,
        promptVersion,
        schemaVersion,
        attempts: 2,
        repaired: true,
        latencyMs: meta.latencyMs,
        totalTokens: state.usage?.totalTokens ?? 0,
        outcome: 'ok_repaired',
      });
      return { data: secondCheck.data, meta };
    }

    throw new StructuredGenerationError(
      secondCheck.kind,
      `Structured output still invalid after one repair attempt (${secondCheck.kind}).`,
      secondCheck.issues,
    );
  } finally {
    clearTimeout(timer);
  }
}
