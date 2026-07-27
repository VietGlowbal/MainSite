import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { GlobalLoadingOverlay, beginLoading, useLoadingIndicator } from './loading-overlay';
import { GlobeLoader, LoadingScreen, PageLoaderOverlay } from './globe-loader';
import { LOADING_PHRASES, nextPhraseIndex } from './loading-phrases';

/** Must match SHOW_DELAY_MS / MIN_VISIBLE_MS in loading-overlay.tsx. */
const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 650;

const LOADER = '[data-testid="global-loader"]';
const loader = () => document.querySelector(LOADER);

/** Advance timers and let React flush the resulting renders. */
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
 * The loading store is a module singleton, so a handle a failing test forgets
 * to release would keep the overlay up for every test after it — turning one
 * red test into a cascade. Every handle taken here is registered for cleanup,
 * and `release` is idempotent, so a test can still end its own tasks.
 */
const openHandles: Array<() => void> = [];

function start(label?: string): () => void {
  let end: () => void = () => {};
  act(() => {
    end = beginLoading(label);
  });
  openHandles.push(end);
  return () => act(() => end());
}

afterEach(() => {
  act(() => {
    for (const end of openHandles) end();
  });
  openHandles.length = 0;
});

describe('loading store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing for work that finishes inside the show delay', () => {
    render(<GlobalLoadingOverlay />);

    const done = start();
    tick(SHOW_DELAY_MS - 20);
    expect(loader()).toBeNull();

    done();
    tick(1000);
    expect(loader()).toBeNull();
  });

  it('shows the loader once work outlasts the show delay', () => {
    render(<GlobalLoadingOverlay />);

    const done = start();
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    done();
    tick(MIN_VISIBLE_MS + 20);
    expect(loader()).toBeNull();
  });

  it('holds the loader for the minimum visible time after work ends', () => {
    render(<GlobalLoadingOverlay />);

    const done = start();
    tick(SHOW_DELAY_MS + 20);
    done();

    // Released almost immediately after appearing — but a card that flashes
    // for 20ms is worse than one that never appeared, so it stays.
    tick(MIN_VISIBLE_MS - 100);
    expect(loader()).not.toBeNull();

    tick(200);
    expect(loader()).toBeNull();
  });

  it('stays up until every concurrent task has been released', () => {
    render(<GlobalLoadingOverlay />);

    const first = start('Saving your profile');
    const second = start('Uploading your document');
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    first();
    tick(MIN_VISIBLE_MS + 200);
    // Second task is still in flight.
    expect(loader()).not.toBeNull();

    second();
    tick(MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });

  it('labels the overlay with the most recently started task', () => {
    render(<GlobalLoadingOverlay />);

    const first = start('Saving your profile');
    const second = start('Uploading your document');
    tick(SHOW_DELAY_MS + 20);

    // Twice by design: the visible line under the globe, and the live region.
    expect(screen.getAllByText('Uploading your document')).toHaveLength(2);
    expect(screen.queryByText('Saving your profile')).toBeNull();

    first();
    second();
    tick(MIN_VISIBLE_MS + 200);
  });

  it('releasing the same handle twice does not cancel another task', () => {
    render(<GlobalLoadingOverlay />);

    const first = start();
    first();
    first(); // idempotent — must not release `second`

    const second = start();
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    second();
    tick(MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });
});

describe('useLoadingIndicator', () => {
  function Busy({ active, label }: { active: boolean; label?: string }) {
    useLoadingIndicator(active, label);
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks the boolean it is given', () => {
    const { rerender } = render(
      <>
        <GlobalLoadingOverlay />
        <Busy active={false} />
      </>,
    );

    tick(SHOW_DELAY_MS + 20);
    expect(loader()).toBeNull();

    rerender(
      <>
        <GlobalLoadingOverlay />
        <Busy active label="Saving your profile" />
      </>,
    );
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    rerender(
      <>
        <GlobalLoadingOverlay />
        <Busy active={false} label="Saving your profile" />
      </>,
    );
    tick(MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });

  it('releases the overlay when a still-loading component unmounts', () => {
    // The real case: a form kicks off a save, then the user navigates away
    // before it resolves. Nothing is left to flip the boolean back, so the
    // cleanup is the only thing standing between this and a wedged page.
    const { rerender } = render(
      <>
        <GlobalLoadingOverlay />
        <Busy active />
      </>,
    );
    tick(SHOW_DELAY_MS + 20);
    expect(loader()).not.toBeNull();

    rerender(<GlobalLoadingOverlay />);
    tick(MIN_VISIBLE_MS + 200);
    expect(loader()).toBeNull();
  });

  it('does not restart the task when only the label changes identity', () => {
    // `t('Saving')` returns a fresh string every render; that must not tear
    // the task down and begin a new one, which would reset the show delay and
    // leave the loader permanently 180ms behind.
    const { rerender } = render(
      <>
        <GlobalLoadingOverlay />
        <Busy active label={'Saving your profile'.slice(0)} />
      </>,
    );

    tick(SHOW_DELAY_MS - 60);
    rerender(
      <>
        <GlobalLoadingOverlay />
        <Busy active label={'Saving your profile'.slice(0)} />
      </>,
    );
    tick(80);

    expect(loader()).not.toBeNull();

    rerender(<GlobalLoadingOverlay />);
    tick(MIN_VISIBLE_MS + 200);
  });
});

