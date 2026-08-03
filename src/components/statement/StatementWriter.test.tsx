import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVinUniInputHash,
  VINUNI_DEFAULT_ESSAY_PROMPT,
  VINUNI_DEMO_APPLICATION_ID,
} from '@/lib/ai/vinuni-evaluation-shared';
import { finalizeLorReview } from '@/lib/ai/lor';
import type { AaccAnalysisV2 } from '@/lib/ai/vinuni-evaluation-v2';
import { StatementWriter } from './StatementWriter';

const mocks = vi.hoisted(() => {
  const single = vi.fn().mockResolvedValue({ data: { id: 1 } });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return {
    insert,
    supabase: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn(() => ({
        insert,
        update: vi.fn(() => ({ eq: vi.fn() })),
      })),
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mocks.supabase,
}));

const pillar = {
  score: 70,
  analysis: ['Evidence-based analysis.'],
  strengths: ['A grounded strength.'],
  gaps: ['A grounded gap.'],
  evidenceQuotes: ['I led a robotics team.'],
};

const vinUniAnalysis = {
  score: 65,
  summary: 'Legacy-compatible summary.',
  suggestions: [],
  checklist: [],
  overall: { score: 65, verdict: 'needs-work', summary: 'Grounded summary.' },
  pillars: {
    ability: pillar,
    aspirations: pillar,
    creativity: pillar,
    commitment: pillar,
  },
  topRecommendations: [],
  sections: {
    overallSummary: ['Grounded summary.'],
    ideasStructure: { strengths: [], weaknesses: [], suggestions: [] },
    hookEngagement: { analysis: [], suggestions: [] },
    nextSteps: ['Add more reflection.'],
  },
  isComplete: true,
  context: {
    profileStatus: 'not_available',
    programmeConfidence: 'high',
    programmeName: 'Bachelor of Computer Science',
  },
  evidenceMap: {
    essaySegments: [{ evidence_id: 'U001', text: 'I led a robotics team.' }],
    claims: [],
    reflectionArcs: [],
    promptCoverage: [],
    aaccCoverage: {
      ability: { evidenceIds: ['U001'], strength: 'clear' },
      aspirations: { evidenceIds: [], strength: 'none' },
      creativity: { evidenceIds: [], strength: 'none' },
      commitment: { evidenceIds: [], strength: 'none' },
    },
    informationGaps: [],
    possiblePromptInjection: false,
  },
  review: {
    overall: [],
    ideasStructure: { strengths: [], weaknesses: [], suggestions: [] },
    hookEngagement: { analysis: [], suggestions: [] },
    pillars: {
      ability: { score: 7, analysis: [], strengths: [], gaps: [] },
      aspirations: { score: 7, analysis: [], strengths: [], gaps: [] },
      creativity: { score: 7, analysis: [], strengths: [], gaps: [] },
      commitment: { score: 7, analysis: [], strengths: [], gaps: [] },
    },
    nextSteps: { actions: [], questions: [] },
  },
};

