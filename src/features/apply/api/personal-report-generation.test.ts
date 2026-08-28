import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadCandidateContext: vi.fn(),
  buildApplicantStateFromSnapshot: vi.fn(),
  candidateContextFromState: vi.fn(),
  SnapshotNotFoundError: class SnapshotNotFoundError extends Error {},
  getLatestPersonalReportV2: vi.fn(),
  getLatestApplicationPersonalReportV2: vi.fn(),
  findPersonalReportV2ByCacheKey: vi.fn(),
  getApplicationPersonalReportSupplements: vi.fn(),
  getPersonalReportSupplements: vi.fn(),
  createPersonalReportV2Version: vi.fn(),
  getLatestApplicationProfileAnalysis: vi.fn(),
  saveApplicationProfileAnalysis: vi.fn(),
  buildEvidenceBank: vi.fn(),
  applyPersonalReportSupplements: vi.fn((context: unknown) => context),
  buildProfileEvaluationInput: vi.fn(),
  isOpenAIConfigured: vi.fn(),
  runProfileEvaluation: vi.fn(),
  shouldRegenerate: vi.fn(),
  buildPersonalReport: vi.fn(),
  buildPersonalCanvasDetails: vi.fn(() => ({
    capabilities: [],
    motivations: [],
    socialProof: [],
    growthPriorities: [],
    futurePathways: [],
  })),
  synthesizePersonalReportNarrative: vi.fn(),
  applyNarrativeSynthesis: vi.fn((report: unknown) => report),
}));

vi.mock('./candidate-context', () => ({
  loadCandidateContext: mocks.loadCandidateContext,
  candidateContextHash: () => 'hash-current',
  stableHash: () => 'stable-hash',
}));
vi.mock('@/lib/ai/applicant-state/context-builder', () => ({
  buildApplicantStateFromSnapshot: mocks.buildApplicantStateFromSnapshot,
  candidateContextFromState: mocks.candidateContextFromState,
  SnapshotNotFoundError: mocks.SnapshotNotFoundError,
}));
vi.mock('./personal-report-v2-repository', () => ({
  getLatestPersonalReportV2: mocks.getLatestPersonalReportV2,
  getLatestApplicationPersonalReportV2: mocks.getLatestApplicationPersonalReportV2,
  findPersonalReportV2ByCacheKey: mocks.findPersonalReportV2ByCacheKey,
  getApplicationPersonalReportSupplements: mocks.getApplicationPersonalReportSupplements,
  getPersonalReportSupplements: mocks.getPersonalReportSupplements,
  createPersonalReportV2Version: mocks.createPersonalReportV2Version,
}));
vi.mock('./application-analysis-repository', () => ({
  getLatestApplicationProfileAnalysis: mocks.getLatestApplicationProfileAnalysis,
  saveApplicationProfileAnalysis: mocks.saveApplicationProfileAnalysis,
}));
vi.mock('@/shared/evidence/build-evidence-bank', () => ({ buildEvidenceBank: mocks.buildEvidenceBank }));
vi.mock('@/lib/ai/personal-report-v2', () => ({
  applyPersonalReportSupplements: mocks.applyPersonalReportSupplements,
  buildProfileEvaluationInput: mocks.buildProfileEvaluationInput,
  PERSONAL_REPORT_EXTRACTION_VERSION: 'extraction-v2',
}));
vi.mock('@/lib/ai/openai-client', () => ({ isOpenAIConfigured: mocks.isOpenAIConfigured }));
vi.mock('@/lib/ai/personal-report-narrative-synthesis', () => ({
  synthesizePersonalReportNarrative: mocks.synthesizePersonalReportNarrative,
  applyNarrativeSynthesis: mocks.applyNarrativeSynthesis,
}));
vi.mock('@/shared/evaluation', () => ({
  ENGINE_VERSION: '1.1.0',
  runProfileEvaluation: mocks.runProfileEvaluation,
  shouldRegenerate: mocks.shouldRegenerate,
}));
vi.mock('../domain', () => ({
  buildPersonalReport: mocks.buildPersonalReport,
  PERSONAL_REPORT_CONTRACT_VERSION: 'personal-report-v3',
}));
vi.mock('../domain/personal-canvas-details', () => ({
  buildPersonalCanvasDetails: mocks.buildPersonalCanvasDetails,
}));

