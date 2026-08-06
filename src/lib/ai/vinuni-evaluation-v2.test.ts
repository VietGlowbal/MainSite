import { describe, expect, it, vi } from 'vitest';
import {
  buildVinUniEvaluationContext,
  calculateEssayAchievability,
  createVinUniInputHash,
  parseEvidenceCoverageMap,
  parseVinUniV2DiagnosticsLine,
  parseVinUniV2SectionLine,
  streamVinUniEvaluationV2,
  VINUNI_EVALUATION_CONFIG_V2,
  type VinUniV2StreamEvent,
} from './vinuni-evaluation-v2';
import type { VinUniTextStream } from './vinuni-grounded-evaluation';

const essay =
  'I led a robotics workshop for younger students. After the first session failed, I simplified the design and measured improved completion.';

describe('VinUni V2 context', () => {
  it('matches a VinUni programme and keeps demo profile empty', () => {
    const context = buildVinUniEvaluationContext({
      application: {
        id: 'app-1',
        universityName: 'VinUniversity',
        courseName: 'BSc Computer Science',
      },
      course: {
        courseName: 'Bachelor of Computer Science',
        degreeLevel: 'Bachelor',
        subject: 'Computer Science',
      },
      profile: null,
    });

    expect(context.programmeMatch).toMatchObject({
      confidence: 'high',
      programmeName: 'Bachelor of Computer Science',
    });
    expect(context.profileSnapshot).toBeNull();
    expect(context.profileEvidence).toEqual([]);
    expect(context.programmeEvidence.every(({ id }) => /^T\d{3}$/.test(id))).toBe(true);
  });

  it('falls back to VinUni-level context when the programme cannot be matched', () => {
    const context = buildVinUniEvaluationContext({
      application: {
        id: 'app-2',
        universityName: 'VinUniversity',
        courseName: 'Experimental Space Law',
      },
      course: null,
      profile: null,
    });

    expect(context.programmeMatch).toEqual({
      confidence: 'low',
      programmeName: null,
    });
    expect(context.programmeEvidence).toEqual([]);
  });

  it('creates a deterministic hash from essay and prompt', () => {
    expect(createVinUniInputHash(' essay ', ' prompt ')).toBe(
      createVinUniInputHash('essay', 'prompt'),
    );
    expect(createVinUniInputHash('essay changed', 'prompt')).not.toBe(
      createVinUniInputHash('essay', 'prompt'),
    );
  });
});

