import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadCandidateContext: vi.fn(),
  getLatestPersonalReportV2: vi.fn(),
  getPersonalReportSupplements: vi.fn(),
  createPersonalReportV2Version: vi.fn(),
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
}));
vi.mock('./personal-report-v2-repository', () => ({
  getLatestPersonalReportV2: mocks.getLatestPersonalReportV2,
  getPersonalReportSupplements: mocks.getPersonalReportSupplements,
  createPersonalReportV2Version: mocks.createPersonalReportV2Version,
}));
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
vi.mock('../domain', () => ({ buildPersonalReport: mocks.buildPersonalReport }));
vi.mock('../domain/personal-canvas-details', () => ({
  buildPersonalCanvasDetails: mocks.buildPersonalCanvasDetails,
}));

async function importSubject() {
  return import('./personal-report-generation');
}

const FAKE_CONTEXT = { profile: {}, achievements: [], activities: [] };
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

describe('regeneratePersonalReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyPersonalReportSupplements.mockImplementation((context: unknown) => context);
    mocks.buildPersonalCanvasDetails.mockReturnValue({
      capabilities: [],
      motivations: [],
      socialProof: [],
      growthPriorities: [],
      futurePathways: [],
    });
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
});