const vinUniDiagnostics: NonNullable<AaccAnalysisV2['diagnostics']> = {
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

function renderVinUniWriter() {
  return render(
    <StatementWriter
      saveTarget={{ kind: 'application', applicationId: 'app-1' }}
      targetName="Business Administration · VinUniversity"
      initialContent=""
      initialAnalysis={null}
      statementId={null}
      embedded
    />,
  );
}

function renderExplicitVinUniWriter() {
  const props = {
    saveTarget: { kind: 'application', applicationId: 'app-1' },
    targetName: 'Business Administration · University of Birmingham',
    initialContent: '',
    initialAnalysis: null,
    statementId: null,
    embedded: true,
    evaluationMode: 'vinuni',
  } as unknown as ComponentProps<typeof StatementWriter>;
  return render(<StatementWriter {...props} />);
}

function renderWorkspaceWriter() {
  const props = {
    saveTarget: { kind: 'application', applicationId: 'app-1' },
    targetName: 'Business Administration · VinUniversity',
    initialContent: '',
    initialAnalysis: null,
    statementId: null,
    embedded: true,
    evaluationMode: 'vinuni',
    workspace: true,
  } as unknown as ComponentProps<typeof StatementWriter>;
  return render(<StatementWriter {...props} />);
}

function renderDemoWriter() {
  return render(
    <StatementWriter
      saveTarget={{ kind: 'demo' }}
      targetName="Bachelor of Computer Science · VinUniversity"
      initialContent=""
      initialAnalysis={null}
      statementId={null}
      embedded
      workspace
      evaluationMode="vinuni"
    />,
  );
}

function renderLorWriter(initialAnalysis: unknown = null, onAnalysisStart?: () => void) {
  const props = {
    saveTarget: { kind: 'application', applicationId: 'app-1' },
    targetName: 'Computer Science Â· Cambridge',
    initialContent: '',
    initialAnalysis,
    statementId: null,
    initialDocType: 'recommendation_letter',
    reviewType: 'lor',
    embedded: true,
    workspace: true,
    onAnalysisStart,
  } as unknown as ComponentProps<typeof StatementWriter>;
  return render(<StatementWriter {...props} />);
}

const lorReview = finalizeLorReview({
  summary: 'A credible letter with strong programme-relevant evidence.',
  dimensions: [
    { id: 'recommender_context', score: 5, rationale: 'The relationship is clear.' },
    { id: 'specific_evidence', score: 9, rationale: 'The letter uses a concrete project.' },
    { id: 'quality_depth', score: 8, rationale: 'Claims are explained.' },
    { id: 'recommender_voice', score: 8, rationale: 'The perspective feels personal.' },
    { id: 'evidence_credibility', score: 8, rationale: 'Claims fit the relationship.' },
    { id: 'applicant_differentiation', score: 8, rationale: 'Peer context is present.' },
    { id: 'growth_potential', score: 10, rationale: 'Growth is demonstrated.' },
    { id: 'complementarity', score: 10, rationale: 'The letter adds new insight.' },
    { id: 'recommendation_strength', score: 5, rationale: 'The endorsement is direct.' },
  ],
  whatWorksWell: [
    { title: 'Clear recommender relationship', explanation: 'Authority is established.' },
  ],
  improvements: [
    {
      title: 'Limited comparative context',
      explanation: 'The peer comparison could be clearer.',
      suggestion: 'Add an accurate comparison if the recommender supports it.',
    },
  ],
  profileCoverage: [
    {
      trait: 'Analytical thinking',
      status: 'strongly_supported',
      explanation: 'Supported by the research example.',
    },
  ],
  suggestions: [],
}, '');

function streamingResponse() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' },
    }),
    send(event: unknown) {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    },
    close() {
      controller.close();
    },
  };
}

