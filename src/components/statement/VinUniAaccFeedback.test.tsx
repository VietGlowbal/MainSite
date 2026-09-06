import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AaccAnalysis } from '@/lib/ai/vinuni-grounded-evaluation';
import type {
  AaccAnalysisV2,
  StructureCriterionAssessment,
  StructureFlowMap,
  StructureFlowReview,
} from '@/lib/ai/vinuni-evaluation-v2';
import {
  calculateImprovementProjection,
  reviewClaimKey,
  VinUniAaccFeedback,
} from './VinUniAaccFeedback';
import { VinUniStructureFlowFeedback } from './VinUniStructureFlowFeedback';

const locale = vi.hoisted(() => ({ lang: 'vi' as 'en' | 'vi' }));
vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual<typeof import('@/lib/i18n')>('@/lib/i18n');
  const { translations } = await vi.importActual<typeof import('@/lib/i18n-dictionary')>('@/lib/i18n-dictionary');
  const interpolate = (value: string, vars?: Record<string, string | number>) =>
    vars ? value.replace(/\{(\w+)\}/g, (_, key) => key in vars ? String(vars[key]) : `{${key}}`) : value;
  const translate = (key: string, vars?: Record<string, string | number>) => interpolate(
    locale.lang === 'vi' ? translations[key] ?? key : key,
    vars,
  );
  return {
    ...actual,
    useLanguage: () => ({
      lang: locale.lang,
      setLang: (next: 'en' | 'vi') => { locale.lang = next; },
      toggle: () => { locale.lang = locale.lang === 'en' ? 'vi' : 'en'; },
      t: translate,
    }),
    useT: () => translate,
  };
});

const pillar = {
  score: 70,
  analysis: ['Phân tích có căn cứ.'],
  strengths: ['Điểm mạnh có căn cứ.'],
  gaps: ['Điểm yếu có căn cứ.'],
  evidenceQuotes: ['I led a robotics team.'],
};

const analysis: AaccAnalysis = {
  overall: {
    score: 65,
    verdict: 'needs-work',
    summary: 'Bài luận có trải nghiệm cụ thể nhưng cần đào sâu suy ngẫm cá nhân.',
  },
  pillars: {
    ability: pillar,
    aspirations: pillar,
    creativity: pillar,
    commitment: pillar,
  },
  topRecommendations: [],
  sections: {
    overallSummary: ['Bài luận có trải nghiệm cụ thể.'],
    ideasStructure: {
      strengths: ['Mạch kể rõ ràng.'],
      weaknesses: [
        {
          category: 'personal_reflection',
          title: 'Suy ngẫm cá nhân',
          items: ['Phần bài học còn ngắn.'],
        },
      ],
      suggestions: ['Giải thích trải nghiệm đã thay đổi bạn như thế nào.'],
    },
    hookEngagement: {
      analysis: ['Mở bài đi thẳng vào sự kiện.'],
      suggestions: ['[CẦN USER BỔ SUNG: lời thoại thật khi dự án bắt đầu]'],
    },
    nextSteps: ['Bổ sung suy ngẫm sau thất bại.'],
  },
};

const structureMap: StructureFlowMap = {
  corePurpose: 'Show learning through a failed workshop.',
  narrativeUnits: [
    { id: 'N001', type: 'experience', label: 'Workshop', summary: 'The applicant led a workshop.', evidenceIds: ['U001'], order: 0 },
    { id: 'N002', type: 'decision', label: 'Adjustment', summary: 'The applicant simplified the design.', evidenceIds: ['U002'], order: 1 },
  ],
  links: [{ fromUnitId: 'N001', toUnitId: 'N002', relationship: 'causal', evidenceIds: ['U002'] }],
  turningPointUnitIds: ['N002'],
  endingEvidenceIds: ['U002'],
  possibleMultipleThreads: false,
  threadNotes: [],
  unresolvedStructureQuestions: [],
};