describe('GlobeLoader', () => {
  it('renders a phrase followed by three dots', () => {
    render(<GlobeLoader />);

    const phrase = screen.getByTestId('global-loader').querySelector('p');
    expect(phrase?.textContent).toMatch(/\.\.\.$/);

    const word = phrase?.textContent?.replace(/\.+$/, '');
    expect(LOADING_PHRASES.some((p) => p.en === word)).toBe(true);
  });

  it('announces the task, not the joke', () => {
    render(<GlobeLoader label="Saving your profile" />);

    // The rotating line is aria-hidden; the live region carries the label.
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.querySelector('.sr-only')?.textContent).toBe('Saving your profile');
    expect(status.querySelector('p[aria-hidden="true"]')).not.toBeNull();
  });

  it('falls back to a generic announcement with no label', () => {
    render(<GlobeLoader />);
    expect(screen.getByRole('status').querySelector('.sr-only')?.textContent).toBe('Loading');
  });

  it('plays the globe clip muted and inline, so mobile Safari autoplays it', () => {
    render(<GlobeLoader />);

    const video = screen.getByTestId('global-loader').querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', '/loading-globe.mp4');
    expect(video).toHaveAttribute('poster', '/loading-globe-poster.jpg');
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.hasAttribute('playsinline')).toBe(true);
  });
});

describe('route-level loaders', () => {
  it('LoadingScreen fills the page rather than floating over it', () => {
    const { container } = render(<LoadingScreen />);

    // A route's loading.tsx replaces the page content, so it occupies the
    // page; `fixed` here would leave the route behind it visible.
    const root = container.firstElementChild;
    expect(root?.className).toContain('min-h-screen');
    expect(root?.className).not.toContain('fixed');
    expect(loader()).not.toBeNull();
  });

  it('LoadingScreen passes a label through to the card', () => {
    render(<LoadingScreen label="Loading your applications" />);
    expect(screen.getAllByText('Loading your applications')).toHaveLength(2);
  });

  it('PageLoaderOverlay floats over a skeleton without eating clicks', () => {
    // Unlike the global overlay there is nothing underneath to protect, and
    // swallowing scroll on a full-page skeleton would be actively annoying.
    const { container } = render(<PageLoaderOverlay />);

    const root = container.firstElementChild;
    expect(root?.className).toContain('pointer-events-none');
    expect(root?.className).toContain('fixed');
    expect(loader()).not.toBeNull();
  });
});

describe('nextPhraseIndex', () => {
  it('never returns the phrase already on screen', () => {
    for (let current = 0; current < LOADING_PHRASES.length; current++) {
      for (let r = 0; r < 100; r++) {
        expect(nextPhraseIndex(current, () => r / 100)).not.toBe(current);
      }
    }
  });

  it('stays inside the list', () => {
    for (const random of [0, 0.5, 0.999999]) {
      const index = nextPhraseIndex(3, () => random);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(LOADING_PHRASES.length);
    }
  });

  it('can reach every other phrase', () => {
    const reached = new Set<number>();
    for (let r = 0; r < 1000; r++) {
      reached.add(nextPhraseIndex(0, () => r / 1000));
    }
    expect(reached.size).toBe(LOADING_PHRASES.length - 1);
  });
});

describe('loading phrases', () => {
  it('is bilingual, like the rest of the UI', () => {
    for (const phrase of LOADING_PHRASES) {
      expect(phrase.en.trim().length).toBeGreaterThan(0);
      expect(phrase.vi.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicates, which would read as the ticker having frozen', () => {
    const english = LOADING_PHRASES.map((p) => p.en);
    expect(new Set(english).size).toBe(english.length);
  });

  it('fits the two-line reserve the loader card sets aside', () => {
    // The card is 240px wide with 24px padding, so ~192px of text at 16px
    // Inter — about 24 characters a line, two lines available. A phrase that
    // needed a third line would make the centred card jump every time the
    // ticker fired. See PHRASE_TEXT in globe-loader.tsx.
    for (const phrase of LOADING_PHRASES) {
      expect(phrase.en.length, phrase.en).toBeLessThanOrEqual(44);
      expect(phrase.vi.length, phrase.vi).toBeLessThanOrEqual(44);
    }
  });

  it('never ends in punctuation — three dots are appended after it', () => {
    for (const phrase of LOADING_PHRASES) {
      expect(phrase.en).not.toMatch(/[.!?…]$/);
      expect(phrase.vi).not.toMatch(/[.!?…]$/);
    }
  });
});
