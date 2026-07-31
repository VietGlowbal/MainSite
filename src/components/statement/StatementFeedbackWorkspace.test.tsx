import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatementFeedbackWorkspace } from './StatementFeedbackWorkspace';

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
  }: {
    initialContent: string;
    workspace: boolean;
    evaluationMode: string;
    saveTarget: { kind: string };
    reviewType?: string;
    initialDocType?: string;
  }) => (
    <div
      data-testid="statement-writer"
      data-workspace={workspace}
      data-evaluation-mode={evaluationMode}
      data-save-kind={saveTarget.kind}
      data-review-type={reviewType}
      data-doc-type={initialDocType}
    >
      {initialContent}
    </div>
  ),
}));

describe('StatementFeedbackWorkspace', () => {
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
      '/apply',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByTestId('statement-writer')).toHaveAttribute(
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
    expect(mocks.query.eq).toHaveBeenCalledWith('doc_type', 'recommendation_letter');
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