const structureReview: StructureFlowReview = (() => {
  const claim = (id: string, text: string): NonNullable<StructureCriterionAssessment['strength']> => ({
    id,
    text,
    evidenceRefs: [{ source: 'essay', id: 'U001' }],
    priority: 'medium',
  });
  const criterion = (key: StructureCriterionAssessment['key'], label: string): StructureCriterionAssessment => ({
    key,
    label,
    strength: claim(`${key}-s`, `${label} strength.`),
    weakness: claim(`${key}-w`, `${label} weakness.`),
    whyItMatters: claim(`${key}-why`, `${label} matters.`),
    improvement: claim(`${key}-i`, `${label} improvement.`),
    severity: 'minor_gap',
    evidenceRefs: [{ source: 'essay', id: 'U001' }],
  });
  const dimension = {
    status: 'partial_evolution' as const,
    summary: 'A partial evolution is visible.',
    evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
    missingStep: null,
  };
  const node = {
    status: 'partial' as const,
    text: 'A partial ending link.',
    evidenceRefs: [{ source: 'essay' as const, id: 'U002' as const }],
  };
  return {
    narrativeOverview: {
      corePurpose: structureMap.corePurpose,
      architectureSummary: 'The draft moves from experience to an explicit adjustment.',
      unitIds: ['N001', 'N002'],
      turningPointUnitIds: ['N002'],
    },
    criteria: {
      narrativeArchitecture: criterion('narrative_architecture', 'Narrative Architecture'),
      causalProgression: criterion('causal_progression', 'Causal Progression'),
      developmentEvolution: criterion('development_evolution', 'Development & Evolution'),
      transitionsContinuity: criterion('transitions_continuity', 'Transitions & Continuity'),
      narrativeDepth: criterion('narrative_depth', 'Narrative Depth & Development'),
      focusBalance: criterion('focus_balance', 'Focus & Narrative Balance'),
      endingForwardProgression: criterion('ending_forward_progression', 'Ending & Forward Progression'),
    },
    transitions: [{
      id: 'TR001',
      fromUnitId: 'N001',
      toUnitId: 'N002',
      logical: 'clear',
      causal: 'partial',
      thematic: 'partial',
      personal: 'missing',
      diagnosis: 'The decision follows the failed first attempt.',
      evidenceRefs: [{ source: 'essay', id: 'U002' }],
      missingBridge: 'Explain the personal significance of the adjustment.',
      improvement: 'Add the reasoning behind the decision.',
    }],
    evolution: { responsibility: dimension, problemComplexity: dimension, thinking: dimension, approach: dimension, identity: dimension },
    importantMoments: [{
      id: 'M001', unitId: 'N002', title: 'The redesign', whyImportant: 'It changes the direction of the story.',
      levels: { description: 'clear', reasoning: 'partial', tension: 'partial', reflection: 'missing', transformation: 'missing' },
      strongestLevel: 'description', missingLevels: ['reflection'], evidenceRefs: [{ source: 'essay', id: 'U002' }], improvement: 'Explain what changed in the applicant.',
    }],
    balanceAnalysis: {
      units: [
        { unitId: 'N001', function: 'Context', wordCount: 7, share: 50, narrativePurpose: 'Establish the experience.', imbalance: 'none' },
        { unitId: 'N002', function: 'Change', wordCount: 7, share: 50, narrativePurpose: 'Show the adjustment.', imbalance: 'none' },
      ],
      strength: claim('balance-s', 'The change receives useful space.'), weakness: null, whyItMatters: null, improvement: null,
    },
    endingProgression: {
      pastEvidence: node, keyLearning: node, currentDirection: node, capabilityGap: node, nextStep: node, longTermAspiration: node,
      continuity: 'partial', missingLinks: ['Connect learning to the next step.'], strength: null, weakness: null, whyItMatters: null, improvement: null,
    },
    priorities: [1, 2, 3].map((rank) => ({
      rank, title: `Priority ${rank}`, whatToImprove: 'Clarify one bridge.', whyItMatters: 'The reader can follow change.', specificDirection: 'Name the reasoning.', exampleOrTemplate: null, evidenceRefs: [{ source: 'essay' as const, id: 'U002' as const }],
    })),
  };
})();