describe('StatementWriter VinUni routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['generic', false],
    ['VinUni', true],
  ])('uses the approved two-card essay-review theme in %s mode', (_, vinUni) => {
    render(
      <StatementWriter
        saveTarget={{ kind: 'application', applicationId: 'app-1' }}
        targetName={vinUni ? 'Business Administration · VinUniversity' : 'Computer Science · Cambridge'}
        initialContent=""
        initialAnalysis={null}
        statementId={null}
        embedded
        workspace
        evaluationMode={vinUni ? 'vinuni' : 'generic'}
      />,
    );

    const essayCard = screen.getByLabelText('Nội dung bài luận').closest('section');
    const feedbackCard = screen
      .getByText('Your feedback will appear here once you submit your essay')
      .closest('section');

    expect(essayCard?.parentElement).toHaveClass('w-full', 'min-w-0', 'gap-10', 'bg-[#FAFAFA]');
    expect(essayCard).toHaveClass('min-w-0', 'rounded-2xl', 'border-neutral-300', 'bg-white');
    expect(feedbackCard).toHaveClass('min-w-0', 'rounded-2xl', 'border-neutral-300', 'bg-white');
    expect(screen.getByRole('button', { name: 'Analyze' })).toHaveClass('bg-rose-600');
  });

  it('does not show the programme context note in the empty essay feedback state', () => {
    render(
      <StatementWriter
        saveTarget={{ kind: 'demo' }}
        targetName="Bachelor of Computer Science · VinUniversity"
        contextNote="VinUniversity AACC · Demo essay-only · Profile chưa có"
        initialContent=""
        initialAnalysis={null}
        statementId={null}
        embedded
        workspace
        evaluationMode="vinuni"
      />,
    );

    expect(screen.queryByText('VinUniversity AACC · Demo essay-only · Profile chưa có')).not.toBeInTheDocument();
  });

  it('configures the shared editor for a recommendation letter', () => {
    renderLorWriter();

    expect(screen.getByText('Letter of Recommendation')).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Letter of recommendation draft')).toHaveAttribute(
      'placeholder',
      expect.stringContaining('recommendation letter'),
    );
    expect(screen.getByText('Your feedback will appear here once you submit your letter')).toBeVisible();
  });

  it('uses the updated two-card essay-review layout for LOR', () => {
    renderLorWriter();

    const letterCard = screen.getByLabelText('Letter of recommendation draft').closest('section');
    const feedbackCard = screen
      .getByText('Your feedback will appear here once you submit your letter')
      .closest('section');

    expect(letterCard?.parentElement).toHaveClass('w-full', 'min-w-0', 'gap-10', 'bg-[#FAFAFA]');
    expect(letterCard).toHaveClass('min-w-0', 'rounded-2xl', 'border-neutral-300', 'bg-white');
    expect(feedbackCard).toHaveClass('min-w-0', 'rounded-2xl', 'border-neutral-300', 'bg-white');
    expect(screen.getByRole('button', { name: 'Analyze' })).toHaveClass('bg-rose-600');
  });

  it('submits LOR analysis with the application ID', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    const onAnalysisStart = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderLorWriter(null, onAnalysisStart);
    const text = 'A specific recommendation with evidence. '.repeat(3);

    await userEvent.type(screen.getByLabelText('Letter of recommendation draft'), text);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/analyze-statement');
    expect(JSON.parse(String(init.body))).toMatchObject({
      applicationId: 'app-1',
      docType: 'recommendation_letter',
      text,
    });
    expect(onAnalysisStart).toHaveBeenCalledOnce();
  });

  it('renders the complete F7.3 quality review', async () => {
    renderLorWriter(lorReview);

    await userEvent.click(screen.getByRole('button', { name: 'score' }));

    expect(screen.getByText('Strong and credible')).toBeVisible();
    expect(screen.getByText('71/85')).toBeVisible();
    expect(screen.getByText('Recommender Context')).toBeVisible();
    expect(screen.getByText('Recommendation Strength')).toBeVisible();
    expect(screen.getByText('WHAT WORKS WELL')).toBeVisible();
    expect(screen.getByText('Clear recommender relationship')).toBeVisible();
    expect(screen.getByText('WHAT COULD BE STRONGER')).toBeVisible();
    expect(screen.getByText('Limited comparative context')).toBeVisible();
    expect(screen.getByText('PROFILE COVERAGE')).toBeVisible();
    expect(screen.getByText('Analytical thinking')).toBeVisible();
    expect(screen.getByText('Strongly supported')).toBeVisible();
  });

  it('does not auto-apply a missing-content suggestion without an exact source quote', () => {
    renderLorWriter({
      ...lorReview,
      suggestions: [
        {
          id: 'sug-missing',
          type: 'missing',
          category: 'Applicant Differentiation',
          originalText: '',
          replacement: '[Add an accurate comparison if supported.]',
          explanation: 'This needs a new sentence rather than a text replacement.',
        },
      ],
    });

    expect(screen.queryByRole('button', { name: 'Manual edit required' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Update this directly in the letter draft using facts your recommender can verify.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Letter of recommendation draft')).toHaveValue('');
  });

  it('persists an LOR draft without mixing it with statements', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ score: 72, summary: 'Specific.', suggestions: [], checklist: [] }),
      ),
    );
    renderLorWriter();
    const text = 'A specific recommendation with evidence. '.repeat(3);

    await userEvent.type(screen.getByLabelText('Letter of recommendation draft'), text);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    await waitFor(() =>
      expect(mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Recommendation letter for Computer Science Â· Cambridge',
          content: text,
          doc_type: 'recommendation_letter',
        }),
      ),
    );
  });

  it('keeps the full essay visible while evidence mapping is still running', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderWorkspaceWriter();
    const original =
      'I noticed a concrete problem and decided to act. '.repeat(6).trim();

    fireEvent.change(screen.getByLabelText('Nội dung bài luận'), {
      target: { value: original },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const manuscript = await screen.findByTestId('essay-manuscript');
    expect(manuscript).toHaveTextContent(original);
    expect(manuscript.querySelectorAll('button')).toHaveLength(0);
  });

  it('highlights diagnostic evidence before the VinUni stream completes', async () => {
    const stream = streamingResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    renderWorkspaceWriter();
    const original = 'I led a robotics team. '.repeat(10).trim();

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: original },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    stream.send({
      type: 'evidence_map',
      data: {
        ...vinUniAnalysis.evidenceMap,
        essaySegments: [{ evidence_id: 'U001', text: 'I led a robotics team.' }],
      },
    });
    stream.send({
      type: 'diagnostics',
      data: {
        ...vinUniDiagnostics,
        issues: [{
          id: 'DIAG-1',
          criterion: 'detail',
          text: 'Add a concrete reaction.',
          evidenceRefs: [{ source: 'essay', id: 'U001' }],
          priority: 'high',
        }],
      },
    });

    await waitFor(() =>
      expect(document.getElementById('evidence-U001')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('essay-manuscript')).toHaveTextContent(original);
    stream.close();
  });

  it('sends a VinUniversity SOP to the grounded DeepSeek route', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    renderVinUniWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/analyze-statement-aacc');
    expect(init).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(String(init?.body))).toMatchObject({
      applicationId: 'app-1',
      text: 'A'.repeat(220),
      essayPrompt: expect.any(String),
    });
  });

  it('uses the local demo application ID for VinUni analysis', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    renderDemoWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({
      applicationId: VINUNI_DEMO_APPLICATION_ID,
    });
  });

  it('allows the VinUni essay prompt to be edited before analysis', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    renderVinUniWriter();

    const prompt = screen.getByLabelText('Đề bài luận');
    await userEvent.clear(prompt);
    await userEvent.type(prompt, 'Explain a failure that changed your leadership.');
    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.essayPrompt).toBe('Explain a failure that changed your leadership.');
  });

  it('renders VinUni sections before the model stream completes', async () => {
    const stream = streamingResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    renderWorkspaceWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    stream.send({
      type: 'status',
      stage: 'mapping_evidence',
      message: 'Đang lập bản đồ dẫn chứng…',
    });
    expect(await screen.findByText('Đang lập bản đồ dẫn chứng…')).toBeVisible();
    stream.send({
      type: 'section',
      section: 'A',
      data: {
        items: [
          { text: 'Nhận định streamed 1', evidenceIds: ['U001'] },
          { text: 'Nhận định streamed 2', evidenceIds: ['U001'] },
          { text: 'Nhận định streamed 3', evidenceIds: ['U001'] },
        ],
      },
    });

    const overview = await screen.findByText('Nhận định streamed 1');
    const scoreSkeleton = screen.getByTestId('diagnostic-score-skeleton');
    expect(screen.getByTestId('diagnostic-radar-skeleton')).toBeVisible();
    expect(
      Boolean(
        scoreSkeleton.compareDocumentPosition(overview) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);

    stream.send({
      type: 'complete',
      analysis: vinUniAnalysis,
      inputHash: createVinUniInputHash('A'.repeat(220), VINUNI_DEFAULT_ESSAY_PROMPT),
      versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
      timing: { firstSectionMs: 50, totalMs: 100 },
    });
    stream.close();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Phân tích lại' })).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId('typing-text').length).toBeGreaterThan(0);
  });

  it('highlights only the selected claim when separate sections reuse an ID', async () => {
    const duplicateIds = structuredClone(vinUniAnalysis) as AaccAnalysisV2;
    duplicateIds.review.overall = [
      {
        id: 'R001',
        text: 'Nhận xét tổng quan dùng dẫn chứng đầu tiên.',
        evidenceRefs: [{ source: 'essay', id: 'U001' }],
        priority: 'high',
      },
    ];
    duplicateIds.review.hookEngagement.analysis = [
      {
        id: 'R001',
        text: 'Nhận xét mở bài dùng một dẫn chứng hoàn toàn khác.',
        evidenceRefs: [{ source: 'essay', id: 'U002' }],
        priority: 'high',
      },
    ];
    duplicateIds.evidenceMap.essaySegments.push({
      evidence_id: 'U002',
      text: 'A different piece of evidence.',
    });

    const props = {
      saveTarget: { kind: 'application', applicationId: 'app-1' },
      targetName: 'Business Administration · VinUniversity',
      initialContent: 'I led a robotics team. A different piece of evidence.',
      initialAnalysis: {
        schemaVersion: 'v2-schema',
        rubricVersion: 'v2-rubric',
        promptVersion: 'v2-prompt',
        essayPrompt: VINUNI_DEFAULT_ESSAY_PROMPT,
        inputHash: 'stored',
        analysis: duplicateIds,
      },
      statementId: 1,
      embedded: true,
    } as unknown as ComponentProps<typeof StatementWriter>;
    render(<StatementWriter {...props} />);

    const selected = screen.getByRole('button', {
      name: 'Nhận xét tổng quan dùng dẫn chứng đầu tiên.',
    });
    const other = screen.getByRole('button', {
      name: 'Nhận xét mở bài dùng một dẫn chứng hoàn toàn khác.',
    });
    await userEvent.click(selected);

    expect(selected).toHaveAttribute('data-active', 'true');
    expect(other).toHaveAttribute('data-active', 'false');
  });

  it('persists only a complete versioned VinUni analysis', async () => {
    const stream = streamingResponse();
    const submittedText = 'A'.repeat(220);
    stream.send({
      type: 'complete',
      analysis: vinUniAnalysis,
      inputHash: createVinUniInputHash(submittedText, VINUNI_DEFAULT_ESSAY_PROMPT),
      versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
      timing: { firstSectionMs: 50, totalMs: 100 },
    });
    stream.close();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    renderVinUniWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), submittedText);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Re-analyze' })).toBeInTheDocument(),
    );

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: submittedText,
        ai_analysis: expect.objectContaining({
          schemaVersion: 'v2-schema',
          rubricVersion: 'v2-rubric',
          promptVersion: 'v2-prompt',
          essayPrompt: expect.any(String),
          analysis: vinUniAnalysis,
        }),
      }),
    );
  });

  it('does not persist a completed local demo analysis', async () => {
    const stream = streamingResponse();
    const submittedText = 'A'.repeat(220);
    stream.send({
      type: 'complete',
      analysis: vinUniAnalysis,
      inputHash: createVinUniInputHash(submittedText, VINUNI_DEFAULT_ESSAY_PROMPT),
      versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
      timing: { firstSectionMs: 50, totalMs: 100 },
    });
    stream.close();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    renderDemoWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), submittedText);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Phân tích lại' })).toBeInTheDocument(),
    );

    expect(mocks.supabase.auth.getUser).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('uses the grounded route when the VinUni MVP mode is explicit', async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    renderExplicitVinUniWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/analyze-statement-aacc',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses balanced cards and mobile pane tabs in workspace mode', async () => {
    renderWorkspaceWriter();

    const essay = screen.getByRole('region', { name: 'Bài luận' });
    const feedback = screen.getByRole('region', { name: 'Phản hồi' });
    expect(essay).toHaveClass('lg:basis-0', 'rounded-2xl');
    expect(feedback).toHaveClass('lg:basis-0', 'rounded-2xl');

    await userEvent.click(screen.getByRole('button', { name: 'Phản hồi' }));
    expect(essay).toHaveClass('hidden');
    expect(feedback).not.toHaveClass('hidden');
  });

  it('keeps partial sections and retries only the missing section', async () => {
    const first = streamingResponse();
    const second = streamingResponse();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(first.response)
      .mockResolvedValueOnce(second.response);
    vi.stubGlobal('fetch', fetchMock);
    renderVinUniWriter();

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), 'A'.repeat(220));
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    first.send({
      type: 'section',
      section: 'A',
      data: {
        items: [
          {
            id: 'R001',
            text: 'Nhận xét có dẫn chứng được giữ lại sau khi một section khác gặp lỗi.',
            evidenceRefs: [{ source: 'essay', id: 'U001' }],
            priority: 'high',
          },
        ],
      },
    });
    first.send({
      type: 'error',
      code: 'SECTIONS_INCOMPLETE',
      sections: ['B'],
      message: 'Một phần chưa hoàn tất.',
      retryable: true,
    });
    first.close();

    expect(
      await screen.findByRole('button', {
        name: 'Nhận xét có dẫn chứng được giữ lại sau khi một section khác gặp lỗi.',
      }),
    ).toBeVisible();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Thử lại phần thiếu' }),
    );

    const [, retryInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(retryInit.body))).toMatchObject({
      requestedSections: ['B'],
    });
    expect(
      screen.getByRole('button', {
        name: 'Nhận xét có dẫn chứng được giữ lại sau khi một section khác gặp lỗi.',
      }),
    ).toBeVisible();
    second.close();
  });

  it('drops a completed response when the editor input hash is stale', async () => {
    const stream = streamingResponse();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    renderVinUniWriter();
    const submittedText = 'A'.repeat(220);

    await userEvent.type(screen.getByLabelText('Nội dung bài luận'), submittedText);
    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await userEvent.type(screen.getByLabelText('Đề bài luận'), ' changed');
    stream.send({
      type: 'complete',
      analysis: vinUniAnalysis,
      inputHash: createVinUniInputHash(submittedText, VINUNI_DEFAULT_ESSAY_PROMPT),
      versions: { schema: 'v2-schema', rubric: 'v2-rubric', prompt: 'v2-prompt' },
      timing: { firstSectionMs: 50, totalMs: 100 },
    });
    stream.close();

    await waitFor(() => expect(mocks.insert).not.toHaveBeenCalled());
    expect(screen.queryByText('Grounded summary.')).not.toBeInTheDocument();
  });

  it('keeps the original essay flow and highlights evidence inline', async () => {
    const original =
      'I noticed abandoned electronics projects.  Younger students wanted to learn but feared mistakes.\n\nI proposed a weekend workshop.';
    const reviewed = structuredClone(vinUniAnalysis) as unknown as AaccAnalysisV2;
    reviewed.evidenceMap.essaySegments = [
      { evidence_id: 'U001', text: 'I noticed abandoned electronics projects.' },
      { evidence_id: 'U002', text: 'Younger students wanted to learn but feared mistakes.' },
      { evidence_id: 'U003', text: 'I proposed a weekend workshop.' },
    ];
    reviewed.review.overall = [{
      id: 'R001',
      text: 'Nhận xét dẫn đến hai câu trong bản thảo.',
      evidenceRefs: [
        { source: 'essay', id: 'U001' },
        { source: 'essay', id: 'U003' },
      ],
      priority: 'high',
    }];
    reviewed.diagnostics = {
      ...vinUniDiagnostics,
      issues: [{
        id: 'DIAG-2',
        criterion: 'detail',
        text: 'Clarify why the students feared mistakes.',
        evidenceRefs: [{ source: 'essay', id: 'U002' }],
        priority: 'high',
      }],
    };
    render(
      <StatementWriter
        saveTarget={{ kind: 'demo' }}
        targetName="Bachelor of Computer Science · VinUniversity"
        initialContent={original}
        initialAnalysis={{
          schemaVersion: 'v2',
          rubricVersion: 'v2',
          promptVersion: 'v2',
          essayPrompt: VINUNI_DEFAULT_ESSAY_PROMPT,
          inputHash: createVinUniInputHash(original, VINUNI_DEFAULT_ESSAY_PROMPT),
          analysis: reviewed,
        }}
        statementId={null}
        embedded
        workspace
        evaluationMode="vinuni"
      />,
    );

    const manuscript = screen.getByTestId('essay-manuscript');
    expect(manuscript.textContent).toBe(original);
    expect(screen.queryByText('U001')).not.toBeInTheDocument();
    expect(manuscript.querySelectorAll('button')).toHaveLength(3);
    expect(document.getElementById('evidence-U002')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Nhận xét dẫn đến hai câu trong bản thảo.' }),
    );
    expect(document.getElementById('evidence-U001')).toHaveAttribute('data-active', 'true');
    expect(document.getElementById('evidence-U003')).toHaveAttribute('data-active', 'true');
  });

  it('keeps the reviewed VinUni essay editable and re-analyzes the edited text', async () => {
    const original = 'A'.repeat(220);
    const edited = 'B'.repeat(220);
    const reviewed = structuredClone(vinUniAnalysis) as unknown as AaccAnalysisV2;
    reviewed.diagnostics = {
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
        potentialScore: 6,
        dimensions: {
          writing: { current: 6, potential: 6 },
          detail: { current: 6, potential: 6 },
          voice: { current: 6, potential: 6 },
          character: { current: 6, potential: 6 },
          curiosity: { current: 6, potential: 6 },
          contribution: { current: 6, potential: 6 },
        },
      },
    };
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <StatementWriter
        saveTarget={{ kind: 'demo' }}
        targetName="Bachelor of Computer Science · VinUniversity"
        initialContent={original}
        initialAnalysis={{
          schemaVersion: 'v2',
          rubricVersion: 'v2',
          promptVersion: 'v2',
          essayPrompt: VINUNI_DEFAULT_ESSAY_PROMPT,
          inputHash: createVinUniInputHash(original, VINUNI_DEFAULT_ESSAY_PROMPT),
          analysis: reviewed,
        }}
        statementId={null}
        embedded
        workspace
        evaluationMode="vinuni"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Chỉnh sửa bài luận' }));
    const editor = screen.getByLabelText('Chỉnh sửa bài luận');
    expect(editor).toHaveValue(original);
    fireEvent.change(editor, { target: { value: edited } });
    await userEvent.click(screen.getByRole('button', { name: 'Phân tích lại' }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ text: edited });
  });
});
