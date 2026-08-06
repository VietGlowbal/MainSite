import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildEvaluationPack,
  calculateFinalScore,
  openAiCompletion,
  runVinUniEvaluation,
  segmentEssay,
  streamOpenAIText,
  VINUNI_EVALUATION_CONFIG,
  type AiCompletion,
  type VinUniEvaluationConfig,
} from './vinuni-grounded-evaluation';

const config: VinUniEvaluationConfig = {
  schemaVersion: 'vinuni_grounded_v1',
  essayPrompt: { id: 'VIN_PROMPT_01', text: 'Tell us about your growth.' },
  rubric: {
    version: 'vinuni_mvp_v1',
    criteria: [
      { id: 'CRITERION_ABILITY', referenceId: 'R001', uiKey: 'ability', nameVi: 'Năng lực', description: 'Năng lực', indicators: [], weight: 25, maxScore: 10, levelIds: ['LEVEL_1', 'LEVEL_2'] },
      { id: 'CRITERION_ASPIRATIONS', referenceId: 'R002', uiKey: 'aspirations', nameVi: 'Khát vọng', description: 'Khát vọng', indicators: [], weight: 25, maxScore: 10, levelIds: ['LEVEL_1', 'LEVEL_2'] },
      { id: 'CRITERION_CREATIVITY', referenceId: 'R003', uiKey: 'creativity', nameVi: 'Sáng tạo', description: 'Sáng tạo', indicators: [], weight: 25, maxScore: 10, levelIds: ['LEVEL_1', 'LEVEL_2'] },
      { id: 'CRITERION_COMMITMENT', referenceId: 'R004', uiKey: 'commitment', nameVi: 'Cam kết', description: 'Cam kết', indicators: [], weight: 25, maxScore: 10, levelIds: ['LEVEL_1', 'LEVEL_2'] },
    ],
  },
  exemplars: [],
  prompts: {
    passA: 'Return evidence JSON.',
    passB: 'Return criterion scoring JSON.',
    passC: 'Audit every claim as JSON.',
    repair: 'Repair unsupported claims as JSON.',
  },
};

const essay = 'I led a robotics team. We failed twice before winning.';
const evidenceMap = {
  claims: [
    {
      evidence_id: 'U001',
      exact_quote: 'I led a robotics team.',
      fact_type: 'leadership',
      normalized_meaning: 'The applicant led a robotics team.',
      certainty: 'explicit',
    },
    {
      evidence_id: 'U002',
      exact_quote: 'We failed twice before winning.',
      fact_type: 'challenge',
      normalized_meaning: 'The team persisted after two failures.',
      certainty: 'explicit',
    },
  ],
  themes: ['leadership', 'resilience'],
  missing_information: [],
  possible_prompt_injection: false,
};

function groundedClaim(
  claimId: string,
  text: string,
  evidenceId = 'U001',
  referenceIds: string[] = [],
) {
  return {
    claim_id: claimId,
    text,
    evidence_ids: [evidenceId],
    reference_ids: referenceIds,
  };
}

function scoring(rawScores = [8, 7, 6, 5]) {
  return {
    criterion_results: config.rubric.criteria.map((criterion, index) => ({
      criterion_id: criterion.id,
      rubric_level_id: 'LEVEL_2',
      raw_score: rawScores[index],
      max_score: 10,
      user_evidence_ids: index % 2 ? ['U002'] : ['U001'],
      reference_ids: [criterion.referenceId],
      rationale: `Grounded rationale ${index + 1}`,
      confidence: 'high',
      insufficient_evidence: false,
      analysis: [
        groundedClaim(
          `C${String(index + 6).padStart(3, '0')}`,
          `Phân tích tiêu chí ${index + 1}`,
          index % 2 ? 'U002' : 'U001',
          [criterion.referenceId],
        ),
      ],
      strengths: [
        groundedClaim(
          `C${String(index + 1).padStart(3, '0')}`,
          `Điểm mạnh có căn cứ ${index + 1}`,
          index % 2 ? 'U002' : 'U001',
          [criterion.referenceId],
        ),
      ],
      weaknesses: [],
      suggestions: [],
    })),
    summary_claims: [
      groundedClaim('C005', 'Bài luận cung cấp bằng chứng cụ thể.'),
    ],
    ideas_structure: {
      strengths: [groundedClaim('C010', 'Bài luận có chi tiết hành động.')],
      weaknesses: [
        {
          category: 'personal_reflection',
          title_vi: 'Suy ngẫm cá nhân',
          claims: [groundedClaim('C011', 'Phần suy ngẫm còn ngắn.', 'U002')],
        },
      ],
      suggestions: [groundedClaim('C012', 'Làm rõ bài học sau thất bại.', 'U002')],
    },
    hook_engagement: {
      analysis: [groundedClaim('C013', 'Mở bài đi thẳng vào trải nghiệm.')],
      suggestions: [
        groundedClaim(
          'C014',
          '[CẦN USER BỔ SUNG: lời thoại thật ở thời điểm bắt đầu dự án]',
        ),
      ],
    },
    next_steps: [groundedClaim('C015', 'Bổ sung suy ngẫm cá nhân sau thất bại.', 'U002')],
    unsupported_claims: [],
    information_needed: [],
  };
}