describe('VinUniAaccFeedback', () => {
  afterEach(() => {
    vi.useRealTimers();
    locale.lang = 'vi';
  });

  it('uses the same action gains for the roadmap and final projected score', () => {
    expect(
      calculateImprovementProjection(7.7, [
        { priority: 'high' },
        { priority: 'high' },
        { priority: 'medium' },
      ]),
    ).toEqual({ current: 7.7, gain: 1.3, potential: 9 });
  });

  it('renders the complete Vietnamese A-F review and allows another analysis', async () => {
    const onTryAgain = vi.fn();
    render(<VinUniAaccFeedback analysis={analysis} onTryAgain={onTryAgain} />);

    for (const heading of [
      'A. Tổng quan',
      'B. Ý tưởng và cấu trúc',
      'C. Mở bài và sức hút',
      'D. Đánh giá AACC',
      'E. Bước tiếp theo',
      'F. Điểm AACC',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText('[CẦN USER BỔ SUNG: lời thoại thật khi dự án bắt đầu]')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa và phân tích lại' }));
    expect(onTryAgain).toHaveBeenCalledOnce();
  });

  it('keeps static chrome in English while preserving analysis payloads', () => {
    locale.lang = 'en';
    render(<VinUniAaccFeedback analysis={analysis} onTryAgain={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'B. Ideas and structure' })).toBeVisible();
    expect(screen.getAllByText('Phân tích có căn cứ.').length).toBeGreaterThan(0);
  });

  it('does not render an empty improvement card', () => {
    const withoutSuggestions = structuredClone(analysis);
    withoutSuggestions.sections!.ideasStructure.suggestions = [];

    render(<VinUniAaccFeedback analysis={withoutSuggestions} onTryAgain={vi.fn()} />);

    expect(screen.queryByRole('heading', { name: /Gợi ý cải thiện/i })).not.toBeInTheDocument();
    const strengthsCard = screen.getByRole('heading', { name: /Điểm mạnh/i }).parentElement;
    expect(strengthsCard?.parentElement).not.toHaveClass('lg:grid-cols-2');
  });

  it('uses a light surface theme without black background blocks', () => {
    const { container } = render(
      <VinUniAaccFeedback analysis={analysis} onTryAgain={vi.fn()} />,
    );

    expect(container.querySelectorAll('[class*="bg-slate-950"]')).toHaveLength(0);
    expect(container.querySelector('header')).toHaveClass('text-slate-950');
    expect(screen.getByLabelText('Điểm AACC tổng')).toHaveClass('bg-rose-50/70');
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  });

  it('uses an editorial diagnostic hierarchy without emoji interface chrome', () => {
    const { container } = render(
      <VinUniAaccFeedback analysis={analysis} onTryAgain={vi.fn()} />,
    );

    expect(
      container.querySelector('[data-visual-style="editorial-diagnostic"]'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Tóm tắt chẩn đoán')).toHaveAttribute(
      'data-layout',
      'editorial-rail',
    );
    expect(screen.getAllByTestId('status-icon').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('region', { name: 'Phần A: Tổng quan' })).toBeVisible();
    expect(screen.getAllByRole('row')[0]).toHaveClass('sm:grid-cols-2');
    expect(screen.getAllByRole('row')[0]).not.toHaveClass('grid-cols-2');
    expect(container.textContent).not.toMatch(/[💡⚠◐]/u);
  });

  it('renders only arrived sections and hides bullet chrome until typing starts', async () => {
    vi.useFakeTimers();
    const partial = structuredClone(analysis);
    partial.overall.score = 0;
    partial.sections!.ideasStructure = { strengths: [], weaknesses: [], suggestions: [] };
    partial.sections!.hookEngagement = { analysis: [], suggestions: [] };
    partial.sections!.nextSteps = [];
    for (const key of ['ability', 'aspirations', 'creativity', 'commitment'] as const) {
      partial.pillars[key] = {
        score: 0,
        analysis: [],
        strengths: [],
        gaps: [],
        evidenceQuotes: [],
      };
    }

    const { container } = render(
      <VinUniAaccFeedback analysis={partial} onTryAgain={vi.fn()} streaming loading />,
    );

    for (const heading of [/^A\./, /^B\./, /^C\./, /^D\./, /^E\./, /^F\./]) {
      expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);

    const firstBullet = container.querySelector('ul li');
    expect(firstBullet).not.toBeVisible();
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(6);
    });
    expect(screen.getByRole('heading', { name: 'A. Tổng quan' })).toBeVisible();
    expect(firstBullet).toBeVisible();
  });

  it('removes empty loading skeletons after completion while typing continues', () => {
    const completed = structuredClone(analysis);
    completed.pillars.ability.strengths = [];
    completed.pillars.ability.gaps = [];

    render(
      <VinUniAaccFeedback
        analysis={completed}
        onTryAgain={vi.fn()}
        streaming
        loading={false}
      />,
    );

    expect(screen.queryAllByTestId('feedback-skeleton')).toHaveLength(0);
    expect(screen.getAllByTestId('typing-text').length).toBeGreaterThan(0);
  });

  it('types arrived feedback items concurrently', async () => {
    vi.useFakeTimers();
    const sequential = structuredClone(analysis);
    sequential.sections!.overallSummary = ['First feedback item.', 'Second feedback item.'];
    render(<VinUniAaccFeedback analysis={sequential} onTryAgain={vi.fn()} streaming />);

    const [firstItem, secondItem] = screen.getAllByTestId('typing-text');
    const firstText = sequential.sections!.overallSummary[0];
    expect(firstItem).toBeEmptyDOMElement();
    expect(secondItem).toBeEmptyDOMElement();
    expect(
      screen.queryByRole('heading', { name: 'B. Ý tưởng & cấu trúc' }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(12);
    });
    expect(firstItem.textContent?.length).toBeGreaterThan(0);
    expect(firstItem.textContent).not.toBe(firstText);
    expect(secondItem.textContent?.length).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(firstText.length * 6);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(6);
    });
    expect(firstItem).toHaveTextContent(firstText);
    expect(secondItem.textContent?.length).toBeGreaterThan(0);
  });

  it('renders the manuscript with one current-versus-achievable radar and hover definitions', async () => {
    const v2 = structuredClone(analysis) as AaccAnalysisV2;
    v2.diagnostics = {
      dimensions: {
        writing: { score: 6, summary: 'Câu văn rõ nhưng còn lặp.' },
        detail: { score: 6, summary: 'Thiếu chi tiết cảm giác.' },
        voice: { score: 4, summary: 'Giọng cá nhân chưa rõ.' },
        character: { score: 9, summary: 'Thể hiện trách nhiệm.' },
        curiosity: { score: 7, summary: 'Có tinh thần tò mò.' },
        contribution: { score: 6, summary: 'Có kết quả cụ thể.' },
      },
      issues: [
        {
          id: 'DIAG-1',
          criterion: 'detail',
          text: 'Cho thấy phản ứng cụ thể của học sinh trong buổi đầu.',
          evidenceRefs: [{ source: 'essay', id: 'U001' }],
          priority: 'high',
        },
      ],
      achievability: {
        currentScore: 6.3,
        potentialScore: 6.4,
        dimensions: {
          writing: { current: 6, potential: 6 },
          detail: { current: 6, potential: 6.5 },
          voice: { current: 4, potential: 4 },
          character: { current: 9, potential: 9 },
          curiosity: { current: 7, potential: 7 },
          contribution: { current: 6, potential: 6 },
        },
      },
    };

    render(
      <VinUniAaccFeedback
        analysis={v2}
        manuscript={<p>I led a robotics workshop.</p>}
        onTryAgain={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Chẩn đoán bài luận' })).toHaveAttribute(
      'data-visual-style',
      'editorial-diagnostic',
    );
    expect(screen.getByRole('heading', { name: 'Bài luận đã chấm' })).toBeVisible();
    expect(screen.getByTestId('diagnostic-radar')).toBeVisible();
    expect(screen.getByTestId('diagnostic-radar-current')).toBeVisible();
    expect(screen.getByTestId('diagnostic-radar-potential')).toBeVisible();
    expect(
      screen.getByTestId('diagnostic-radar').parentElement?.parentElement,
    ).toHaveClass(
      'lg:col-start-2',
      'lg:row-start-1',
    );
    expect(screen.getByText('I led a robotics workshop.').closest('article')).toHaveClass(
      'lg:col-start-1',
      'lg:row-start-1',
    );
    expect(
      Boolean(
        screen.getByTestId('diagnostic-radar').compareDocumentPosition(
          screen.getByText('I led a robotics workshop.'),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    for (const label of ['Bài viết', 'Chi tiết', 'Giọng văn', 'Số ký tự', 'Tò mò', 'Đóng góp']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeVisible();
    }
    await userEvent.hover(screen.getByRole('button', { name: /Bài viết/ }));
    expect(screen.getByText(/độ rõ ràng, nhịp câu và cấu trúc/i)).toBeVisible();
    expect(screen.getAllByText('6.3')[0]).toBeVisible();
    expect(screen.getAllByText('6.4')[0]).toBeVisible();
    const diagnosticIssue = screen.getByRole('button', {
      name: 'Cho thấy phản ứng cụ thể của học sinh trong buổi đầu.',
    });
    expect(diagnosticIssue).toBeVisible();
    expect(within(diagnosticIssue).getByText('Ưu tiên cao')).toBeVisible();
    expect(within(diagnosticIssue).queryByText('+0.5')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /A\./ })).toBeVisible();
  });

  it('hides the narrative chart until creativity and aspirations scores arrive', () => {
    const partial = structuredClone(analysis) as AaccAnalysisV2;
    for (const key of ['creativity', 'aspirations'] as const) {
      partial.pillars[key] = {
        score: 0,
        analysis: [],
        strengths: [],
        gaps: [],
        evidenceQuotes: [],
      };
    }
    partial.diagnostics = {
      dimensions: {
        writing: { score: 6, summary: '' },
        detail: { score: 6, summary: '' },
        voice: { score: 6, summary: '' },
        character: { score: 6, summary: '' },
        curiosity: { score: 6, summary: '' },
        contribution: { score: 6, summary: '' },
      },
      issues: [],
      achievability: {
        currentScore: 6,
        potentialScore: 7,
        dimensions: {
          writing: { current: 6, potential: 7 },
          detail: { current: 6, potential: 7 },
          voice: { current: 6, potential: 7 },
          character: { current: 6, potential: 7 },
          curiosity: { current: 6, potential: 7 },
          contribution: { current: 6, potential: 7 },
        },
      },
    };

    render(<VinUniAaccFeedback analysis={partial} onTryAgain={vi.fn()} loading />);

    expect(screen.queryByTestId('narrative-plot')).not.toBeInTheDocument();
  });

  it('turns the A-F report into evidence, comparison, score and action visuals', () => {
    const v2 = structuredClone(analysis) as AaccAnalysisV2;
    const strength = {
      id: 'VIS-1',
      text: 'Mạch kể vấn đề đến bài học rõ ràng.',
      evidenceRefs: [{ source: 'essay' as const, id: 'U001' as const }],
      priority: 'medium' as const,
    };
    const gap = {
      id: 'VIS-2',
      text: 'Thiếu mục tiêu tương lai cụ thể.',
      evidenceRefs: [{ source: 'essay' as const, id: 'U002' as const }],
      priority: 'high' as const,
    };
    v2.isComplete = true;
    v2.context = {
      profileStatus: 'not_available',
      programmeConfidence: 'high',
      programmeName: 'Bachelor of Computer Science',
    };
    v2.evidenceMap = {
      essaySegments: [
        { evidence_id: 'U001', text: 'I led a robotics team.' },
        { evidence_id: 'U002', text: 'I want to study computing.' },
      ],
      claims: [{ id: 'C001', text: 'Leadership', evidenceIds: ['U001'] }],
      reflectionArcs: [
        { id: 'R001', evidenceIds: ['U001'], completeness: 'complete' },
      ],
      promptCoverage: [
        {
          id: 'Q001',
          requirement: 'Describe an achievement',
          status: 'answered',
          evidenceIds: ['U001'],
        },
        {
          id: 'Q002',
          requirement: 'Explain future goals',
          status: 'partial',
          evidenceIds: ['U002'],
        },
      ],
      aaccCoverage: {
        ability: { evidenceIds: ['U001'], strength: 'clear' },
        aspirations: { evidenceIds: ['U002'], strength: 'emerging' },
        creativity: { evidenceIds: [], strength: 'none' },
        commitment: { evidenceIds: ['U001'], strength: 'clear' },
      },
      informationGaps: [{ id: 'G001', text: gap.text, evidenceIds: ['U002'] }],
      possiblePromptInjection: false,
    };
    v2.review = {
      overall: [strength, gap],
      ideasStructure: {
        strengths: [strength],
        weaknesses: [{ category: 'future', title: 'Tương lai', items: [gap] }],
        suggestions: [gap],
      },
      hookEngagement: { analysis: [strength], suggestions: [gap] },
      pillars: {
        ability: { score: 7, analysis: [strength], strengths: [strength], gaps: [gap] },
        aspirations: { score: 7, analysis: [strength], strengths: [strength], gaps: [gap] },
        creativity: { score: 7, analysis: [strength], strengths: [strength], gaps: [gap] },
        commitment: { score: 7, analysis: [strength], strengths: [strength], gaps: [gap] },
      },
      nextSteps: { actions: [gap], questions: [] },
    };
    v2.diagnostics = {
      dimensions: {
        writing: { score: 7, summary: 'Mạch kể rõ.' },
        detail: { score: 6, summary: 'Cần thêm chi tiết.' },
        voice: { score: 7, summary: 'Giọng văn khá rõ.' },
        character: { score: 8, summary: 'Phẩm chất tốt.' },
        curiosity: { score: 7, summary: 'Có tò mò.' },
        contribution: { score: 7, summary: 'Có đóng góp.' },
      },
      issues: [{ ...gap, criterion: 'detail' }],
      achievability: {
        currentScore: 7,
        potentialScore: 7.5,
        dimensions: {
          writing: { current: 7, potential: 7.2 },
          detail: { current: 6, potential: 6.5 },
          voice: { current: 7, potential: 7 },
          character: { current: 8, potential: 8 },
          curiosity: { current: 7, potential: 7 },
          contribution: { current: 7, potential: 7 },
        },
      },
    };

    render(<VinUniAaccFeedback analysis={v2} onTryAgain={vi.fn()} />);

    expect(screen.queryByTestId('narrative-plot')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bản đồ độ phủ dẫn chứng' })).toBeVisible();
    expect(screen.getByRole('table', { name: 'Đã có và cần bổ sung' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Tín hiệu Writing, Detail và Voice' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Điểm AACC và mức có thể đạt' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Lộ trình ưu tiên' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Cầu điểm cải thiện' })).toBeVisible();
    expect(screen.queryByRole('img', { name: 'Tín hiệu Tổng quan' })).not.toBeInTheDocument();
  });

  it('renders the actual structure map and all seven Section B criteria', () => {
    render(
      <VinUniStructureFlowFeedback
        review={structureReview}
        map={structureMap}
      />,
    );

    expect(screen.getByTestId('structure-flow-feedback')).toBeVisible();
    expect(screen.getAllByTestId('narrative-map')).toHaveLength(1);
    expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0);
    for (const label of [
      'Narrative Architecture',
      'Causal Progression',
      'Development & Evolution',
      'Transitions & Continuity',
      'Narrative Depth & Development',
      'Focus & Narrative Balance',
      'Ending & Forward Progression',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const label of ['Logical:', 'Causal:', 'Thematic:', 'Cá nhân:', 'Past evidence', 'Long-term aspiration']) {
      expect(screen.getAllByText(new RegExp(label.replace(':', ':?'))).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Priority 1')).toBeVisible();
    expect(screen.queryByTestId('narrative-plot')).not.toBeInTheDocument();
  });

  it('keeps evidence metadata clickable and shows every priority without a disclosure toggle', async () => {
    const onEvidenceSelect = vi.fn();
    const v2 = structuredClone(analysis) as AaccAnalysisV2;
    v2.review = {
      overall: [
        {
          id: 'R001',
          text: 'Nhận xét ưu tiên cao có dẫn chứng trực tiếp từ bài luận của ứng viên.',
          evidenceRefs: [{ source: 'essay', id: 'U001' }],
          priority: 'high',
        },
        {
          id: 'R002',
          text: 'Chi tiết ưu tiên thấp chỉ nên xuất hiện khi người dùng mở phần phân tích đầy đủ.',
          evidenceRefs: [{ source: 'programme', id: 'T001' }, { source: 'essay', id: 'U001' }],
          priority: 'low',
        },
      ],
      ideasStructure: { strengths: [], weaknesses: [], suggestions: [] },
      hookEngagement: { analysis: [], suggestions: [] },
      pillars: {
        ability: { score: 7, analysis: [], strengths: [], gaps: [] },
        aspirations: { score: 7, analysis: [], strengths: [], gaps: [] },
        creativity: { score: 7, analysis: [], strengths: [], gaps: [] },
        commitment: { score: 7, analysis: [], strengths: [], gaps: [] },
      },
      nextSteps: {
        actions: [],
        questions: [
          {
            id: 'R003',
            text: 'Bạn có số liệu dài hạn nào giúp kiểm chứng tác động của hoạt động này không?',
            evidenceRefs: [{ source: 'essay', id: 'U001' }],
            priority: 'high',
          },
        ],
      },
    };

    render(
      <VinUniAaccFeedback
        analysis={v2}
        onTryAgain={vi.fn()}
        onEvidenceSelect={onEvidenceSelect}
        activeClaimKeys={[reviewClaimKey(v2.review.overall[0])]}
      />,
    );

    const high = screen.getByRole('button', {
      name: 'Nhận xét ưu tiên cao có dẫn chứng trực tiếp từ bài luận của ứng viên.',
    });
    expect(high).toHaveAttribute('data-active', 'true');
    expect(screen.getByText(v2.review.overall[1].text)).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: /^(xem phân tích đầy đủ|thu gọn phân tích)$/i,
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(high);
    expect(onEvidenceSelect).toHaveBeenCalledWith(v2.review.overall[0]);

    expect(screen.getByRole('heading', { name: 'Câu hỏi cần bổ sung' })).toBeVisible();
  });
});
