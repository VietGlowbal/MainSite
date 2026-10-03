import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SavedActionDock } from './saved-action-dock';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function mockBottomInset(inset: string) {
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
    const style = computedStyle(element, pseudoElement);
    if (element.hasAttribute('data-saved-action-slot')) {
      Object.defineProperty(style, 'paddingBottom', { value: inset, configurable: true });
    }
    return style;
  });
}

describe('SavedActionDock', () => {
  it('keeps one set of controls as its natural location enters and leaves the viewport', () => {
    let notify: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(104);
    mockBottomInset('16px');
    const { unmount } = render(<SavedActionDock><button>Plan</button></SavedActionDock>);
    const dock = screen.getByRole('region', { name: 'Saved university actions' });
    const slot = dock.parentElement!;
    const control = screen.getByRole('button', { name: 'Plan' });
    expect(observe).toHaveBeenCalledWith(slot);
    expect(slot.style.height).toBe('120px');
    const intersect = (isIntersecting: boolean, intersectionRatio: number) => act(() => {
      notify([{ isIntersecting, intersectionRatio } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    intersect(false, 0);
    expect(dock).toHaveAttribute('data-pinned', 'true');
    intersect(true, 0.5);
    expect(dock).toHaveAttribute('data-pinned', 'true');
    intersect(true, 1);
    expect(dock).toHaveAttribute('data-pinned', 'false');
    intersect(false, 0);
    expect(dock).toHaveAttribute('data-pinned', 'true');
    expect(screen.getAllByRole('button', { name: 'Plan' })).toEqual([control]);
    expect(slot.style.height).toBe('120px');
    expect(dock).toHaveClass('motion-reduce:transition-none');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('updates the reserved height when responsive controls resize', () => {
    let resize: ResizeObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(104);
    mockBottomInset('34px');
    const { unmount } = render(<SavedActionDock><button>Plan</button></SavedActionDock>);
    const dock = screen.getByRole('region');
    expect(observe).toHaveBeenCalledWith(dock);
    height.mockReturnValue(180);
    act(() => resize([], {} as ResizeObserver));
    expect(dock.parentElement!.style.height).toBe('214px');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('renders naturally without browser observers and during SSR', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<SavedActionDock><button>Plan</button></SavedActionDock>);
    expect(screen.getByRole('region')).toHaveAttribute('data-pinned', 'false');
    expect(renderToString(<SavedActionDock><button>Plan</button></SavedActionDock>)).toContain('data-pinned="false"');
  });

  it('reveals keyboard focus covered by the pinned surface and removes its focus listener', () => {
    let notify: IntersectionObserverCallback = () => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe() {}
      disconnect() {}
    });
    const { unmount } = render(<section><button>Official site</button><SavedActionDock><button>Plan</button></SavedActionDock></section>);
    const control = screen.getByRole('button', { name: 'Official site' });
    const dock = screen.getByRole('region');
    const scroll = vi.fn();
    Object.defineProperty(control, 'scrollIntoView', { value: scroll });
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({ top: 700, bottom: 720, left: 41, right: 131 } as DOMRect);
    vi.spyOn(dock, 'getBoundingClientRect').mockReturnValue({ top: 606, bottom: 784, left: 16, right: 344 } as DOMRect);
    act(() => notify([{ isIntersecting: false, intersectionRatio: 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
    control.focus();
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
    screen.getByRole('button', { name: 'Plan' }).focus();
    expect(scroll).toHaveBeenCalledOnce();
    const scope = control.parentElement!;
    unmount();
    scope.appendChild(control);
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(scroll).toHaveBeenCalledOnce();
  });
});
