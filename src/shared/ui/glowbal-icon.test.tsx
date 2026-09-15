import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlowbalIcon, IconLabel } from './glowbal-icon';
import { GLOWBAL_ICONS } from './glowbal-icon-art';
import type { GlowbalIconName } from './glowbal-icon-art';
import { GLOWBAL_ICONS as PLAN_ICONS, GLOWBAL_ICON_BOX } from './glowbal-icons';
import { GLOWBAL_SHIPPED_ICONS } from './glowbal-icons-shipped';

const NAMES = Object.keys(GLOWBAL_ICONS) as GlowbalIconName[];

describe('GLOWBAL_ICONS', () => {
  it('carries the 72 plan icons and the 27 redrawn shipped icons', () => {
    expect(Object.keys(PLAN_ICONS)).toHaveLength(72);
    expect(Object.keys(GLOWBAL_SHIPPED_ICONS)).toHaveLength(27);
    expect(NAMES).toHaveLength(99);
  });

  // The merge is a spread: a shared key would silently replace one icon with another.
  it('never lets a shipped icon shadow a plan icon', () => {
    const plan = new Set(Object.keys(PLAN_ICONS));
    expect(Object.keys(GLOWBAL_SHIPPED_ICONS).filter((key) => plan.has(key))).toEqual([]);
  });

  // The tone model is the whole system: an icon with no accent cannot name its
  // function, and one that is all accent is just a red icon.
  it('draws every icon in both tones', () => {
    const offenders = NAMES.filter((name) => {
      const tones = new Set(GLOWBAL_ICONS[name].map((el) => el.tone));
      return !(tones.has('ink') && tones.has('accent'));
    });
    expect(offenders).toEqual([]);
  });

  it('keeps circles and rects inside the icon box', () => {
    const offenders = NAMES.filter((name) =>
      GLOWBAL_ICONS[name].some((el) => {
        if (el.t === 'circle') {
          return el.cx - el.r < 0 || el.cy - el.r < 0 || el.cx + el.r > GLOWBAL_ICON_BOX || el.cy + el.r > GLOWBAL_ICON_BOX;
        }
        if (el.t === 'rect') {
          return el.x < 0 || el.y < 0 || el.x + el.width > GLOWBAL_ICON_BOX || el.y + el.height > GLOWBAL_ICON_BOX;
        }
        return false;
      }),
    );
    expect(offenders).toEqual([]);
  });
});

describe('GlowbalIcon', () => {
  it('renders one svg element per art element for every icon', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<GlowbalIcon name={name} />);
      expect(container.querySelector('svg')?.children).toHaveLength(GLOWBAL_ICONS[name].length);
      unmount();
    }
  });

  it('paints the accent detail only in two-tone', () => {
    // newsArticle: frame (ink), picture box (accent), text lines (ink).
    const { container, rerender } = render(<GlowbalIcon name="newsArticle" />);
    const strokes = () =>
      Array.from(container.querySelectorAll('svg > *'), (el) => el.getAttribute('class'));

    expect(strokes()).toEqual(['stroke-icon-ink', 'stroke-icon-accent', 'stroke-icon-ink']);

    rerender(<GlowbalIcon name="newsArticle" tone="mono" />);
    expect(strokes()).toEqual(['stroke-icon-ink', 'stroke-icon-ink', 'stroke-icon-ink']);

    // current: both tones follow the text colour, so a control's hover state reaches it.
    rerender(<GlowbalIcon name="newsArticle" tone="current" />);
    expect(strokes()).toEqual(['stroke-current', 'stroke-current', 'stroke-current']);
  });

  it('renders at the requested size on the 24px art box', () => {
    const { container } = render(<GlowbalIcon name="compare" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('is hidden from assistive tech unless it is the whole control', () => {
    const { container, rerender } = render(<GlowbalIcon name="delete" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    rerender(<GlowbalIcon name="delete" label="Remove document" />);
    expect(screen.getByRole('img', { name: 'Remove document' })).toBeInTheDocument();
  });
});

describe('IconLabel', () => {
  it('is valid inside a button, and the label names it', () => {
    render(
      <button type="button">
        <IconLabel name="edit" label="Edit" />
      </button>,
    );
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.querySelector('div')).toBeNull();
  });

  it.each([
    ['nav', '20'],
    ['row', '24'],
    ['meta', '16'],
  ] as const)('left/%s draws the icon at %spx', (density, size) => {
    const { container } = render(<IconLabel name="edit" label="Edit" density={density} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', size);
  });

  it.each([
    ['card', '40'],
    ['grid', '32'],
    ['empty', '48'],
  ] as const)('top/%s draws the icon at %spx', (density, size) => {
    const { container } = render(
      <IconLabel layout="top" name="emptyState" label="Nothing saved yet" density={density} />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('width', size);
  });

  it('renders the description as a second line', () => {
    render(
      <IconLabel
        layout="top"
        name="applicationTracker"
        label="My Application"
        description="Track applications and deadlines."
      />,
    );
    expect(screen.getByText('My Application')).toBeInTheDocument();
    expect(screen.getByText('Track applications and deadlines.')).toBeInTheDocument();
  });
});
