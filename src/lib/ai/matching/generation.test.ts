import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getLatest: vi.fn(),
  getByHash: vi.fn(),
  save: vi.fn(),
  saveAcademic: vi.fn(),
  personal: vi.fn(),
  analysis: vi.fn(),
  target: vi.fn(),
  compose: vi.fn(),
  state: vi.fn(),
  openaiConfigured: true,
}));

vi.mock('@/features/apply/api', () => ({
  getLatestApplicationMatchingAnalysis: mocks.getLatest,
  getMatchingAnalysisByInputHash: mocks.getByHash,
  saveApplicationMatchingAnalysis: mocks.save,
  saveApplicationAcademicAssessment: mocks.saveAcademic,
  getApplicationProfileAnalysisVersion: mocks.analysis,
  stableHash: (value: unknown) => JSON.stringify(value),
}));
vi.mock('@/features/apply/api/personal-report-generation', () => ({ regeneratePersonalReport: mocks.personal }));
vi.mock('@/lib/ai/target-profile/generation', () => ({ resolveTargetProfile: mocks.target }));
vi.mock('../applicant-state/context-builder', () => ({ buildApplicantStateFromSnapshot: mocks.state }));
vi.mock('./report', () => ({ composeMatchingReport: mocks.compose }));
vi.mock('../openai-client', () => ({
  defaultOpenAIModel: () => 'test-model',
  isOpenAIConfigured: () => mocks.openaiConfigured,
}));

import { generateApplicationMatchingReport } from './generation';

const application = { id: 'app-1', user_id: 'user-1', course_id: 'course-1' };
const evidenceBank = { version: 'eb-v1', sources: {}, interpretations: [], claims: [], missingInformation: [] };
const personalRecord = {
  id: 'personal-1', sourceAnalysisVersionId: 'analysis-1', confirmedSnapshotId: 'snapshot-1',
  inputHash: 'personal-input-1', reportV2: { coreIdentity: { interpretation: 'identity' }, drivingForce: { explanation: 'motivation' } },
};
const report = {
  contractVersion: 'matching-report-v2', overall: { fitScore: 80, summary: 'A grounded matching summary.' },
  programmeFit: { confidence: 80, dimensions: {}, eligibility: {}, classification: 'match', limitations: [] },
  strengths: [{ title: 'Strength' }], gaps: [{ title: 'Gap' }],
  metadata: { matchingEngineVersion: 'matching-v2.0.0', reusedCriterionIds: ['criterion-1'] },
};

function supabaseMock(filters: Array<[string, unknown]>) {
  const chain: Record<string, any> = {};
  chain.select = () => chain;
  chain.eq = (key: string, value: unknown) => { filters.push([key, value]); return chain; };
  chain.single = async () => ({ data: application, error: null });
  return { from: () => chain } as any;
}

function setup() {
  const filters: Array<[string, unknown]> = [];
  mocks.openaiConfigured = true;
  mocks.getLatest.mockResolvedValue({ record: null, migrationMissing: false });
  mocks.getByHash.mockResolvedValue({ record: null, migrationMissing: false });
  mocks.save.mockResolvedValue({ record: { id: 'match-1', reportV2: report }, migrationMissing: false });
  mocks.saveAcademic.mockResolvedValue({ versionId: 'academic-1', migrationMissing: false });
  mocks.personal.mockResolvedValue({ status: 'cached', record: personalRecord });
  mocks.analysis.mockResolvedValue({ analysis: { id: 'analysis-1', confirmedSnapshotId: 'snapshot-1', moduleVersions: { evidence: 'eb-v1' }, evidenceBank }, migrationMissing: false });
  mocks.target.mockResolvedValue({
    status: 'cached',
    versionId: 'target-1',
    profile: { requirements: [], universityValues: [], programmeThemes: { themes: [], description: null } },
  });
  mocks.compose.mockResolvedValue(report);
  mocks.state.mockResolvedValue({
    academicProfile: { records: [] },
    directionSignals: {
      intendedDirection: 'Study computer science',
      academicDirection: 'Human-computer interaction',
      careerDirection: 'Build accessible tools',
      preferredEnvironment: 'Collaborative residential campus',
    },
  });
  return { filters, supabase: supabaseMock(filters) };
}

