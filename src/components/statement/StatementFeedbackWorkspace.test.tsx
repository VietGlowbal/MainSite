import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatementFeedbackWorkspace } from './StatementFeedbackWorkspace';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 7,
                content: 'My existing statement',
                ai_analysis: null,
                doc_type: 'personal_statement',
              },
            }),
          }),
        }),
      }),
    }),
  })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: fromMock,
  }),
}));

vi.mock('./StatementWriter', () => ({
  StatementWriter: ({
    initialContent,
    workspace,
    evaluationMode,
    saveTarget,
  }: {
    initialContent: string;
    workspace: boolean;
    evaluationMode: string;
    saveTarget: { kind: string };
  }) => (
    <div
      data-testid="statement-writer"
      data-workspace={workspace}
      data-evaluation-mode={evaluationMode}
      data-save-kind={saveTarget.kind}
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
    fromMock.mockClear();

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
    expect(fromMock).not.toHaveBeenCalled();
  });
});
