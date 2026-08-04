import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatementFeedbackWorkspace } from './StatementFeedbackWorkspace';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/apply/application-1/lor-feedback',
}));

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  const data = {
    id: 7,
    content: 'My existing statement',
    ai_analysis: null,
    doc_type: 'personal_statement',
  };
  Object.assign(query, {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  });
  return { from: vi.fn(() => query), query };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mocks.from,
  }),
}));

vi.mock('./StatementWriter', () => ({
  StatementWriter: ({
    initialContent,
    workspace,
    evaluationMode,
    saveTarget,
    reviewType,
    initialDocType,
    onAnalysisStart,
    onAnalysisComplete,
    onAnalysisError,
    requestedWorkspacePane,
  }: {
    initialContent: string;
    workspace: boolean;
    evaluationMode: string;
    saveTarget: { kind: string };
    reviewType?: string;
    initialDocType?: string;
    onAnalysisStart?: () => void;
    onAnalysisComplete?: () => void;
    onAnalysisError?: () => void;
    requestedWorkspacePane?: string;
  }) => (
    <>
      <div
        data-testid="statement-writer"
        data-workspace={workspace}
        data-evaluation-mode={evaluationMode}
        data-save-kind={saveTarget.kind}
        data-review-type={reviewType}
        data-doc-type={initialDocType}
        data-requested-pane={requestedWorkspacePane}
      >
        {initialContent}
      </div>
      <button type="button" onClick={onAnalysisStart}>Start quality review</button>
      <button type="button" onClick={onAnalysisComplete}>Complete quality review</button>
      <button type="button" onClick={onAnalysisError}>Fail quality review</button>
    </>
  ),
}));

vi.mock('./LorStrategyWorkspace', () => ({
  LorStrategyWorkspace: ({ onContinue }: { onContinue: () => void }) => (
    <div data-testid="lor-strategy">
      <button type="button" onClick={onContinue}>Continue strategy</button>
    </div>
  ),
}));

