/**
 * Structured logging, timing, error classification, and telemetry for server-side code.
 *
 * Designed to provide transparent telemetry on AI report generation, database operations,
 * and service health without throwing, leaking PII, or masking original errors.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type TelemetryOperation =
  | 'personal_report_generate'
  | 'matching_report_generate'
  | 'strategy_recommendation_generate'
  | 'applicant_analysis_generate'
  | 'candidate_confirmation'
  | 'candidate_confirm'
  | 'roadmap_tasks_generate'
  | 'recommendations_generate';

export type LifecycleStage =
  | 'started'
  | 'cache_hit'
  | 'validated'
  | 'generated'
  | 'persisted'
  | 'completed'
  | 'failed';

export type TelemetryOutcome =
  | LifecycleStage
  | 'success'
  | 'cached'
  | 'rate_limited'
  | 'migration_missing'
  | 'not_configured'
  | 'missing_inputs'
  | 'not_ready'
  | 'personal_report_incomplete'
  | 'app_lock_failed'
  | 'profile_lock_migration_missing'
  | 'validation_failed';

export type ErrorCategory =
  | 'openai_error'
  | 'database_error'
  | 'validation_error'
  | 'missing_config'
  | 'migration_error'
  | 'rate_limit'
  | 'network_timeout'
  | 'unknown_error';

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  code?: string | undefined;
}

export interface ReportTelemetryPayload {
  timestamp?: string | undefined;
  operation: TelemetryOperation;
  outcome?: TelemetryOutcome | undefined;
  stage?: LifecycleStage | undefined;
  durationMs?: number | undefined;
  userId?: string | undefined;
  applicationId?: string | undefined;
  modelName?: string | undefined;
  promptVersion?: string | undefined;
  engineVersion?: string | undefined;
  inputHash?: string | undefined;
  trigger?: string | undefined;
  cached?: boolean | undefined;
  errorCategory?: ErrorCategory | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  errorStack?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

const SENSITIVE_KEY_REGEX = /(password|secret|token|api[_-]?key|auth|cookie|credential|private[_-]?key)/i;
const BEARER_TOKEN_REGEX = /Bearer\s+[a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)*/gi;
const OPENAI_KEY_REGEX = /sk-[a-zA-Z0-9_\-]{20,}/gi;

/**
 * Sanitizes and redacts sensitive keys, tokens, and credentials recursively.
 * Safely handles circular references, BigInt, and non-serializable objects.
 */
export function redactSensitiveData(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return data.toString();
  }

  if (typeof data === 'function' || typeof data === 'symbol') {
    return undefined;
  }

  if (typeof data === 'string') {
    return data
      .replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]')
      .replace(OPENAI_KEY_REGEX, 'sk-[REDACTED]');
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (seen.has(data)) {
    return '[Circular]';
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, seen));
  }

  if (data instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: data.name,
      message: redactSensitiveData(data.message, seen),
      ...(data.stack ? { stack: redactSensitiveData(data.stack, seen) } : {}),
    };
    for (const key of Object.getOwnPropertyNames(data)) {
      if (!(key in errorObj)) {
        const val = (data as unknown as Record<string, unknown>)[key];
        errorObj[key] = SENSITIVE_KEY_REGEX.test(key) ? '[REDACTED]' : redactSensitiveData(val, seen);
      }
    }
    return errorObj;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSensitiveData(value, seen);
    }
  }

  return result;
}

/**
 * Safely stringifies data to JSON with sensitive field redaction and circular reference safety.
 */
export function safeStringify(data: unknown): string {
  try {
    const redacted = redactSensitiveData(data);
    return JSON.stringify(redacted);
  } catch {
    return '{"error":"Failed to serialize log data"}';
  }
}

/**
 * Classifies an unknown thrown error into distinct operational categories.
 * Distinguishes PostgreSQL/PostgREST schema/migration gaps from OpenAI rate limits,
 * network/timeout failures, Zod validation errors, and generic errors.
 */
