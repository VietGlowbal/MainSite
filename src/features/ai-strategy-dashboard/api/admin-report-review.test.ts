import { describe, expect, it } from 'vitest';
import { detectAdminAiReportOutput } from './admin-report-review';

describe('detectAdminAiReportOutput', () => {
  it('recognises the canonical Personal Report V2 contract', () => {
    const result = detectAdminAiReportOutput('personal', {
      overallEvidenceConfidence: 'medium',
      coreIdentity: {},
      drivingForce: {},
      signaturePattern: {},
      emergingThemes: {},
      personalPositioning: {},
      proofOfMe: {},
    });
    expect(result.format).toBe('personal_report_v2');
  });

  it('preserves malformed output as unknown instead of throwing', () => {
    expect(detectAdminAiReportOutput('matching', { contractVersion: 'future' }).format).toBe('unknown');
    expect(detectAdminAiReportOutput('matching', { contractVersion: 'future' }).output).toEqual({ contractVersion: 'future' });
  });

  it('keeps a known matching contract readable when historical references no longer validate', () => {
    const result = detectAdminAiReportOutput('matching', {
      contractVersion: 'matching-report-v3',
      overall: { summary: 'A persisted summary' },
      universityFit: {},
      programmeFit: {},
    });
    expect(result.format).toBe('matching_report_v3');
    expect(result.output).toMatchObject({ contractVersion: 'matching-report-v3' });
  });
});
