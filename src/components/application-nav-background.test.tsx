import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('@/shared/ui', () => ({ usePrefersReducedMotion: () => mocks.reducedMotion }));

import { ApplicationNavBackground } from './application-nav-background';

afterEach(() => {
  cleanup();
  mocks.reducedMotion = false;
});

describe('ApplicationNavBackground', () => {
  it('renders a hidden, non-interactive canvas and unmounts cleanly', () => {
    const { container, unmount } = render(<ApplicationNavBackground />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(canvas?.className).toContain('pointer-events-none');
    // Must not throw on unmount — the effect's rAF/ResizeObserver cleanup runs here.
    expect(() => unmount()).not.toThrow();
  });

  it('renders nothing under prefers-reduced-motion', () => {
    mocks.reducedMotion = true;
    const { container } = render(<ApplicationNavBackground />);
    expect(container.querySelector('canvas')).toBeNull();
  });
});