async function importSubject() {
  return import('./personal-report-generation');
}

const FAKE_CONTEXT = { profile: {}, achievements: [], activities: [] };
const FAKE_STATE = {
  applicantId: 'user-1',
  applicationId: 'app-a',
  snapshotId: 'snapshot-a',
  achievements: [],
  activities: [],
  evidenceBank: [],
  academicProfile: { records: [] },
};
const FAKE_RECORD = {
  id: 'v1',
  reportV2: { overallEvidenceConfidence: 'low' },
  evaluation: null,
  inputHash: 'hash-current',
  engineVersion: '1.1.0',
  promptVersion: 'extraction-v2',
  modelName: 'gpt-4o',
  trigger: 'manual' as const,
  generatedAt: '2026-08-13T00:00:00.000Z',
  createdAt: '2026-08-13T00:00:00.000Z',
};

const NARRATIVE_READY_REPORT = {
  overallEvidenceConfidence: 'medium',
  coreIdentity: { available: true },
  drivingForce: { available: false },
  signaturePattern: { available: false },
  emergingThemes: { available: false },
  personalPositioning: { available: false },
  proofOfMe: { available: false },
};

describe('regeneratePersonalReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildApplicantStateFromSnapshot.mockResolvedValue(FAKE_STATE);
    mocks.candidateContextFromState.mockReturnValue(FAKE_CONTEXT);
    mocks.getLatestApplicationPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.getLatestApplicationProfileAnalysis.mockResolvedValue(null);
    mocks.getApplicationPersonalReportSupplements.mockResolvedValue({});
    mocks.findPersonalReportV2ByCacheKey.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.buildEvidenceBank.mockReturnValue({ version: 'eb-v1', sources: {}, interpretations: [], claims: [], missingInformation: [] });
    mocks.saveApplicationProfileAnalysis.mockResolvedValue({ versionId: 'analysis-a', migrationMissing: false });
    mocks.applyPersonalReportSupplements.mockImplementation((context: unknown) => context);
    mocks.buildPersonalCanvasDetails.mockReturnValue({
      capabilities: [],
      motivations: [],
      socialProof: [],
      growthPriorities: [],
      futurePathways: [],
    });
    mocks.synthesizePersonalReportNarrative.mockResolvedValue({});
  });

  it('returns migration_missing without touching OpenAI when the versions table has not been created yet', async () => {
    mocks.loadCandidateContext.mockResolvedValue((FAKE_CONTEXT));
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: true });
    mocks.getPersonalReportSupplements.mockResolvedValue({});

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', trigger: 'manual' });

    expect(result.status).toBe('migration_missing');
    expect(mocks.buildProfileEvaluationInput).not.toHaveBeenCalled();
  });

  it('returns cached without calling OpenAI when the input has not changed', async () => {
    mocks.loadCandidateContext.mockResolvedValue(FAKE_CONTEXT);
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: FAKE_RECORD, migrationMissing: false });
    mocks.getPersonalReportSupplements.mockResolvedValue({});
    mocks.shouldRegenerate.mockReturnValue(false);

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', trigger: 'matching_report' });

    expect(result.status).toBe('cached');
    if (result.status === 'cached') expect(result.record.id).toBe('v1');
    expect(mocks.buildProfileEvaluationInput).not.toHaveBeenCalled();
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('regenerates, stores Canvas details, and tags the new version when the input changed', async () => {
    mocks.loadCandidateContext.mockResolvedValue(FAKE_CONTEXT);
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: FAKE_RECORD, migrationMissing: false });
    mocks.getPersonalReportSupplements.mockResolvedValue({});
    mocks.shouldRegenerate.mockReturnValue(true);
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockResolvedValue({ narrativeActivities: [], intendedDirection: null });
    mocks.runProfileEvaluation.mockReturnValue({ confidence: 'medium' });
    const deterministicReport = {
      overallEvidenceConfidence: 'medium',
      coreIdentity: {},
      drivingForce: {},
      emergingThemes: {},
      personalPositioning: {},
      proofOfMe: {},
    };
    mocks.buildPersonalReport.mockReturnValue(deterministicReport);
    const canvasDetails = {
      capabilities: [],
      motivations: [],
      socialProof: [],
      growthPriorities: [],
      futurePathways: [],
    };
    mocks.buildPersonalCanvasDetails.mockReturnValue(canvasDetails);
    mocks.createPersonalReportV2Version.mockResolvedValue({
      record: { id: 'v2', generatedAt: '2026-08-14T00:00:00.000Z' },
      error: null,
    });
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', trigger: 'matching_report' });

    process.env.OPENAI_API_KEY = originalKey;

    expect(result.status).toBe('regenerated');
    if (result.status === 'regenerated') {
      expect(result.record.id).toBe('v2');
      expect(result.record.trigger).toBe('matching_report');
      expect((result.record.reportV2 as unknown as { canvasDetails?: unknown }).canvasDetails).toEqual(canvasDetails);
    }
    expect(mocks.buildPersonalCanvasDetails).toHaveBeenCalledWith(
      expect.objectContaining({ activities: [], intendedDirection: null }),
    );
    expect(mocks.createPersonalReportV2Version).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: 'user-1',
        trigger: 'matching_report',
        inputHash: 'hash-current',
        reportV2: expect.objectContaining({ canvasDetails }),
      }),
    );
  });

  it('returns not_configured when there is no OpenAI API key', async () => {
    mocks.loadCandidateContext.mockResolvedValue(FAKE_CONTEXT);
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: null, migrationMissing: false });
    mocks.getPersonalReportSupplements.mockResolvedValue({});
    mocks.shouldRegenerate.mockReturnValue(true);
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', trigger: 'manual' });

    process.env.OPENAI_API_KEY = originalKey;
    expect(result.status).toBe('not_configured');
  });

  it('keeps the previous record and returns error when generation throws', async () => {
    mocks.loadCandidateContext.mockResolvedValue(FAKE_CONTEXT);
    mocks.getLatestPersonalReportV2.mockResolvedValue({ record: FAKE_RECORD, migrationMissing: false });
    mocks.getPersonalReportSupplements.mockResolvedValue({});
    mocks.shouldRegenerate.mockReturnValue(true);
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockRejectedValue(new Error('model timeout'));
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', trigger: 'manual' });

    process.env.OPENAI_API_KEY = originalKey;
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.record?.id).toBe('v1');
  });

  it('generates from the requested application snapshot and writes complete lineage', async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockResolvedValue({ narrativeActivities: [], intendedDirection: null });
    mocks.runProfileEvaluation.mockReturnValue({ confidence: 'medium' });
    mocks.buildPersonalReport.mockReturnValue(NARRATIVE_READY_REPORT);
    mocks.createPersonalReportV2Version.mockResolvedValue({
      record: { id: 'application-v1', generatedAt: '2026-08-26T00:00:00.000Z' },
      error: null,
    });
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
    });

    process.env.OPENAI_API_KEY = originalKey;
    expect(result.status).toBe('regenerated');
    expect(mocks.loadCandidateContext).not.toHaveBeenCalled();
    expect(mocks.buildApplicantStateFromSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', applicationId: 'app-a' }),
    );
    expect(mocks.saveApplicationProfileAnalysis).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ applicationId: 'app-a', confirmedSnapshotId: 'snapshot-a' }),
    );
    expect(mocks.createPersonalReportV2Version).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        applicationId: 'app-a',
        confirmedSnapshotId: 'snapshot-a',
        sourceAnalysisVersionId: 'analysis-a',
        reportContractVersion: 'personal-report-v3',
        cacheKey: 'stable-hash',
      }),
    );
  });

  it('does not generate when the application has no confirmed snapshot', async () => {
    mocks.buildApplicantStateFromSnapshot.mockRejectedValue(new mocks.SnapshotNotFoundError());

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
    });

    expect(result).toEqual({ status: 'snapshot_missing' });
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('blocks an application report with no evidence-backed section instead of retrying AI', async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockResolvedValue({ narrativeActivities: [], intendedDirection: null });
    mocks.runProfileEvaluation.mockReturnValue({ confidence: 'low' });
    mocks.buildPersonalReport.mockReturnValue({
      coreIdentity: { available: false },
      drivingForce: { available: false },
      signaturePattern: { available: false },
      emergingThemes: { available: false },
      personalPositioning: { available: false },
      proofOfMe: { available: false },
    });
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
    });

    process.env.OPENAI_API_KEY = originalKey;
    expect(result.status).toBe('insufficient_evidence');
    expect(mocks.synthesizePersonalReportNarrative).not.toHaveBeenCalled();
  });

  it('returns the application cache for the same snapshot and contracts', async () => {
    mocks.getLatestApplicationPersonalReportV2.mockResolvedValue({
      migrationMissing: false,
      record: {
        ...FAKE_RECORD,
        applicationId: 'app-a',
        confirmedSnapshotId: 'snapshot-a',
        sourceAnalysisVersionId: 'analysis-a',
        reportContractVersion: 'personal-report-v3',
        cacheKey: 'stable-hash',
        inputHash: 'stable-hash',
      },
    });

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
    });

    expect(result.status).toBe('cached');
    expect(mocks.buildProfileEvaluationInput).not.toHaveBeenCalled();
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('force generation reuses the analysis snapshot and appends a new version', async () => {
    mocks.getLatestApplicationProfileAnalysis.mockResolvedValue({
      id: 'analysis-a',
      confirmedSnapshotId: 'snapshot-a',
      inputHash: 'stable-hash',
      moduleVersions: {
        applicantState: 'applicant-state-v1',
        reflection: 'reflection-analysis-v1',
        evidence: 'eb-v1',
        extraction: 'extraction-v2',
      },
      structuredOutputs: {
        evaluation: { confidence: 'medium' },
        evaluationInput: { narrativeActivities: [], intendedDirection: null },
      },
      evidenceBank: { claims: [] },
    });
    mocks.buildPersonalReport.mockReturnValue(NARRATIVE_READY_REPORT);
    mocks.createPersonalReportV2Version.mockResolvedValue({
      record: { id: 'application-v2', generatedAt: '2026-08-26T00:00:00.000Z' },
      error: null,
    });

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
      force: true,
    });

    expect(result.status).toBe('regenerated');
    expect(mocks.buildProfileEvaluationInput).not.toHaveBeenCalled();
    expect(mocks.saveApplicationProfileAnalysis).not.toHaveBeenCalled();
    expect(mocks.createPersonalReportV2Version).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ sourceAnalysisVersionId: 'analysis-a' }),
    );
  });

  it('deduplicates requests carrying the same idempotency key', async () => {
    mocks.findPersonalReportV2ByCacheKey.mockResolvedValue({
      migrationMissing: false,
      record: { ...FAKE_RECORD, applicationId: 'app-a', confirmedSnapshotId: 'snapshot-a', cacheKey: 'stable-hash' },
    });

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
      idempotencyKey: 'request-1',
    });

    expect(result.status).toBe('cached');
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('keeps the prior report and records the narrative validation failure without persisting a deterministic fallback', async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockResolvedValue({ narrativeActivities: [], intendedDirection: null });
    mocks.runProfileEvaluation.mockReturnValue({ confidence: 'medium' });
    mocks.buildPersonalReport.mockReturnValue({ ...NARRATIVE_READY_REPORT, limitations: [] });
    mocks.synthesizePersonalReportNarrative.mockImplementation(async (args: { onFailure?: (code: string) => void }) => {
      args.onFailure?.('invalid_evidence_ids');
      return null;
    });
    mocks.createPersonalReportV2Version.mockResolvedValue({
      record: { id: 'application-v1', generatedAt: '2026-08-26T00:00:00.000Z' },
      error: null,
    });
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({ supabase: {} as never, userId: 'user-1', applicationId: 'app-a', trigger: 'manual' });
    process.env.OPENAI_API_KEY = originalKey;

    expect(result.status).toBe('error');
    expect(result.status === 'error' && result.message).toContain('invalid_evidence_ids');
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });

  it('keeps the previous report and writes no analysis when an extractor fails', async () => {
    mocks.isOpenAIConfigured.mockReturnValue(true);
    mocks.buildProfileEvaluationInput.mockRejectedValue(new Error('extractor failed'));
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-key';

    const { regeneratePersonalReport } = await importSubject();
    const result = await regeneratePersonalReport({
      supabase: {} as never,
      userId: 'user-1',
      applicationId: 'app-a',
      trigger: 'manual',
    });
    process.env.OPENAI_API_KEY = originalKey;

    expect(result.status).toBe('error');
    expect(mocks.saveApplicationProfileAnalysis).not.toHaveBeenCalled();
    expect(mocks.createPersonalReportV2Version).not.toHaveBeenCalled();
  });
});
