import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  classifyError,
  startTimer,
  measureAsync,
  logger,
  redactSensitiveData,
  safeStringify,
} from './index';

describe('src/server/observability', () => {
  describe('classifyError', () => {
    it('classifies PostgreSQL relation missing error as migration_error', () => {
      const err = { code: '42P01', message: 'relation "student_personal_report_versions" does not exist' };
      const classified = classifyError(err);
      expect(classified.category).toBe('migration_error');
      expect(classified.code).toBe('42P01');
    });

    it('classifies PostgreSQL column missing error as migration_error', () => {
      const err = { code: '42703', message: 'column "fit_dimensions" of relation "application_match_analyses" does not exist' };
      const classified = classifyError(err);
      expect(classified.category).toBe('migration_error');
      expect(classified.code).toBe('42703');
    });

    it('classifies PostgREST schema cache errors (PGRST204, PGRST205) as migration_error', () => {
      const err204 = { code: 'PGRST204', message: 'Could not find the column in the schema cache' };
      expect(classifyError(err204).category).toBe('migration_error');

      const err205 = { code: 'PGRST205', message: 'Could not find the table in the schema cache' };
      expect(classifyError(err205).category).toBe('migration_error');
    });

    it('classifies RLS permission error (42501) as migration_error', () => {
      const err = { code: '42501', message: 'permission denied for table course_applications' };
      const classified = classifyError(err);
      expect(classified.category).toBe('migration_error');
    });

    it('classifies standard PostgreSQL database constraint errors as database_error', () => {
      const uniqueErr = { code: '23505', message: 'duplicate key value violates unique constraint' };
      expect(classifyError(uniqueErr).category).toBe('database_error');

      const fkErr = { code: '23503', message: 'violates foreign key constraint' };
      expect(classifyError(fkErr).category).toBe('database_error');

      const connErr = { code: '08006', message: 'connection failure' };
      expect(classifyError(connErr).category).toBe('database_error');
    });

    it('classifies Zod validation errors as validation_error', () => {
      const schema = z.object({ name: z.string(), score: z.number().min(0) });
      const parseResult = schema.safeParse({ name: 'Candidate', score: -5 });
      expect(parseResult.success).toBe(false);

      if (!parseResult.success) {
        const classified = classifyError(parseResult.error);
        expect(classified.category).toBe('validation_error');
        expect(classified.message).toContain('Validation failed: score');
      }
    });

    it('classifies manual validation errors as validation_error', () => {
      const err = { code: 'validation_error', message: 'Invalid prompt parameters' };
      expect(classifyError(err).category).toBe('validation_error');
    });

    it('classifies Rate limit error (429) as rate_limit', () => {
      const err = { status: 429, message: 'Too many requests, slow down.' };
      const classified = classifyError(err);
      expect(classified.category).toBe('rate_limit');
      expect(classified.code).toBe('429');

      const errCode = { code: 'rate_limit_exceeded', message: 'Rate limit hit' };
      expect(classifyError(errCode).category).toBe('rate_limit');
    });

    it('classifies network timeouts and connection resets as network_timeout', () => {
      const errTimeout = { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' };
      expect(classifyError(errTimeout).category).toBe('network_timeout');

      const errReset = { code: 'ECONNRESET', message: 'read ECONNRESET' };
      expect(classifyError(errReset).category).toBe('network_timeout');

      const errFetch = new Error('fetch failed: connection closed');
      expect(classifyError(errFetch).category).toBe('network_timeout');

      const abortErr = new Error('The operation was aborted due to timeout');
      abortErr.name = 'AbortError';
      expect(classifyError(abortErr).category).toBe('network_timeout');
    });

    it('classifies missing API key error as missing_config', () => {
      const err = new Error('OPENAI_API_KEY is not configured');
      const classified = classifyError(err);
      expect(classified.category).toBe('missing_config');
    });

    it('classifies OpenAI quota / model error as openai_error', () => {
      const err = { type: 'insufficient_quota', message: 'You exceeded your current quota' };
      const classified = classifyError(err);
      expect(classified.category).toBe('openai_error');

      const invalidReq = { type: 'invalid_request_error', message: 'Model not found' };
      expect(classifyError(invalidReq).category).toBe('openai_error');
    });

    it('handles generic unknown errors and null/undefined gracefully', () => {
      const classifiedStr = classifyError('Something random happened');
      expect(classifiedStr.category).toBe('unknown_error');
      expect(classifiedStr.message).toBe('Something random happened');

      const classifiedNull = classifyError(null);
      expect(classifiedNull.category).toBe('unknown_error');

      const classifiedUndef = classifyError(undefined);
      expect(classifiedUndef.category).toBe('unknown_error');
    });
  });

  describe('redactSensitiveData and safeStringify', () => {
    it('redacts sensitive keys including password, token, apiKey, secret, cookie', () => {
      const sensitiveInput = {
        userId: 'user-123',
        password: 'my-super-secret-password',
        apiKey: 'sk-1234567890123456789012345',
        nested: {
          secret_token: 'secret-xyz',
          authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
          safeField: 'normal value',
        },
      };

      const redacted = redactSensitiveData(sensitiveInput) as Record<string, unknown>;
      expect(redacted['userId']).toBe('user-123');
      expect(redacted['password']).toBe('[REDACTED]');
      expect(redacted['apiKey']).toBe('[REDACTED]');
      const nested = redacted['nested'] as Record<string, unknown>;
      expect(nested['secret_token']).toBe('[REDACTED]');
      expect(nested['authHeader']).toBe('[REDACTED]');
      expect(nested['safeField']).toBe('normal value');
    });

    it('redacts inline API keys and Bearer tokens in string values', () => {
      const strWithToken = 'Error calling OpenAI: Bearer abc123def456. Key was sk-1234567890123456789012345';
      const redacted = redactSensitiveData(strWithToken);
      expect(redacted).toBe('Error calling OpenAI: Bearer [REDACTED]. Key was sk-[REDACTED]');
    });

    it('handles circular references without throwing or hanging', () => {
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj['self'] = circularObj;

      const serialized = safeStringify(circularObj);
      expect(serialized).toContain('"self":"[Circular]"');
      expect(serialized).toContain('"name":"test"');
    });

    it('handles BigInt and special non-serializable objects', () => {
      const data = { big: BigInt(9007199254740991), fn: () => {} };
      const serialized = safeStringify(data);
      expect(serialized).toContain('"big":"9007199254740991"');
    });
  });

  describe('startTimer and measureAsync', () => {
    it('measures elapsed execution time accurately', async () => {
      const { result, durationMs } = await measureAsync(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 42;
      });

      expect(result).toBe(42);
      expect(durationMs).toBeGreaterThanOrEqual(40);
    });

    it('captures timer without async wrapper', () => {
      const timer = startTimer();
      const elapsed = timer();
      expect(typeof elapsed).toBe('number');
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('does not swallow or alter errors thrown in measureAsync', async () => {
      await expect(
        measureAsync(async () => {
          throw new Error('Test measureAsync failure');
        }),
      ).rejects.toThrow('Test measureAsync failure');
    });
  });

  describe('logger', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('records info logs with structured telemetry prefix and valid JSON', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('personal_report_generate', {
        userId: 'user-123',
        stage: 'completed',
        outcome: 'success',
        durationMs: 120,
      });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('[TELEMETRY][personal_report_generate]');
      const jsonStr = logCall.replace('[TELEMETRY][personal_report_generate] ', '');
      const parsed = JSON.parse(jsonStr);
      expect(parsed.operation).toBe('personal_report_generate');
      expect(parsed.userId).toBe('user-123');
      expect(parsed.outcome).toBe('success');
      expect(parsed.stage).toBe('completed');
      expect(parsed.durationMs).toBe(120);
      expect(parsed.timestamp).toBeDefined();
    });

    it('records debug logs correctly', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('roadmap_tasks_generate', {
        userId: 'user-456',
        stage: 'started',
      });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('[TELEMETRY][roadmap_tasks_generate]');
      expect(logCall).toContain('user-456');
    });

    it('records warn logs for rate limits and missing config', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('strategy_recommendation_generate', {
        userId: 'user-789',
        outcome: 'rate_limited',
        stage: 'validated',
      });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('[TELEMETRY][strategy_recommendation_generate]');
      expect(logCall).toContain('rate_limited');
    });

    it('records error logs with classified migration failure as warn', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const dbErr = { code: '42P01', message: 'table does not exist' };
      logger.error('matching_report_generate', dbErr, { applicationId: 'app-999' });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('migration_missing');
      expect(logCall).toContain('app-999');
    });

    it('records error logs with genuine failures as error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const appErr = new Error('Unexpected computational fault');
      logger.error('applicant_analysis_generate', appErr, { userId: 'u-1', stage: 'failed' });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('[TELEMETRY][applicant_analysis_generate]');
      expect(logCall).toContain('Unexpected computational fault');
      expect(logCall).toContain('unknown_error');
    });

    it('supports candidate_confirmation operation name and lifecycle stages', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('candidate_confirmation', {
        userId: 'user-candidate-1',
        stage: 'persisted',
        outcome: 'success',
      });

      expect(spy).toHaveBeenCalled();
      const logCall = spy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('[TELEMETRY][candidate_confirmation]');
    });

    it('never throws even when console methods throw or cyclic data is provided', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {
        throw new Error('Console write pipe broken');
      });

      expect(() => {
        logger.info('personal_report_generate', {
          userId: 'user-123',
          metadata: { circular: {} },
        });
      }).not.toThrow();
    });
  });
});
