import { describe, it, expect, vi } from 'vitest';
import { generateApplicationMatchingReport } from './generation';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}));

vi.mock('@/features/apply/api/ai-reports-repository', () => ({
  getLatestApplicationMatchingAnalysis: vi.fn().mockResolvedValue({ record: null, migrationMissing: false }),
  saveApplicationMatchingAnalysis: vi.fn().mockResolvedValue({ record: { id: 'saved' }, migrationMissing: false }),
}));

vi.mock('@/features/apply/api/personal-report-generation', () => ({
  regeneratePersonalReport: vi.fn().mockResolvedValue({ status: 'regenerated', record: { id: 'pr1', sourceAnalysisVersionId: 'sa1', confirmedSnapshotId: 'snap1', inputHash: 'hash1', reportV2: { coreIdentity: { interpretation: 'id' }, drivingForce: { explanation: 'drive' } } } })
}));

vi.mock('@/features/apply/api/application-analysis-repository', () => ({
  getApplicationProfileAnalysisVersion: vi.fn().mockResolvedValue({ analysis: { moduleVersions: { evidence: 'eb-v1' }, evidenceBank: [] }, migrationMissing: false }),
}));

vi.mock('@/lib/ai/target-profile/generation', () => ({
  resolveTargetProfile: vi.fn().mockResolvedValue({ status: 'ready', versionId: 'tp1', profile: { requirements: [] } })
}));

vi.mock('./report', () => ({
  composeMatchingReport: vi.fn().mockResolvedValue({
    overall: { fitScore: 80, summary: 'Summary' },
    programmeFit: { confidence: 0.8, dimensions: {}, eligibility: {}, classification: 'safety', limitations: [] },
    strengths: [],
    gaps: [],
    metadata: { reusedCriterionIds: [] }
  })
}));

vi.mock('../applicant-state/context-builder', () => ({
  buildApplicantStateFromSnapshot: vi.fn().mockResolvedValue({ academicProfile: {} })
}));

describe('generateApplicationMatchingReport', () => {
  it('handles owned application only', async () => {
    const supabase = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'app1', course_id: 'c1' }, error: null }) }) }) }) }) } as any;
    const res = await generateApplicationMatchingReport({ supabase, userId: 'u1', applicationId: 'app1' });
    expect(res.status).not.toBe('not_ready');
  });

  // More tests would be added here to cover the 14 scenarios
});