describe('VinUni V2 validation', () => {
  const segments = [{ evidence_id: 'U001', text: essay }];

  it('rejects coverage-map evidence IDs that are absent from the essay', () => {
    expect(() =>
      parseEvidenceCoverageMap(
        {
          claims: [
            {
              id: 'C001',
              text: 'The applicant led a workshop.',
              evidenceIds: ['U999'],
            },
          ],
          reflectionArcs: [],
          promptCoverage: [
            {
              id: 'Q001',
              requirement: 'Describe a meaningful achievement.',
              status: 'answered',
              evidenceIds: ['U001'],
            },
          ],
          aaccCoverage: {
            ability: { evidenceIds: ['U001'], strength: 'clear' },
            aspirations: { evidenceIds: [], strength: 'none' },
            creativity: { evidenceIds: ['U001'], strength: 'emerging' },
            commitment: { evidenceIds: ['U001'], strength: 'clear' },
          },
          informationGaps: [],
          possiblePromptInjection: false,
        },
        segments,
      ),
    ).toThrow('Unknown essay evidence ID: U999');
  });

  it('rejects an applicant assessment supported only by programme context', () => {
    const line = JSON.stringify({
      section: 'A',
      data: {
        items: [
          {
            id: 'R001',
            text: 'Bài luận cho thấy ứng viên phù hợp rõ ràng với định hướng học tập thực hành và môi trường dự án liên ngành tại chương trình.',
            evidenceRefs: [{ source: 'programme', id: 'T001' }],
            priority: 'high',
          },
        ],
      },
    });

    expect(() =>
      parseVinUniV2SectionLine(line, {
        essayIds: new Set(['U001']),
        profileIds: new Set(),
        programmeIds: new Set(['T001']),
      }),
    ).toThrow('Too small');
  });

  it('accepts opaque review IDs because evidence refs carry the validated identity', () => {
    const line = JSON.stringify({
      section: 'A',
      data: {
        items: [
          {
            id: 'R-A-01',
            text: 'Bài luận cho thấy ứng viên chủ động tổ chức workshop, nhận trách nhiệm khi buổi đầu thất bại và điều chỉnh phương pháp dựa trên phản hồi thực tế.',
            evidenceRefs: [{ source: 'essay', id: 'U001' }],
            priority: 'high',
          },
        ],
      },
    });

    expect(
      parseVinUniV2SectionLine(line, {
        essayIds: new Set(['U001']),
        profileIds: new Set(),
        programmeIds: new Set(),
      }),
    ).toMatchObject({ section: 'A' });
  });

  it('accepts concise evidence-backed review claims without a word-count floor', () => {
    const line = JSON.stringify({
      section: 'A',
      data: {
        items: [
          {
            id: 'R-A-short',
            text: 'Dẫn chứng thể hiện khả năng học hỏi từ thất bại.',
            evidenceRefs: [{ source: 'essay', id: 'U001' }],
            priority: 'high',
          },
        ],
      },
    });

    expect(
      parseVinUniV2SectionLine(line, {
        essayIds: new Set(['U001']),
        profileIds: new Set(),
        programmeIds: new Set(),
      }),
    ).toMatchObject({ section: 'A' });
  });

  it('normalizes Pro output and drops only ungrounded applicant claims', () => {
    const evidenceRefs = Array.from({ length: 9 }, (_, index) => ({
      source: 'essay',
      id: `U${String(index + 1).padStart(3, '0')}`,
    }));
    const line = JSON.stringify({
      section: 'A',
      data: {
        items: [
          {
            id: 'R-A-01',
            text: 'Nhận xét hợp lệ với nhiều dẫn chứng.',
            evidenceRefs,
            priority: 'ưu tiên cao',
          },
          {
            id: 'R-A-02',
            text: 'Nhận xét không có dẫn chứng sẽ bị bỏ.',
            evidenceRefs: [],
            priority: 'thấp',
          },
        ],
      },
    });

    expect(
      parseVinUniV2SectionLine(line, {
        essayIds: new Set(evidenceRefs.map(({ id }) => id)),
        profileIds: new Set(),
        programmeIds: new Set(),
      }),
    ).toMatchObject({
      data: {
        items: [{ id: 'R-A-01', priority: 'high', evidenceRefs }],
      },
    });
  });

  it('allows evidence-free improvement actions and questions in section E', () => {
    const claim = (id: string) => ({
      id,
      text: 'Câu hỏi bổ sung hoặc hành động cải thiện.',
      evidenceRefs: [],
      priority: id === 'R-E-01' ? 'ưu tiên' : 'trung bình',
    });
    const line = JSON.stringify({
      section: 'E',
      data: {
        actions: [claim('R-E-01'), claim('R-E-02'), claim('R-E-03')],
        questions: [claim('R-E-04'), claim('R-E-05'), claim('R-E-06')],
      },
    });

    expect(
      parseVinUniV2SectionLine(line, {
        essayIds: new Set(['U001']),
        profileIds: new Set(),
        programmeIds: new Set(),
      }),
    ).toMatchObject({
      section: 'E',
      data: {
        actions: [{ priority: 'medium' }, { priority: 'medium' }, { priority: 'medium' }],
        questions: [{ priority: 'medium' }, { priority: 'medium' }, { priority: 'medium' }],
      },
    });
  });
});

