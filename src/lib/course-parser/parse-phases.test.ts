import { describe, expect, it } from 'vitest';
import {
  classifyParseError,
  mapPhaseToLegacyStatus,
  mapStatusToPhase,
} from './parse-phases';

describe('parse-phases', () => {
  describe('mapStatusToPhase', () => {
    it('maps complete to ready', () => {
      expect(mapStatusToPhase({ status: 'complete' })).toBe('ready');
    });

    it('maps failed to failed', () => {
      expect(mapStatusToPhase({ status: 'failed' })).toBe('failed');
    });

    it('maps timeout or stale to timeout', () => {
      expect(mapStatusToPhase({ status: 'timeout' })).toBe('timeout');
      expect(mapStatusToPhase({ status: 'processing', isStale: true })).toBe('timeout');
    });

    it('maps pending to queued', () => {
      expect(mapStatusToPhase({ status: 'pending' })).toBe('queued');
    });

    it('uses explicit stored phase if valid', () => {
      expect(mapStatusToPhase({ status: 'processing', phase: 'extracting' })).toBe('extracting');
      expect(mapStatusToPhase({ status: 'processing', phase: 'validating' })).toBe('validating');
      expect(mapStatusToPhase({ status: 'processing', phase: 'fetching' })).toBe('fetching');
    });

    it('infers phase from progress percentage when processing without explicit phase', () => {
      expect(mapStatusToPhase({ status: 'processing', progressPercentage: 20 })).toBe('fetching');
      expect(mapStatusToPhase({ status: 'processing', progressPercentage: 50 })).toBe('extracting');
      expect(mapStatusToPhase({ status: 'processing', progressPercentage: 85 })).toBe('validating');
    });
  });

  describe('mapPhaseToLegacyStatus', () => {
    it('maps granular phases to valid legacy database statuses', () => {
      expect(mapPhaseToLegacyStatus('queued')).toBe('pending');
      expect(mapPhaseToLegacyStatus('fetching')).toBe('processing');
      expect(mapPhaseToLegacyStatus('extracting')).toBe('processing');
      expect(mapPhaseToLegacyStatus('validating')).toBe('processing');
      expect(mapPhaseToLegacyStatus('ready')).toBe('complete');
      expect(mapPhaseToLegacyStatus('timeout')).toBe('timeout');
      expect(mapPhaseToLegacyStatus('failed')).toBe('failed');
    });
  });

  describe('classifyParseError', () => {
    it('returns null when no error message', () => {
      expect(classifyParseError(null)).toBeNull();
      expect(classifyParseError(undefined)).toBeNull();
      expect(classifyParseError('')).toBeNull();
    });

    it('classifies retryable errors when attempts < maxAttempts', () => {
      expect(classifyParseError('fetch_failed', 1, 3)).toBe('retryable');
      expect(classifyParseError('model_failed', 1, 3)).toBe('retryable');
      expect(classifyParseError('gateway timeout', 2, 3)).toBe('retryable');
    });

    it('classifies terminal errors regardless of attempts', () => {
      expect(classifyParseError('empty_page', 0, 3)).toBe('terminal');
      expect(classifyParseError('not_configured', 0, 3)).toBe('terminal');
      expect(classifyParseError('That page gave us no text to read', 0, 3)).toBe('terminal');
    });

    it('marks error as terminal when attempts reach maxAttempts', () => {
      expect(classifyParseError('fetch_failed', 3, 3)).toBe('terminal');
      expect(classifyParseError('fetch_failed', 4, 3)).toBe('terminal');
    });
  });
});