export function classifyError(error: unknown): ClassifiedError {
  try {
    if (!error) {
      return { category: 'unknown_error', message: 'Unknown error' };
    }

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const errorName = typeof err['name'] === 'string' ? err['name'] : '';
    let message = typeof err['message'] === 'string' ? err['message'] : String(error);
    const code =
      typeof err['code'] === 'string'
        ? err['code']
        : typeof err['code'] === 'number'
          ? String(err['code'])
          : typeof err['status'] === 'number'
            ? String(err['status'])
            : undefined;

    // 1. Zod / Validation errors
    const isZod = errorName === 'ZodError' || Array.isArray(err['issues']);
    if (
      isZod ||
      code === 'validation_error' ||
      err['category'] === 'validation_error' ||
      errorName.toLowerCase().includes('validation') ||
      message.toLowerCase().includes('validation failed')
    ) {
      if (Array.isArray(err['issues']) && err['issues'].length > 0) {
        const issuesSummary = (err['issues'] as Array<{ path?: (string | number)[]; message?: string }>)
          .map((i) => `${(i.path ?? []).join('.') || 'root'}: ${i.message ?? 'Invalid'}`)
          .slice(0, 5)
          .join('; ');
        message = `Validation failed: ${issuesSummary}`;
      }
      return {
        category: 'validation_error',
        message,
        code: code ?? 'VALIDATION_ERROR',
      };
    }

    // 2. Rate limits / 429 (Check before SQLSTATE '42' prefix check)
    if (
      code === '429' ||
      code === 'rate_limit_exceeded' ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('too many requests')
    ) {
      return {
        category: 'rate_limit',
        message,
        code: code ?? '429',
      };
    }

    // 3. Network / Timeout errors
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      errorName === 'AbortError' ||
      errorName === 'TimeoutError' ||
      message.toLowerCase().includes('fetch failed') ||
      message.toLowerCase().includes('network error') ||
      message.toLowerCase().includes('timed out') ||
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('socket hang up')
    ) {
      return {
        category: 'network_timeout',
        message,
        code: code ?? (errorName || 'NETWORK_TIMEOUT'),
      };
    }

    // 4. Missing configuration / API Keys (Check before generic vendor keywords)
    if (
      message.toLowerCase().includes('api key') ||
      message.toLowerCase().includes('missing config') ||
      message.toLowerCase().includes('not configured') ||
      message.toLowerCase().includes('unconfigured')
    ) {
      return {
        category: 'missing_config',
        message,
        code,
      };
    }

    // 5. Database Migration / Missing schema errors
    if (
      code === '42P01' || // relation does not exist
      code === '42703' || // column does not exist
      code === 'PGRST204' || // column not found in schema cache
      code === 'PGRST205' || // table not found in schema cache
      code === '42501' || // insufficient_privilege (RLS failure)
      message.includes('relation') ||
      message.includes('schema cache') ||
      message.includes('does not exist')
    ) {
      return {
        category: 'migration_error',
        message,
        code,
      };
    }

    // 6. Other PostgreSQL SQLSTATE errors (SQLSTATE is 5 chars) & PostgREST errors
    if (
      (code && code.length === 5 && (code.startsWith('23') || code.startsWith('42') || code.startsWith('08') || code.startsWith('22') || code.startsWith('53'))) ||
      code?.startsWith('PGRST')
    ) {
      return {
        category: 'database_error',
        message,
        code,
      };
    }

    // 7. OpenAI / Upstream AI errors
    if (
      err['type'] === 'invalid_request_error' ||
      err['type'] === 'insufficient_quota' ||
      message.toLowerCase().includes('openai') ||
      message.toLowerCase().includes('gpt') ||
      message.toLowerCase().includes('anthropic') ||
      message.toLowerCase().includes('ai service')
    ) {
      return {
        category: 'openai_error',
        message,
        code,
      };
    }

    return {
      category: 'unknown_error',
      message,
      code,
    };
  }

  return {
    category: 'unknown_error',
    message: String(error),
  };
  } catch {
    return {
      category: 'unknown_error',
      message: 'Unknown error',
    };
  }
}

/**
 * High-resolution timer utility.
 * Returns a function that, when invoked, returns elapsed milliseconds rounded to 2 decimals.
 */
export function startTimer(): () => number {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return () => {
    try {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return Math.round((end - start) * 100) / 100;
    } catch {
      return 0;
    }
  };
}

/**
 * Measures async execution duration safely without masking application errors.
 */
export async function measureAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const getElapsed = startTimer();
  const result = await fn();
  const durationMs = getElapsed();
  return { result, durationMs };
}

export type LogDetails = Omit<Partial<ReportTelemetryPayload>, 'operation' | 'timestamp'> & {
  [key: string]: unknown;
};

/**
 * Structured Logger for Server-Side Report Operations.
 * Guarantee: Never throws; logs uniform JSON records with sensitive field redaction.
 */
export const logger = {
  record(payload: ReportTelemetryPayload & { [key: string]: unknown }): void {
    try {
      const formatted = safeStringify({
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      });

      const outcome = payload.outcome ?? payload.stage;
      if (outcome === 'failed') {
        console.error(`[TELEMETRY][${payload.operation}] ${formatted}`);
      } else if (
        outcome === 'migration_missing' ||
        outcome === 'rate_limited' ||
        outcome === 'not_configured' ||
        outcome === 'not_ready'
      ) {
        console.warn(`[TELEMETRY][${payload.operation}] ${formatted}`);
      } else {
        console.info(`[TELEMETRY][${payload.operation}] ${formatted}`);
      }
    } catch {
      // Guaranteed fail-safe: logging should never fail application requests
    }
  },

  debug(operation: TelemetryOperation, details: LogDetails): void {
    try {
      const formatted = safeStringify({
        timestamp: new Date().toISOString(),
        operation,
        ...details,
      });
      console.debug(`[TELEMETRY][${operation}] ${formatted}`);
    } catch {
      // Fail-safe
    }
  },

  info(operation: TelemetryOperation, details: LogDetails): void {
    const outcome: TelemetryOutcome = (details.outcome as TelemetryOutcome | undefined) ?? (details.stage as LifecycleStage | undefined) ?? 'success';
    logger.record({
      timestamp: new Date().toISOString(),
      operation,
      outcome,
      ...details,
    });
  },

  warn(operation: TelemetryOperation, details: LogDetails): void {
    const outcome: TelemetryOutcome = (details.outcome as TelemetryOutcome | undefined) ?? (details.stage as LifecycleStage | undefined) ?? 'rate_limited';
    logger.record({
      timestamp: new Date().toISOString(),
      operation,
      outcome,
      ...details,
    });
  },

  error(
    operation: TelemetryOperation,
    error: unknown,
    details?: Omit<LogDetails, 'outcome'>,
  ): void {
    try {
      const classified = classifyError(error);
      const outcome: TelemetryOutcome = classified.category === 'migration_error' ? 'migration_missing' : 'failed';
      const stage: LifecycleStage = (details?.stage as LifecycleStage | undefined) ?? 'failed';
      logger.record({
        timestamp: new Date().toISOString(),
        operation,
        outcome,
        stage,
        errorCategory: classified.category,
        errorCode: classified.code,
        errorMessage: classified.message,
        ...(error instanceof Error && error.stack ? { errorStack: error.stack } : {}),
        ...details,
      });
    } catch {
      // Fail-safe
    }
  },
};