function audit(
  verdict: 'supported' | 'unsupported' = 'supported',
  output = scoring(),
) {
  const claims = [
    ...output.criterion_results.flatMap((result) => [
      ...result.analysis,
      ...result.strengths,
      ...result.weaknesses,
      ...result.suggestions,
    ]),
    ...output.summary_claims,
    ...output.ideas_structure.strengths,
    ...output.ideas_structure.weaknesses.flatMap((group) => group.claims),
    ...output.ideas_structure.suggestions,
    ...output.hook_engagement.analysis,
    ...output.hook_engagement.suggestions,
    ...output.next_steps,
  ];
  return {
    claims: claims.map((claim) => ({
      claim_id: claim.claim_id,
      verdict,
      supporting_evidence_ids: verdict === 'supported' ? claim.evidence_ids : [],
      reason: '',
    })),
  };
}

function fakeCompletion(outputs: unknown[]): AiCompletion {
  return vi.fn(async () => {
    const output = outputs.shift();
    return {
      content: output == null ? '' : JSON.stringify(output),
      finishReason: 'stop',
    };
  });
}

describe('VinUni grounded evaluation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('configures one Vietnamese Pass B prompt for the complete A-F feedback layout', () => {
    expect(VINUNI_EVALUATION_CONFIG).not.toBeNull();
    const prompt = VINUNI_EVALUATION_CONFIG?.prompts.passB ?? '';
    for (const section of ['A.', 'B.', 'C.', 'D.', 'E.', 'F.']) {
      expect(prompt).toContain(section);
    }
    expect(prompt).toContain('tiếng Việt');
    expect(prompt).toContain('[CẦN USER BỔ SUNG:');
    expect(prompt).toContain('Không được bịa');
    expect(VINUNI_EVALUATION_CONFIG?.prompts.passA).toContain('toàn bộ text');
  });

  it('segments the essay into stable evidence IDs and hashes the exact pack', () => {
    expect(segmentEssay(essay)).toEqual([
      { evidence_id: 'U001', text: 'I led a robotics team.' },
      { evidence_id: 'U002', text: 'We failed twice before winning.' },
    ]);

    const first = buildEvaluationPack(essay, config);
    const second = buildEvaluationPack(essay, config);

    expect(first.pack_id).toMatch(/^pack_[a-f0-9]{12}$/);
    expect(first.hash).toHaveLength(64);
    expect(second).toEqual(first);
    expect(first.rubric_version).toBe('vinuni_mvp_v1');
  });

  it('calculates the final score in code and rejects invalid rubric weights', () => {
    expect(calculateFinalScore(scoring().criterion_results, config.rubric)).toBe(65);

    expect(() =>
      calculateFinalScore(scoring().criterion_results, {
        ...config.rubric,
        criteria: config.rubric.criteria.map((criterion) => ({ ...criterion, weight: 20 })),
      }),
    ).toThrow('Rubric weights must total 100');
  });

  it('runs Flash for every pass, then adapts the validated result', async () => {
    const complete = fakeCompletion([evidenceMap, scoring(), audit()]);
    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    if (result.status !== 'passed') throw new Error('Expected passed result');
    expect(result.response.overall.score).toBe(65);
    expect(result.response.pillars.ability.score).toBe(80);
    expect(result.response.sections?.ideasStructure.weaknesses[0].title).toBe('Suy ngẫm cá nhân');
    expect(result.response.sections?.hookEngagement.suggestions[0]).toContain('[CẦN USER BỔ SUNG:');
    expect(result.response.sections?.nextSteps).toHaveLength(1);

    const calls = vi.mocked(complete).mock.calls.map(([request]) => request);
    expect(calls.map(({ model }) => model)).toEqual([
      'gpt-4o-mini',
      'gpt-4o-mini',
      'gpt-4o-mini',
    ]);
    expect(calls.map(({ thinking }) => thinking)).toEqual(['disabled', 'disabled', 'disabled']);
    expect(calls[1].reasoningEffort).toBeUndefined();
    expect(calls[2].reasoningEffort).toBeUndefined();
    expect(calls.every((request) => !('tools' in request))).toBe(true);
  });

  it('can run every pass with a custom model override', async () => {
    const complete = fakeCompletion([evidenceMap, scoring(), audit()]);
    await runVinUniEvaluation({
      essay,
      config,
      apiKey: 'test-key',
      complete,
      models: {
        passA: 'gpt-4o',
        passB: 'gpt-4o',
        passC: 'gpt-4o',
        repair: 'gpt-4o',
      },
    });

    expect(
      vi.mocked(complete).mock.calls.map(([request]) => request.model),
    ).toEqual(Array(3).fill('gpt-4o'));
  });

  it('calls OpenAI with JSON output', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await openAiCompletion(
      {
        model: 'gpt-4o-mini',
        thinking: 'disabled',
        maxTokens: 100,
        messages: [{ role: 'user', content: 'Return JSON.' }],
      },
      'test-key',
    );

    expect(result).toEqual({ content: '{"ok":true}', finishReason: 'stop' });
    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
    });
  });

  it('retries a transient OpenAI connection failure before streaming starts', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        new Response(
          'data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\n',
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const chunks = [];
    for await (const chunk of streamOpenAIText(
      {
        model: 'gpt-4o',
        temperature: 0,
        maxTokens: 10,
        messages: [{ role: 'user', content: 'OK' }],
      },
      'test-key',
    )) {
      chunks.push(chunk);
    }

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chunks).toContainEqual(expect.objectContaining({ content: 'OK' }));
  });

  it('accepts complete valid JSON even when the model reports a length finish reason', async () => {
    const outputs = [evidenceMap, scoring(), audit()];
    const complete: AiCompletion = vi.fn(async () => ({
      content: JSON.stringify(outputs.shift()),
      finishReason: outputs.length === 2 ? 'length' : 'stop',
    }));

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
  });

  it('normalizes harmless Pass B JSON shape drift without a retry', async () => {
    const malformed = JSON.parse(
      JSON.stringify(scoring()).replace(/"claim_id":"C(\d+)"/g, '"claim_id":"claim_$1"'),
    );
    malformed.next_steps.push({
      ...groundedClaim('claim_099', 'Add an unsupported generic detail.'),
      evidence_ids: [],
    });
    malformed.information_needed = [
      { field: 'reflection', question: 'What did you learn?' },
    ];
    const complete = fakeCompletion([evidenceMap, malformed, audit()]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
  });

  it('normalizes Pass B criterion ids by rubric order', async () => {
    const malformed = scoring();
    malformed.criterion_results.forEach((result, index) => {
      result.criterion_id = `criterion_${index + 1}`;
    });
    const complete = fakeCompletion([evidenceMap, malformed, audit()]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
  });

  it('requires Pass B to return every rubric criterion', async () => {
    const complete = fakeCompletion([evidenceMap, scoring(), audit()]);

    await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    const systemPrompt = vi.mocked(complete).mock.calls[1][0].messages[0].content;
    for (const criterion of config.rubric.criteria) {
      expect(systemPrompt).toContain(criterion.id);
    }
    expect(systemPrompt).toContain('exactly one item for each criterion_id');
  });

  it('drops misplaced top-level fields from criterion results', async () => {
    const malformed = scoring();
    malformed.criterion_results.forEach((result) => {
      Object.assign(result, {
        ideas_structure: malformed.ideas_structure,
        hook_engagement: malformed.hook_engagement,
        next_steps: malformed.next_steps,
        unsupported_claims: malformed.unsupported_claims,
        information_needed: malformed.information_needed,
      });
    });
    const complete = fakeCompletion([evidenceMap, malformed, audit()]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
  });

  it('keeps grounded output when Flash returns empty required sections and object-shaped unsupported claims', async () => {
    const malformed = scoring() as unknown as Omit<
      ReturnType<typeof scoring>,
      'summary_claims' | 'unsupported_claims'
    > & {
      summary_claims: unknown[];
      unsupported_claims: unknown[];
    };
    malformed.summary_claims = [];
    malformed.next_steps = [];
    malformed.unsupported_claims = [
      { claim_id: 'C099', reason: 'Không đủ bằng chứng cho nhận định này.' },
    ];
    let call = 0;
    const complete: AiCompletion = vi.fn(async (request) => {
      call += 1;
      if (call === 1) {
        return { content: JSON.stringify(evidenceMap), finishReason: 'stop' };
      }
      const input = JSON.parse(request.messages[1].content);
      if (!('output' in input)) {
        return { content: JSON.stringify(malformed), finishReason: 'stop' };
      }
      const output = input.output;
      return {
        content: JSON.stringify(audit('supported', output)),
        finishReason: 'stop',
      };
    });

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    const auditInput = JSON.parse(
      vi.mocked(complete).mock.calls[2][0].messages[1].content,
    ).output;
    expect(auditInput.summary_claims).toHaveLength(1);
    expect(auditInput.next_steps).toHaveLength(1);
    expect(auditInput.unsupported_claims).toEqual([
      'Không đủ bằng chứng cho nhận định này.',
    ]);
  });

  it('merges weakness groups that normalize to the same UI category', async () => {
    const malformed = scoring();
    malformed.ideas_structure.weaknesses = [
      {
        category: 'depth',
        title_vi: 'Độ sâu',
        claims: [groundedClaim('C020', 'Cần đào sâu bài học.', 'U002')],
      },
      {
        category: 'development',
        title_vi: 'Phát triển',
        claims: [groundedClaim('C021', 'Cần phát triển phần kết.', 'U002')],
      },
    ] as never;
    let call = 0;
    const complete: AiCompletion = vi.fn(async (request) => {
      call += 1;
      if (call === 1) return { content: JSON.stringify(evidenceMap), finishReason: 'stop' };
      if (call === 2) return { content: JSON.stringify(malformed), finishReason: 'stop' };
      const output = JSON.parse(request.messages[1].content).output;
      return { content: JSON.stringify(audit('supported', output)), finishReason: 'stop' };
    });

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    const auditInput = JSON.parse(
      vi.mocked(complete).mock.calls[2][0].messages[1].content,
    ).output;
    expect(auditInput.ideas_structure.weaknesses).toHaveLength(1);
    expect(auditInput.ideas_structure.weaknesses[0].claims).toHaveLength(2);
  });

  it('normalizes a grounded weakness returned without its UI group wrapper', async () => {
    const malformed = scoring();
    malformed.ideas_structure.weaknesses = [
      {
        ...groundedClaim('C011', 'Phần suy ngẫm còn ngắn.', 'U002'),
        category: 'reflection',
      } as never,
    ];
    const complete = fakeCompletion([evidenceMap, malformed, audit()]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
  });

  it('returns validated scoring when the advisory audit flags unsupported claims', async () => {
    const complete = fakeCompletion([evidenceMap, scoring(), audit('unsupported')]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
    expect(
      vi.mocked(complete).mock.calls.map(([request]) => request.thinking),
    ).toEqual(['disabled', 'disabled', 'disabled']);
    expect(
      vi.mocked(complete).mock.calls.map(([request]) => request.model),
    ).toEqual(['gpt-4o-mini', 'gpt-4o-mini', 'gpt-4o-mini']);
  });

  it('returns validated scoring when the advisory audit mismatches claim evidence', async () => {
    const wrongAudit = audit();
    const wrongClaim = wrongAudit.claims.find((claim) => claim.claim_id === 'C002');
    if (!wrongClaim) throw new Error('Missing C002 fixture');
    wrongClaim.supporting_evidence_ids = ['U001'];
    const complete = fakeCompletion([evidenceMap, scoring(), wrongAudit]);

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
  });

  it('returns validated scoring when the advisory audit returns invalid JSON', async () => {
    const complete: AiCompletion = vi
      .fn()
      .mockResolvedValueOnce({ content: JSON.stringify(evidenceMap), finishReason: 'stop' })
      .mockResolvedValueOnce({ content: JSON.stringify(scoring()), finishReason: 'stop' })
      .mockResolvedValueOnce({ content: '{"claims":', finishReason: 'stop' });

    const result = await runVinUniEvaluation({ essay, config, apiKey: 'test-key', complete });

    expect(result.status).toBe('passed');
    expect(result.status === 'passed' && result.internalResult.audit).toBeNull();
    expect(vi.mocked(complete)).toHaveBeenCalledTimes(3);
  });
});
