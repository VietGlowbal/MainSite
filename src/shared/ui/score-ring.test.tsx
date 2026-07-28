import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreRing, scoreRingColor } from './score-ring';

/** The three tokens the bands resolve to, per Figma 337:18812. */
const SAFE = 'var(--color-gb-tier-safe)';
const AMBER = 'var(--color-gb-yellow-400)';
const ROSE = 'var(--color-gb-brand-600)';

describe('scoreRingColor', () => {
  it('bands at the boundaries the shipped list row uses', () => {
    expect(scoreRingColor(100)).toBe(SAFE);
    expect(scoreRingColor(70)).toBe(SAFE);
    expect(scoreRingColor(69)).toBe(AMBER);
    expect(scoreRingColor(40)).toBe(AMBER);
    expect(scoreRingColor(39)).toBe(ROSE);
    expect(scoreRingColor(0)).toBe(ROSE);
  });

  it('reproduces the three values the frame draws', () => {
    // The design exports rings baked at 92 / 60 / 30. Those are the reference.
    expect(scoreRingColor(92)).toBe(SAFE);
    expect(scoreRingColor(60)).toBe(AMBER);
    expect(scoreRingColor(30)).toBe(ROSE);
  });

  it('never returns the blue tier ramp', () => {
    // tier-recommend is blue; a blue segment here would read as a fourth state
    // rather than a point on a three-band scale.
    for (let v = 0; v <= 100; v++) {
      expect(scoreRingColor(v)).not.toContain('recommend');
    }
  });
});

describe('ScoreRing', () => {
  it('names the measure so two different quantities cannot be confused', () => {
    const { rerender } = render(<ScoreRing value={40} measure="progress" />);
    expect(screen.getByTestId('score-ring-label')).toHaveTextContent('Progress');
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Progress: 40%');

    rerender(<ScoreRing value={40} measure="match" />);
    expect(screen.getByTestId('score-ring-label')).toHaveTextContent('Match');
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Match: 40%');
  });

  it('keeps the measure in the accessible name even when the caption is hidden', () => {
    render(<ScoreRing value={72} measure="match" showLabel={false} />);
    expect(screen.queryByTestId('score-ring-label')).toBeNull();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Match: 72%');
  });

  it('lets a caller override the caption without losing the measure', () => {
    render(<ScoreRing value={83} measure="match" label="Overall fit" />);
    expect(screen.getByTestId('score-ring-label')).toHaveTextContent('Overall fit');
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Overall fit: 83%');
  });

  it('clamps out-of-range values rather than drawing an overflowing arc', () => {
    const { rerender } = render(<ScoreRing value={140} measure="progress" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Progress: 100%');

    rerender(<ScoreRing value={-20} measure="progress" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Progress: 0%');
  });

  it('draws no arc at zero', () => {
    // strokeLinecap="round" paints a dot for a zero-length dash, which reads as
    // a couple of percent rather than as nothing.
    const { container } = render(<ScoreRing value={0} measure="progress" />);
    expect(container.querySelectorAll('circle')).toHaveLength(1);

    const { container: some } = render(<ScoreRing value={1} measure="progress" />);
    expect(some.querySelectorAll('circle')).toHaveLength(2);
  });

  it('reproduces the shipped list geometry at md', () => {
    // 104px plate, 76px box — promoting this out of apply-list-client must not
    // have changed the screen that already shipped.
    const { container } = render(<ScoreRing value={50} measure="progress" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '76');
    expect(svg).toHaveAttribute('viewBox', '0 0 76 76');
  });
});
