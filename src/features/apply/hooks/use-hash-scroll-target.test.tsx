import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHashScrollTarget } from './use-hash-scroll-target';

function SavedTarget() {
  const ref = useHashScrollTarget<HTMLDivElement>('#saved');
  return <div ref={ref}>Saved universities</div>;
}

describe('useHashScrollTarget', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('scrolls after a cross-page destination mounts with the requested hash', () => {
    window.history.replaceState(null, '', '/apply#saved');

    render(<SavedTarget />);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('does not scroll when the destination hash is absent', () => {
    window.history.replaceState(null, '', '/apply');

    render(<SavedTarget />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('also handles a same-page hash change', () => {
    window.history.replaceState(null, '', '/apply');
    render(<SavedTarget />);

    act(() => {
      window.history.pushState(null, '', '/apply#saved');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
