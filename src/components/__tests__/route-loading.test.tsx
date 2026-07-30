import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { RouteLoading } from '../route-loading';
import { GlobalLoadingOverlay } from '@/shared/ui/loading-overlay';

let pathname = '/universities';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

/** Must match SHOW_DELAY_MS / MIN_VISIBLE_MS / SAFETY_MS in the sources. */
const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 650;
const SAFETY_MS = 10_000;

const loader = () => document.querySelector('[data-testid="global-loader"]');

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
  // A timer callback that updates the store re-renders the overlay, and the
  // overlay's effect then queues its own 0ms "hide now" timer — but that
  // happens after `advanceTimersByTime` has already returned. Draining a
  // zero-length window lets it fire, which is what real timers would do on the
  // next tick of the event loop.
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

/**
 * jsdom cannot navigate, and logs a "Not implemented" error for every
 * unprevented link click. Swallowing the default in the bubble phase keeps the
 * output clean without affecting the component, whose listener is on capture
 * and therefore runs first.
 */
function swallowNavigation(event: MouseEvent) {
  event.preventDefault();
}

function clickLink(attrs: Record<string, string>, init: MouseEventInit = {}) {
  const anchor = document.createElement('a');
  for (const [key, value] of Object.entries(attrs)) anchor.setAttribute(key, value);
  anchor.textContent = 'go';
  document.body.appendChild(anchor);

  act(() => {
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  });

  return anchor;
}

describe('RouteLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pathname = '/universities';
    window.history.replaceState({}, '', '/universities');
    document.addEventListener('click', swallowNavigation);
  });

  afterEach(() => {
    document.removeEventListener('click', swallowNavigation);
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function mount() {
    return render(
      <>
        <GlobalLoadingOverlay />
        <RouteLoading />
      </>,
    );
  }

  it('shows the loader when an in-app link is clicked', () => {
    mount();

    clickLink({ href: '/scholarships' });
    tick(SHOW_DELAY_MS + 20);

    expect(loader()).not.toBeNull();
  });

  it('clears the loader once the route commits', () => {
    const { rerender } = mount();

    clickLink({ href: '/scholarships' });
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    pathname = '/scholarships';
    act(() => {
      rerender(
        <>
          <GlobalLoadingOverlay />
          <RouteLoading />
        </>,
      );
    });

    tick(MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });

  it('gives up after the safety timeout when the navigation never lands', () => {
    // The failure mode this exists for: a link whose default is prevented
    // somewhere above, so the click looks like a navigation but nothing moves.
    mount();

    clickLink({ href: '/scholarships' });
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    tick(SAFETY_MS + MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });

  it.each([
    ['an external link', { href: 'https://example.com/x' }, {}],
    ['a new-tab link', { href: '/scholarships', target: '_blank' }, {}],
    ['a download link', { href: '/file.pdf', download: '' }, {}],
    ['an opted-out link', { href: '/scholarships', 'data-no-loader': '' }, {}],
    ['a mailto link', { href: 'mailto:hi@example.com' }, {}],
    ['a link to the current URL', { href: '/universities' }, {}],
    ['an on-page anchor', { href: '/universities#section' }, {}],
    ['a command-click', { href: '/scholarships' }, { metaKey: true }],
    ['a middle-click', { href: '/scholarships' }, { button: 1 }],
  ])('does not show the loader for %s', (_name, attrs, init) => {
    mount();

    clickLink(attrs as Record<string, string>, init as MouseEventInit);
    tick(SHOW_DELAY_MS + 200);

    expect(loader()).toBeNull();
  });

  it('shows the loader on back/forward navigation', () => {
    mount();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    tick(SHOW_DELAY_MS + 20);

    expect(loader()).not.toBeNull();
  });

  it('clears a query-string-only navigation, which usePathname cannot see', () => {
    // Pagination and filter chips navigate this way. The pathname never
    // changes, so the URL poll is the only thing that ends the task.
    mount();

    clickLink({ href: '/universities?page=2' });
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    act(() => {
      window.history.replaceState({}, '', '/universities?page=2');
    });

    tick(MIN_VISIBLE_MS + 400);
    expect(loader()).toBeNull();
  });

  it('releases its handle when unmounted mid-navigation', () => {
    const { unmount } = mount();

    clickLink({ href: '/scholarships' });
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    act(() => unmount());

    // The overlay unmounted with it; what matters is that the store is empty,
    // which a fresh overlay will show.
    render(<GlobalLoadingOverlay />);
    tick(SHOW_DELAY_MS + 200);
    expect(loader()).toBeNull();
  });
});
