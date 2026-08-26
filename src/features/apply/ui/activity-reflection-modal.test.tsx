import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REFLECTION_DIMENSIONS, type ActivityReflectionValues } from '@/features/apply/domain';
import { ActivityReflectionModal } from './activity-reflection-modal';

describe('ActivityReflectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  const dummyT = (key: string, vars?: Record<string, string | number>) => {
    let res = key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        res = res.replace(`{${k}}`, String(v));
      }
    }
    return res;
  };

  it('renders all 7 reflection dimensions in one scrollable surface', () => {
    const initial: ActivityReflectionValues = {
      context: 'Started the club in 2024',
    };

    render(
      <ActivityReflectionModal
        open={true}
        onClose={vi.fn()}
        category="leadership_initiative"
        activityTitle="Robotics Club President"
        value={initial}
        onChange={vi.fn()}
        onAutosave={vi.fn().mockResolvedValue(undefined)}
        onRequestCard={vi.fn()}
        t={dummyT}
      />,
    );

    expect(screen.getByText('Activity Reflection')).toBeInTheDocument();
    expect(screen.getByText('Robotics Club President')).toBeInTheDocument();
    expect(screen.getByText('1 of 7 answered')).toBeInTheDocument();

    const textareas = screen.getAllByRole('textbox');
    expect(textareas).toHaveLength(REFLECTION_DIMENSIONS.length);
    expect(textareas[0]).toHaveValue('Started the club in 2024');
  });

  it('supports progressive disclosure: Help me think & Need inspiration', () => {
    render(
      <ActivityReflectionModal
        open={true}
        onClose={vi.fn()}
        category="leadership_initiative"
        activityTitle="Robotics Club President"
        value={{}}
        onChange={vi.fn()}
        onAutosave={vi.fn().mockResolvedValue(undefined)}
        onRequestCard={vi.fn()}
        t={dummyT}
      />,
    );

    const helpButtons = screen.getAllByRole('button', { name: /Help me think/i });
    expect(helpButtons.length).toBeGreaterThan(0);

    // Click "Help me think" for first dimension
    fireEvent.click(helpButtons[0]!);

    expect(screen.getByText(/Think about:/i)).toBeInTheDocument();

    const inspirationButtons = screen.getAllByRole('button', { name: /Need inspiration\?/i });
    if (inspirationButtons.length > 0) {
      fireEvent.click(inspirationButtons[0]!);
      expect(screen.getByText(/One way you could structure your answer:/i)).toBeInTheDocument();
    }
  });

  it('calls onChange immediately and triggers debounced onAutosave', async () => {
    const onChange = vi.fn();
    const onAutosave = vi.fn().mockResolvedValue(undefined);

    render(
      <ActivityReflectionModal
        open={true}
        onClose={vi.fn()}
        category="academic_personal_growth"
        activityTitle="Math Olympiad"
        value={{}}
        onChange={onChange}
        onAutosave={onAutosave}
        onRequestCard={vi.fn()}
        t={dummyT}
      />,
    );

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[0]!, { target: { value: 'National Gold Medal' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'National Gold Medal',
      }),
    );

    expect(onAutosave).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(850);
    });

    expect(onAutosave).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose without resetting parent values', () => {
    const onClose = vi.fn();
    const onChange = vi.fn();

    render(
      <ActivityReflectionModal
        open={true}
        onClose={onClose}
        category="innovation_projects"
        activityTitle="School Orchestra App"
        value={{ context: 'First violin' }}
        onChange={onChange}
        onAutosave={vi.fn().mockResolvedValue(undefined)}
        onRequestCard={vi.fn()}
        t={dummyT}
      />,
    );

    const saveAndExitBtn = screen.getByRole('button', { name: /Save & exit/i });
    fireEvent.click(saveAndExitBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('invokes onRequestCard when finishing reflection', async () => {
    const onAutosave = vi.fn().mockResolvedValue(undefined);
    const onRequestCard = vi.fn();

    render(
      <ActivityReflectionModal
        open={true}
        onClose={vi.fn()}
        category="community_impact"
        activityTitle="Football Captain"
        value={{ context: 'Led the team' }}
        onChange={vi.fn()}
        onAutosave={onAutosave}
        onRequestCard={onRequestCard}
        t={dummyT}
      />,
    );

    const finishBtn = screen.getByRole('button', { name: /Finish reflection/i });
    fireEvent.click(finishBtn);

    await act(async () => {
      await Promise.resolve();
    });

    expect(onAutosave).toHaveBeenCalled();
    expect(onRequestCard).toHaveBeenCalledTimes(1);
  });
});
