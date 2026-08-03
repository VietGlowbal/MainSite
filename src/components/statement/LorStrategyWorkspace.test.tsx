import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LorStrategy } from '@/lib/ai/lor';
import { LorStrategyWorkspace, type StoredLorStrategy } from './LorStrategyWorkspace';

const applicationId = '11111111-1111-4111-8111-111111111111';
const activityId = '22222222-2222-4222-8222-222222222222';
const strategy: LorStrategy = {
  perspective: {
    summary: 'Ms. Nguyen can credibly discuss academic and research development.',
    strongInsights: [
      {
        trait: 'Analytical thinking',
        explanation: 'She directly supervised the selected research.',
        evidenceRefs: [`activity:${activityId}`],
      },
    ],
    limitedInsights: [
      {
        topic: 'Community leadership',
        explanation: 'No selected evidence shows direct observation.',
      },
    ],
  },
  recommendations: [
    {
      trait: 'Analytical problem-solving',
      rationale: 'Directly supported by the supervised project.',
      evidenceRefs: [`activity:${activityId}`],
      howToRaise: 'Ask whether she feels comfortable discussing your research process.',
      priority: 'high',
      confidence: 'high',
    },
  ],
  doNotPrioritize: [
    { trait: 'Community leadership', reason: 'The recommender did not observe it.' },
  ],
  recommendationBrief: 'Dear Ms. Nguyen, thank you for supporting my application.',
};

const evidence = [
  {
    kind: 'activity' as const,
    id: activityId,
    title: 'Independent economics research',
    description: 'Analyzed student decision-making.',
  },
];

afterEach(() => vi.unstubAllGlobals());

describe('LorStrategyWorkspace', () => {
  it('renders recommender perspective as a light website panel', () => {
    const restored: StoredLorStrategy = {
      recommenderType: 'subject_teacher',
      relationshipContext: 'She taught me Economics for two years.',
      knownDuration: 'one_to_two_years',
      observedEvidence: [{ kind: 'activity', id: activityId }],
      ...strategy,
    };

    render(
      <LorStrategyWorkspace
        applicationId={applicationId}
        evidence={evidence}
        initialStrategy={restored}
        onContinue={vi.fn()}
      />,
    );

    const perspective = screen.getByText('RECOMMENDER PERSPECTIVE').closest('section');
    expect(perspective).toHaveClass('border-line', 'bg-surface', 'text-fg');
    expect(perspective).not.toHaveClass('bg-surface-inverse-strong');
    expect(within(perspective!).getByText('Analytical thinking').closest('article')).toHaveClass(
      'bg-brand-subtle',
    );
  });

  it('uses the GlowBal semantic form and action theme', () => {
    render(
      <LorStrategyWorkspace
        applicationId={applicationId}
        evidence={evidence}
        initialStrategy={null}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: "Build the recommender's point of view" })).toHaveClass(
      'font-display',
      'text-fg',
    );
    expect(screen.getByLabelText('Who are you asking for a recommendation?').closest('form')).toHaveClass(
      'border-line',
      'bg-surface',
      'rounded-gb-2xl',
    );
    expect(screen.getByRole('button', { name: 'Generate recommender strategy' })).toHaveClass(
      'bg-brand',
      'text-on-brand',
    );
  });

  it('collects all four F7.1 inputs from stored reflection evidence', () => {
    render(
      <LorStrategyWorkspace
        applicationId={applicationId}
        evidence={evidence}
        initialStrategy={null}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Who are you asking for a recommendation?')).toBeVisible();
    expect(screen.getByLabelText('How do they know you?')).toBeVisible();
    expect(screen.getByLabelText('How long have they known you?')).toBeVisible();
    expect(
      screen.getByRole('group', {
        name: 'What experiences have they directly observed or supervised?',
      }),
    ).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Independent economics research/ })).toBeVisible();
  });

  it('generates and renders the F7.1 perspective, F7.2 recommendations, and brief', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(strategy))
      .mockResolvedValueOnce(
        Response.json({
          subject: 'Recommendation letter request',
          body: 'Dear [Recommender\'s Name],\n\nI would be grateful if you would consider writing a recommendation letter for me.',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <LorStrategyWorkspace
        applicationId={applicationId}
        evidence={evidence}
        initialStrategy={null}
        onContinue={onContinue}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText('Who are you asking for a recommendation?'),
      'subject_teacher',
    );
    await user.type(
      screen.getByLabelText('How do they know you?'),
      'She taught me Economics for two years and supervised my research project.',
    );
    await user.selectOptions(
      screen.getByLabelText('How long have they known you?'),
      'one_to_two_years',
    );
    await user.click(screen.getByRole('checkbox', { name: /Independent economics research/ }));
    await user.click(screen.getByRole('button', { name: 'Generate recommender strategy' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      applicationId,
      recommenderType: 'subject_teacher',
      relationshipContext:
        'She taught me Economics for two years and supervised my research project.',
      knownDuration: 'one_to_two_years',
      observedEvidence: [{ kind: 'activity', id: activityId }],
    });
    expect(await screen.findByText('RECOMMENDER PERSPECTIVE')).toBeVisible();
    expect(screen.getByText('Analytical thinking')).toBeVisible();
    expect(screen.getAllByText('Community leadership', { selector: 'h4' })).toHaveLength(2);
    expect(screen.getByText(/Analytical problem-solving/)).toBeVisible();
    expect(screen.getByText('Suggested Recommender Brief')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Send an email to my recommender' }));
    expect(screen.getByRole('dialog', { name: 'Email template for recommender' })).toBeVisible();
    expect(await screen.findByDisplayValue(/I would be grateful/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close email template' }));
    await user.click(screen.getByRole('button', { name: 'Send an email to my recommender' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('restores a saved strategy without regenerating it', () => {
    const restored: StoredLorStrategy = {
      recommenderType: 'subject_teacher',
      relationshipContext: 'She taught me Economics for two years.',
      knownDuration: 'one_to_two_years',
      observedEvidence: [{ kind: 'activity', id: activityId }],
      ...strategy,
    };

    render(
      <LorStrategyWorkspace
        applicationId={applicationId}
        evidence={evidence}
        initialStrategy={restored}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText('RECOMMENDER PERSPECTIVE')).toBeVisible();
    expect(screen.getByDisplayValue('She taught me Economics for two years.')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Independent economics research/ })).toBeChecked();
  });
});