describe('VinUni essay diagnostics', () => {
  it('rejects diagnostic issues that cannot highlight essay text', () => {
    const dimensions = Object.fromEntries(
      ['writing', 'detail', 'voice', 'character', 'curiosity', 'contribution'].map(
        (key) => [key, { score: 6, summary: `Tóm tắt ${key}` }],
      ),
    );
    expect(() =>
      parseVinUniV2DiagnosticsLine(
        JSON.stringify({
          type: 'diagnostics',
          data: {
            dimensions,
            issues: [
              {
                id: 'DIAG-profile',
                criterion: 'voice',
                text: 'Nhận xét này không thể highlight trong essay.',
                evidenceRefs: [{ source: 'profile', id: 'P001' }],
                priority: 'medium',
              },
            ],
          },
        }),
        {
          essayIds: new Set(['U001']),
          profileIds: new Set(['P001']),
          programmeIds: new Set(),
        },
      ),
    ).toThrow();
  });

  it('validates diagnostic evidence and calculates achievability on the server', () => {
    const event = parseVinUniV2DiagnosticsLine(
      JSON.stringify({
        type: 'diagnostics',
        data: {
          dimensions: Object.fromEntries(
            ['writing', 'detail', 'voice', 'character', 'curiosity', 'contribution'].map(
              (key) => [key, { score: 6, summary: `Tóm tắt ${key}` }],
            ),
          ),
          issues: [
            {
              id: 'DIAG-1',
              criterion: 'detail',
              text: 'Bổ sung chi tiết cụ thể tại bước ngoặt.',
              evidenceRefs: [{ source: 'essay', id: 'U001' }],
              priority: 'high',
            },
          ],
        },
      }),
      {
        essayIds: new Set(['U001']),
        profileIds: new Set(),
        programmeIds: new Set(),
      },
    );

    expect(event.data.achievability).toMatchObject({
      currentScore: 6,
      potentialScore: 6.5,
      dimensions: { detail: { current: 6, potential: 6.5 } },
    });
  });

  it('calculates an evidence-backed potential score from fixed impact weights', () => {
    const dimensions = {
      writing: { score: 6, summary: 'Writing is clear but repetitive.' },
      detail: { score: 6, summary: 'Key moments need more concrete detail.' },
      voice: { score: 6, summary: 'The personal voice is still restrained.' },
      character: { score: 6, summary: 'The essay shows accountability.' },
      curiosity: { score: 6, summary: 'Curiosity is present but underdeveloped.' },
      contribution: { score: 6, summary: 'Contribution is supported by outcomes.' },
    };
    const diagnostics = {
      dimensions,
      issues: [
        {
          id: 'DIAG-1',
          criterion: 'writing' as const,
          text: 'Shorten repeated background details.',
          evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
          priority: 'high' as const,
        },
        {
          id: 'DIAG-2',
          criterion: 'detail' as const,
          text: 'Show the students’ reaction.',
          evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
          priority: 'medium' as const,
        },
        {
          id: 'DIAG-3',
          criterion: 'voice' as const,
          text: 'Add the applicant’s immediate thought.',
          evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
          priority: 'low' as const,
        },
      ],
    };

    expect(calculateEssayAchievability(diagnostics)).toEqual({
      currentScore: 6,
      potentialScore: 6.9,
      dimensions: {
        writing: { current: 6, potential: 6.5 },
        detail: { current: 6, potential: 6.3 },
        voice: { current: 6, potential: 6.1 },
        character: { current: 6, potential: 6 },
        curiosity: { current: 6, potential: 6 },
        contribution: { current: 6, potential: 6 },
      },
    });
  });

  it('caps each dimension at ten and at two points of improvement', () => {
    const diagnostics = {
      dimensions: Object.fromEntries(
        ['writing', 'detail', 'voice', 'character', 'curiosity', 'contribution'].map(
          (key) => [key, { score: key === 'writing' ? 9.8 : 5, summary: key }],
        ),
      ) as Record<
        'writing' | 'detail' | 'voice' | 'character' | 'curiosity' | 'contribution',
        { score: number; summary: string }
      >,
      issues: Array.from({ length: 6 }, (_, index) => ({
        id: `DIAG-${index}`,
        criterion: 'writing' as const,
        text: `Issue ${index}`,
        evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
        priority: 'high' as const,
      })),
    };

    expect(calculateEssayAchievability(diagnostics).dimensions.writing).toEqual({
      current: 9.8,
      potential: 10,
    });
  });
});