describe('generateApplicationMatchingReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('1. reads only an application owned by the current user', async () => {
    const { filters, supabase } = setup();
    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(filters).toEqual(expect.arrayContaining([['id', 'app-1'], ['user_id', 'user-1']]));
  });

  it('2. requires a complete Personal Report record', async () => {
    const { supabase } = setup();
    mocks.personal.mockResolvedValue({ status: 'snapshot_missing' });
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result).toEqual({ status: 'not_ready', reason: 'Personal report not ready' });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('3. uses the exact Personal Report source analysis version', async () => {
    const { supabase } = setup();
    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(mocks.analysis).toHaveBeenCalledWith(expect.anything(), { userId: 'user-1', applicationId: 'app-1' }, 'analysis-1');
  });

  it('4. rejects an unsupported Evidence Bank version', async () => {
    const { supabase } = setup();
    mocks.analysis.mockResolvedValue({ analysis: { confirmedSnapshotId: 'snapshot-1', moduleVersions: { evidence: 'eb-old' }, evidenceBank }, migrationMissing: false });
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result.status).toBe('not_ready');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('5. accepts a cached Target Profile without generating it again', async () => {
    const { supabase } = setup();
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result.status).toBe('regenerated');
    expect(mocks.target).toHaveBeenCalledWith(expect.objectContaining({ programmeId: 'course-1' }));
    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({
      programmeFitInput: expect.objectContaining({
        academicBand: 'unknown',
        dimensions: expect.objectContaining({
          academicCompetitiveness: expect.objectContaining({ status: 'not_available', score: null }),
        }),
      }),
    }));
  });

  it('6. does not insert when the Target Profile is not ready', async () => {
    const { supabase } = setup();
    mocks.target.mockResolvedValue({ status: 'not_ready', versionId: null, profile: null });
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result.status).toBe('not_ready');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('7. returns an exact same-input cached report before composing', async () => {
    const { supabase } = setup();
    mocks.getByHash.mockImplementation(async (_client: unknown, _scope: unknown, inputHash: string) => ({ record: { id: 'cached-1', inputHash, reportV2: report }, migrationMissing: false }));
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result.status).toBe('cached');
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('8. passes the previous complete V2 report for selective reuse', async () => {
    const { supabase } = setup();
    const previous = { id: 'previous', reportV2: { metadata: { reusedCriterionIds: [] } } };
    mocks.getLatest.mockResolvedValue({ record: previous, migrationMissing: false });
    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({ previousReport: previous.reportV2 }));
  });

  it('9. does not insert when criterion validation fails', async () => {
    const { supabase } = setup();
    mocks.compose.mockRejectedValue(new Error('unknown criterion'));
    await expect(generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' })).rejects.toThrow('unknown criterion');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('10. records the exact criterion-batch and one-summary call contract', async () => {
    const { supabase } = setup();
    mocks.compose.mockResolvedValue({ ...report, metadata: { ...report.metadata, aiCallCount: { criterionBatches: 2, summary: 1 } } });
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result.status).toBe('regenerated');
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reportV2: expect.objectContaining({ metadata: expect.objectContaining({ aiCallCount: { criterionBatches: 2, summary: 1 } }) }) }));
  });

  it('11. exact cache path invokes no report composer or persistence', async () => {
    const { supabase } = setup();
    mocks.getByHash.mockImplementation(async (_client: unknown, _scope: unknown, inputHash: string) => ({ record: { id: 'cached-2', inputHash, reportV2: report }, migrationMissing: false }));
    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('12. keeps reused semantic IDs while composing changed deterministic inputs', async () => {
    const { supabase } = setup();
    mocks.getLatest.mockResolvedValue({ record: { reportV2: { metadata: { reusedCriterionIds: ['semantic-1'] } } }, migrationMissing: false });
    mocks.compose.mockResolvedValue({ ...report, metadata: { ...report.metadata, reusedCriterionIds: ['semantic-1'], aiCallCount: { criterionBatches: 1, summary: 1 } } });
    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });
    expect(result).toMatchObject({ status: 'regenerated', reusedCriterionIds: ['semantic-1'] });
  });

  it('13. summary failure prevents persistence', async () => {
    const { supabase } = setup();
    mocks.compose.mockRejectedValue(new Error('summary failed'));
    await expect(generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' })).rejects.toThrow('summary failed');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('14. persistence failure throws so the route can preserve the previous report', async () => {
    const { supabase } = setup();
    mocks.save.mockResolvedValue({ record: null, migrationMissing: false });
    await expect(generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' })).rejects.toThrow('Failed to save matching analysis');
  });

  it('15. migration missing fails closed before personal report generation', async () => {
    const { supabase } = setup();
    mocks.getLatest.mockResolvedValueOnce({ record: null, migrationMissing: true });

    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });

    expect(result).toEqual({ status: 'migration_missing' });
    expect(mocks.personal).not.toHaveBeenCalled();
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('16. exact cache succeeds without OpenAI configuration', async () => {
    const { supabase } = setup();
    mocks.openaiConfigured = false;
    mocks.getByHash.mockImplementation(async (_client: unknown, _scope: unknown, inputHash: string) => ({
      record: { id: 'cached-no-key', inputHash, reportV2: report },
      migrationMissing: false,
    }));

    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });

    expect(result.status).toBe('cached');
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('17. regeneration returns typed not_configured after cache and cooldown checks', async () => {
    const { supabase } = setup();
    mocks.openaiConfigured = false;

    const result = await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });

    expect(result).toEqual({ status: 'not_configured' });
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('18. cooldown prevents the configuration check and regeneration', async () => {
    const { supabase } = setup();
    mocks.openaiConfigured = false;
    const current = { id: 'current', reportV2: report };
    mocks.getLatest.mockResolvedValue({ record: current, migrationMissing: false });

    const result = await generateApplicationMatchingReport({
      supabase,
      userId: 'user-1',
      applicationId: 'app-1',
      cooldownUntil: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(result.status).toBe('cooldown');
    expect(mocks.compose).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('19. keeps persisted F5 scores out of first-generation V3 scoring', async () => {
    const { supabase } = setup();
    const dimension = { status: 'assessed', score: 4.5, summary: 'Canonical result', strengths: [], gaps: [], evidence: [] };
    const previous = {
      id: 'previous',
      reportV2: {
        programmeFit: {
          classification: 'safety',
          confidence: 100,
          limitations: [],
          eligibility: { requiredSubjects: 'unknown', minimumQualification: 'unknown', languageRequirement: 'unknown', citizenshipRequirement: 'unknown', deadline: 'unknown' },
          dimensions: {
            academicCompetitiveness: dimension,
            personaAlignment: dimension,
            financialFeasibility: dimension,
            careerDirection: dimension,
            applicationReadiness: dimension,
          },
        },
      },
    };
    mocks.getLatest.mockResolvedValue({ record: previous, migrationMissing: false });

    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });

    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({
      version: 'v3',
      programmeFitInput: expect.objectContaining({ academicBand: 'unknown' }),
    }));
  });

  it('20. forwards Q7 preferred environment and canonical direction into later Matching context', async () => {
    const { supabase } = setup();
    await generateApplicationMatchingReport({ supabase, userId: 'user-1', applicationId: 'app-1' });

    expect(mocks.compose).toHaveBeenCalledWith(expect.objectContaining({
      personalContext: expect.objectContaining({
        direction: expect.arrayContaining([
          'Study computer science',
          'Human-computer interaction',
          'Build accessible tools',
          'Collaborative residential campus',
        ]),
      }),
    }));
  });
});