describe('StatementFeedbackWorkspace', () => {
  it('uses the shared website shell and semantic theme in LOR mode', () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science · Cambridge"
        reviewType="lor"
        demo
        userName="Olivia"
        userAvatarUrl="https://example.com/avatar.png"
      />,
    );

    expect(screen.getAllByRole('link', { name: 'GlowBal home' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'GlowBal home' })[0]).toHaveAttribute('href', '/');
    expect(screen.getByRole('main')).toHaveClass('bg-surface');
    expect(screen.getByRole('main').firstElementChild).toHaveClass(
      'w-full',
      'px-gb-xl',
      'md:px-gb-4xl',
    );
    const timeline = screen.getByRole('navigation', { name: 'LOR review stages' });
    expect(timeline).toHaveClass(
      'border-line',
      'bg-surface',
    );
    expect(screen.getByRole('heading', { name: 'Strengthen your recommendation letter' }).closest('header'))
      .not.toHaveClass('rounded-t-gb-2xl', 'border');
    expect(timeline.parentElement).not.toHaveClass('rounded-b-gb-2xl', 'border', 'shadow-gb-lg');
  });

  it('renders the LOR stages as a connected progress timeline', () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science · Cambridge"
        reviewType="lor"
        demo
      />,
    );

    const timeline = screen.getByRole('navigation', { name: 'LOR review stages' });
    expect(within(timeline).getByRole('list')).toBeVisible();
    expect(screen.getAllByTestId(/lor-stage-node-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/lor-stage-connector-/)).toHaveLength(2);
    expect(screen.getByTestId('lor-stage-node-strategy')).toHaveClass('rounded-gb-full');
    expect(screen.getByTestId('lor-stage-connector-strategy')).toHaveClass('h-0.5');
    expect(screen.getByRole('button', { name: /Recommender strategy/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('renders the statement tool as a dedicated full-page workspace', async () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science · Cambridge"
        contextNote="Course context"
      />,
    );

    expect(screen.getByRole('link', { name: /Quay lại Apply/i })).toHaveAttribute(
      'href',
      '/apply/application-1',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('bg-[#FAFAFA]', 'pb-24');
    expect(screen.getByRole('main').firstElementChild).toHaveClass('!max-w-[1600px]');
    expect(screen.getByRole('heading', { name: 'Strengthen your statement' })).toHaveClass(
      'text-4xl',
    );
    const writer = await screen.findByTestId('statement-writer');
    expect(writer.parentElement?.parentElement?.parentElement).toHaveClass('min-h-[680px]');
    expect(writer).toHaveAttribute(
      'data-workspace',
      'true',
    );
    expect(screen.getByTestId('statement-writer')).toHaveTextContent('My existing statement');
    expect(screen.getByTestId('statement-writer')).toHaveAttribute(
      'data-evaluation-mode',
      'generic',
    );
    expect(mocks.query.in).toHaveBeenCalledWith('doc_type', [
      'personal_statement',
      'statement_of_purpose',
    ]);
  });

  it('loads and labels a recommendation-letter draft in LOR mode', async () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science Â· Cambridge"
        reviewType="lor"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Strengthen your recommendation letter' })).toBeVisible();
    expect(await screen.findByTestId('statement-writer')).toHaveAttribute(
      'data-review-type',
      'lor',
    );
    expect(screen.getByTestId('statement-writer')).toHaveAttribute(
      'data-doc-type',
      'recommendation_letter',
    );
    expect(screen.getByRole('link', { name: /Quay lại Apply/i })).toHaveAttribute(
      'href',
      '/apply/application-1',
    );
    expect(mocks.query.eq).toHaveBeenCalledWith('doc_type', 'recommendation_letter');
  });

  it('moves the dedicated LOR page through strategy, draft, and quality review', async () => {
    const user = userEvent.setup();
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science · Cambridge"
        reviewType="lor"
        lorEvidence={[]}
        initialLorStrategy={null}
      />,
    );

    expect(await screen.findByRole('button', { name: /Recommender strategy/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Letter draft/ })).toBeDisabled();
    expect(await screen.findByTestId('lor-strategy')).toBeVisible();
    expect(screen.getByTestId('statement-writer').parentElement).toHaveClass('hidden');

    await user.click(screen.getByRole('button', { name: 'Continue strategy' }));
    expect(screen.getByTestId('statement-writer').parentElement).toHaveClass('flex');
    expect(screen.getByTestId('statement-writer')).toHaveAttribute('data-requested-pane', 'essay');

    await user.click(screen.getByRole('button', { name: 'Start quality review' }));
    expect(screen.getByRole('button', { name: /Quality review/ })).toBeDisabled();
    expect(screen.getByTestId('statement-writer')).toHaveAttribute('data-requested-pane', 'feedback');

    await user.click(screen.getByRole('button', { name: 'Fail quality review' }));
    expect(screen.getByTestId('statement-writer')).toHaveAttribute('data-requested-pane', 'essay');

    await user.click(screen.getByRole('button', { name: 'Start quality review' }));
    await user.click(screen.getByRole('button', { name: 'Complete quality review' }));
    expect(screen.getByRole('button', { name: /Quality review/ })).toBeEnabled();
    expect(screen.getByTestId('statement-writer')).toHaveAttribute('data-requested-pane', 'feedback');
  });

  it('uses the deep AACC workflow only for VinUniversity', async () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science · VinUniversity"
      />,
    );

    expect(await screen.findByTestId('statement-writer')).toHaveAttribute(
      'data-evaluation-mode',
      'vinuni',
    );
  });

  it('uses the route-selected evaluation mode instead of inferring it from the title', async () => {
    render(
      <StatementFeedbackWorkspace
        applicationId="application-1"
        targetName="Computer Science Â· VinUniversity"
        evaluationMode="generic"
      />,
    );

    expect(await screen.findByTestId('statement-writer')).toHaveAttribute(
      'data-evaluation-mode',
      'generic',
    );
  });

  it('starts a local VinUni demo without reading a saved draft', () => {
    mocks.from.mockClear();

    render(
      <StatementFeedbackWorkspace
        applicationId="vinuni-demo"
        targetName="Bachelor of Computer Science · VinUniversity"
        demo
      />,
    );

    expect(screen.getByTestId('statement-writer')).toHaveAttribute(
      'data-evaluation-mode',
      'vinuni',
    );
    expect(screen.getByTestId('statement-writer')).toHaveAttribute(
      'data-save-kind',
      'demo',
    );
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