describe('VinUni V2 two-pass stream', () => {
  it('uses the corpus-calibrated causal and reciprocal-fit rubric', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [],
      promptCoverage: [{
        id: 'Q001',
        requirement: 'Describe a meaningful achievement.',
        status: 'answered',
        evidenceIds: ['U001'],
      }],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const requests: Parameters<VinUniTextStream>[0][] = [];
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      requests.push(request);
      yield {
        content: requests.length === 1 ? JSON.stringify(coverage) : '',
        finishReason: 'stop',
      };
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });

    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      requestedSections: ['A'],
      stream: provider as VinUniTextStream,
    })) {
      void event;
    }

    expect(VINUNI_EVALUATION_CONFIG_V2.promptVersion).toBe('vinuni_two_pass_vi_v2_4');
    expect(requests[0].messages[0].content).toContain(
      'bối cảnh → tension → lựa chọn → hành động → kết quả → insight',
    );
    expect(requests[1].messages[0].content).toEqual(
      expect.stringContaining('VinUni cung cấp X; ứng viên dùng X làm Y và đóng góp Z'),
    );
    expect(requests[1].messages[0].content).toEqual(
      expect.stringContaining('Không thưởng riêng cho trauma, số liệu lớn, tên tổ chức'),
    );
  });

  it('buffers section A until diagnostics has been emitted', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [],
      promptCoverage: [{
        id: 'Q001',
        requirement: 'Describe a meaningful achievement.',
        status: 'answered',
        evidenceIds: ['U001'],
      }],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const claim = {
      id: 'R-A-01',
      text: 'Bài luận cho thấy ứng viên chủ động học từ thất bại.',
      evidenceRefs: [{ source: 'essay', id: 'U001' }],
      priority: 'high',
    };
    const dimensions = Object.fromEntries(
      ['writing', 'detail', 'voice', 'character', 'curiosity', 'contribution'].map(
        (key) => [key, { score: 6, summary: `Tóm tắt ${key}` }],
      ),
    );
    let calls = 0;
    const provider = vi.fn(async function* () {
      calls += 1;
      if (calls === 1) {
        yield { content: JSON.stringify(coverage), finishReason: 'stop' };
        return;
      }
      yield {
        content: [
          JSON.stringify({ section: 'A', data: { items: [claim] } }),
          JSON.stringify({
            type: 'diagnostics',
            data: {
              dimensions,
              issues: [{
                ...claim,
                id: 'DIAG-1',
                criterion: 'writing',
              }],
            },
          }),
        ].join('\n'),
        finishReason: 'stop',
      };
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });
    const order: string[] = [];

    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      requestedSections: ['A'],
      stream: provider as VinUniTextStream,
    })) {
      if ((event as { type: string }).type === 'evidence_map') order.push('evidence_map');
      if (event.type === 'diagnostics') order.push('diagnostics');
      if (event.type === 'section' && event.section === 'A') order.push('A');
    }

    expect(order).toEqual(['evidence_map', 'diagnostics', 'A']);
  });

  it('completes with grounded fallback sections when every provider response is empty', async () => {
    const provider = vi.fn(async function* () {
      yield { content: '', finishReason: 'stop' };
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });
    const events: VinUniV2StreamEvent[] = [];

    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(events.filter((event) => event.type === 'section').map((event) => event.section))
      .toEqual(['A', 'B', 'C', 'D', 'D', 'D', 'D', 'E', 'F']);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'error' }));
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'complete',
        analysis: expect.objectContaining({ isComplete: true }),
      }),
    );
  });

  it('repairs truncated coverage with a larger budget and the validation reason', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [],
      promptCoverage: [{
        id: 'Q001',
        requirement: 'Describe a meaningful achievement.',
        status: 'answered',
        evidenceIds: ['U001'],
      }],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const sectionA = {
      section: 'A',
      data: {
        items: [{
          id: 'R-A-01',
          text: 'Bài luận cho thấy ứng viên chủ động học hỏi từ thất bại.',
          evidenceRefs: [{ source: 'essay', id: 'U001' }],
          priority: 'high',
        }],
      },
    };
    let calls = 0;
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      calls += 1;
      if (calls === 1) {
        yield { content: '{"claims":[', finishReason: 'length' };
        return;
      }
      if (calls === 2) {
        const repairHasContext =
          request.maxTokens >= 3000 &&
          request.messages[0].content.includes('AI returned no JSON object');
        yield {
          content: repairHasContext ? JSON.stringify(coverage) : '{"claims":[',
          finishReason: repairHasContext ? 'stop' : 'length',
        };
        return;
      }
      yield { content: JSON.stringify(sectionA), finishReason: 'stop' };
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });

    const events: VinUniV2StreamEvent[] = [];
    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      requestedSections: ['A'],
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(events).toContainEqual(expect.objectContaining({ type: 'section', section: 'A' }));
    expect(events).not.toContainEqual(
      expect.objectContaining({ type: 'error', code: 'COVERAGE_MAP_INVALID' }),
    );
  });

  it('evaluates narrative and AACC pillar sections concurrently', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [],
      promptCoverage: [{
        id: 'Q001',
        requirement: 'Describe a meaningful achievement.',
        status: 'answered',
        evidenceIds: ['U001'],
      }],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const claim = (id: string) => ({
      id,
      text: 'Dẫn chứng cho thấy ứng viên chủ động học từ thất bại.',
      evidenceRefs: [{ source: 'essay', id: 'U001' }],
      priority: 'high',
    });
    const sectionA = { section: 'A', data: { items: [claim('R-A-01')] } };
    const sectionD = {
      section: 'D',
      criterion: 'ability',
      data: {
        score: 8,
        analysis: [claim('R-D-01')],
        strengths: [claim('R-D-02')],
        gaps: [claim('R-D-03')],
      },
    };
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      calls += 1;
      if (calls === 1) {
        yield { content: JSON.stringify(coverage), finishReason: 'stop' };
        return;
      }
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const system =
        request.messages[0].content.split('\n').find((line) => line.startsWith('Section cần trả:')) ??
        '';
      const sections = [
        ...(system.includes('A') ? [sectionA] : []),
        ...(system.includes('D:ability') ? [sectionD] : []),
      ];
      const content = sections.map((section) => JSON.stringify(section, null, 2)).join('\n');
      yield { content: content.slice(0, 37) };
      yield { content: content.slice(37), finishReason: 'stop' };
      active -= 1;
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });

    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      requestedSections: ['A', 'D:ability'],
      stream: provider as VinUniTextStream,
    })) {
      void event;
    }

    expect(provider).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(2);
  });

  it('sends schema paths from invalid sections to the targeted repair', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [],
      promptCoverage: [
        {
          id: 'Q001',
          requirement: 'Describe a meaningful achievement.',
          status: 'answered',
          evidenceIds: ['U001'],
        },
      ],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const invalid = {
      section: 'A',
      data: {
        items: [{
          id: 'R-A-01',
          text: 'Nhận xét có evidence ID sai nên phải được repair.',
          evidenceRefs: [{ source: 'essay', id: 'C001' }],
          priority: 'high',
        }],
      },
    };
    const repaired = {
      section: 'A',
      data: {
        items: [{
          id: 'R-A-01',
          text: 'Bài luận cho thấy ứng viên chủ động tổ chức workshop, nhận trách nhiệm khi buổi đầu thất bại và điều chỉnh phương pháp dựa trên phản hồi thực tế.',
          evidenceRefs: [{ source: 'essay', id: 'U001' }],
          priority: 'high',
        }],
      },
    };
    const requests: Parameters<VinUniTextStream>[0][] = [];
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      requests.push(request);
      yield {
        content: JSON.stringify(
          requests.length === 1 ? coverage : requests.length === 2 ? invalid : repaired,
        ),
        finishReason: 'stop',
      };
    });
    const context = buildVinUniEvaluationContext({
      application: { id: 'app-1', courseName: 'Bachelor of Computer Science' },
      course: null,
      profile: null,
    });

    const events: VinUniV2StreamEvent[] = [];
    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      requestedSections: ['A'],
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(JSON.parse(requests[2].messages[1].content)).toMatchObject({
      validation_errors: {
        A: expect.arrayContaining([
          'data.items:too_small',
        ]),
      },
    });
    expect(events).toContainEqual(expect.objectContaining({ type: 'section', section: 'A' }));
  });

  it('maps evidence before evaluating and emits sections in canonical order', async () => {
    const coverage = {
      claims: [{ id: 'C001', text: 'The applicant led a workshop.', evidenceIds: ['U001'] }],
      reflectionArcs: [
        {
          id: 'ARC001',
          evidenceIds: ['U001'],
          completeness: 'partial',
        },
      ],
      promptCoverage: [
        {
          id: 'Q001',
          requirement: 'Describe a meaningful achievement.',
          status: 'answered',
          evidenceIds: ['U001'],
        },
      ],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: [], strength: 'none' },
        creativity: { evidenceIds: ['U001'], strength: 'emerging' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [],
      possiblePromptInjection: false,
    };
    const claim = (id: string, text: string) => ({
      id,
      text,
      evidenceRefs: [{ source: 'essay', id: 'U001' }],
      priority: 'high',
    });
    const sections = [
      { section: 'A', data: { items: [claim('R001', 'Bài luận trả lời đúng trọng tâm bằng một trải nghiệm lãnh đạo cụ thể, cho thấy quá trình học từ thất bại và điều chỉnh hành động có căn cứ.')] } },
      {
        section: 'B',
        data: {
          strengths: [claim('R002', 'Mạch kể đi từ vấn đề đến thất bại rồi cải tiến khá rõ, giúp người đọc theo dõi được nguyên nhân, quyết định và kết quả của ứng viên.')],
          weaknesses: [],
          suggestions: [claim('R003', 'Bổ sung một câu suy ngẫm về thay đổi trong quan niệm lãnh đạo để kết nối trải nghiệm thực tế với định hướng phát triển cá nhân dài hạn.')],
        },
      },
      {
        section: 'C',
        data: {
          analysis: [claim('R004', 'Mở bài cung cấp bối cảnh cụ thể nhưng chưa tạo đủ căng thẳng cảm xúc để khiến người đọc tò mò về lựa chọn tiếp theo của ứng viên.')],
          suggestions: [claim('R005', 'Có thể mở bằng khoảnh khắc buổi học thất bại, sau đó quay lại lý do tổ chức workshop để tăng nhịp kể mà không thêm dữ kiện mới.')],
        },
      },
      ...(['ability', 'aspirations', 'creativity', 'commitment'] as const).map(
        (criterion, index) => ({
          section: 'D',
          criterion,
          data: {
            score: [8, 6, 7, 8][index],
            analysis: [claim(`R01${index}`, 'Dẫn chứng cho thấy ứng viên nhận diện vấn đề, chịu trách nhiệm và điều chỉnh cách triển khai sau thất bại, tạo nền tảng đánh giá tiêu chí tương đối rõ ràng.')],
            strengths: [claim(`R02${index}`, 'Hành động được mô tả theo chuỗi nguyên nhân và kết quả, giúp năng lực của ứng viên có căn cứ thay vì chỉ xuất hiện như một lời tự nhận xét.')],
            gaps: [claim(`R03${index}`, 'Bài luận vẫn cần thêm chi tiết về tác động kéo dài hoặc quyết định cá nhân để làm rõ mức độ nổi bật và bền vững của tiêu chí này.')],
          },
        }),
      ),
      {
        section: 'E',
        data: {
          actions: [
            claim('R050', 'Bổ sung một chi tiết đo lường sau lần cải tiến để chứng minh thay đổi phương pháp tạo ra kết quả rõ ràng và có thể kiểm chứng hơn.'),
            claim('R051', 'Viết thêm một câu suy ngẫm cá nhân để giải thích thất bại đã thay đổi cách bạn lãnh đạo và thiết kế môi trường học tập như thế nào.'),
            claim('R052', 'Kết nối trải nghiệm workshop với mục tiêu học tập cụ thể tại VinUniversity mà không biến programme context thành bằng chứng về năng lực cá nhân.'),
          ],
          questions: [
            claim('R053', 'Sau workshop, bạn có tiếp tục duy trì hoạt động hoặc áp dụng cách tổ chức mới trong một bối cảnh khác nữa hay không?'),
            claim('R054', 'Bạn dự định theo đuổi lĩnh vực chuyên môn nào và trải nghiệm này đã tác động đến lựa chọn đó cụ thể ra sao?'),
            claim('R055', 'Có chỉ số, phản hồi hoặc kết quả dài hạn nào giúp kiểm chứng tác động của workshop đối với người tham gia nữa không?'),
          ],
        },
      },
    ];
    const requests: Parameters<VinUniTextStream>[0][] = [];
    const provider = vi.fn(async function* (request: Parameters<VinUniTextStream>[0]) {
      requests.push(request);
      yield {
        content:
          requests.length === 1
            ? JSON.stringify(coverage)
            : `${sections.map((section) => JSON.stringify(section)).join('\n')}\n`,
        finishReason: 'stop',
      };
    });
    const context = buildVinUniEvaluationContext({
      application: {
        id: 'app-1',
        universityName: 'VinUniversity',
        courseName: 'Bachelor of Computer Science',
      },
      course: null,
      profile: null,
    });

    const events: VinUniV2StreamEvent[] = [];
    for await (const event of streamVinUniEvaluationV2({
      essay,
      essayPrompt: 'Describe a meaningful achievement and what you learned from it.',
      context,
      config: VINUNI_EVALUATION_CONFIG_V2,
      apiKey: 'key',
      model: 'gpt-4o',
      stream: provider as VinUniTextStream,
    })) {
      events.push(event);
    }

    expect(provider).toHaveBeenCalledTimes(3);
    expect(requests[0].messages[0].content).toContain(
      '"claims":[{"id":"C001","text":"...","evidenceIds":["U001"]}]',
    );
    expect(requests[1].messages[0].content).toContain(
      'Mỗi criterion D có tổng cộng 4-6 nhận xét',
    );
    expect(requests[1].messages[0].content).toContain(
      'Mỗi text đúng một câu',
    );
    expect(events.filter((event) => event.type === 'status').map((event) => event.stage)).toEqual([
      'preparing_context',
      'mapping_evidence',
      'evaluating',
    ]);
    expect(
      events.filter((event) => event.type === 'section').map((event) =>
        event.section === 'D' ? `D:${event.criterion}` : event.section,
      ),
    ).toEqual([
      'A',
      'B',
      'C',
      'D:ability',
      'D:aspirations',
      'D:creativity',
      'D:commitment',
      'E',
      'F',
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'complete',
      versions: {
        schema: VINUNI_EVALUATION_CONFIG_V2.schemaVersion,
        rubric: VINUNI_EVALUATION_CONFIG_V2.rubricVersion,
        prompt: VINUNI_EVALUATION_CONFIG_V2.promptVersion,
      },
      analysis: {
        context: { profileStatus: 'not_available', programmeConfidence: 'high' },
      },
    });
  });
});
