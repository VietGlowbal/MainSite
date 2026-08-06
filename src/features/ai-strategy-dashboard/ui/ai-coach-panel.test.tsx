import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiCoachPanel } from './ai-coach-panel';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubEmptyThread() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: () => Promise.resolve({ messages: [] }) }),
  );
}

describe('AiCoachPanel — starter chips', () => {
  it('shows the task\'s own suggestedQuestions instead of the generic seed intents when there are any', async () => {
    stubEmptyThread();
    render(
      <AiCoachPanel
        applicationId="app-1"
        recommendationId="rec-1"
        suggestedQuestions={['What results should I include?', 'How do I format this clearly?']}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'What results should I include?' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'How do I format this clearly?' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I improve this?' })).not.toBeInTheDocument();
  });

  it('falls back to the generic seed intents when the task has none', async () => {
    stubEmptyThread();
    render(<AiCoachPanel applicationId="app-1" recommendationId="rec-1" suggestedQuestions={[]} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'How do I improve this?' })).toBeInTheDocument(),
    );
  });

  it('falls back to the generic seed intents when suggestedQuestions is omitted entirely', async () => {
    stubEmptyThread();
    render(<AiCoachPanel applicationId="app-1" recommendationId="rec-1" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Find resources.' })).toBeInTheDocument(),
    );
  });
});
