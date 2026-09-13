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
});
