import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReflectionBreadcrumb } from './reflection-breadcrumb';

/**
 * Guards the spec's central breadcrumb requirements: it renders whatever
 * hierarchy the caller currently derives from reflection state (e.g.
 * Application / Experiences / Entrepreneurship Club / Challenge), the last
 * item is the non-clickable current position, every earlier item stays
 * clickable, and the compact mobile pattern renders instead below `sm`.
 */
describe('ReflectionBreadcrumb', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<ReflectionBreadcrumb items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks only the last item as the current, non-interactive position', () => {
    render(
      <ReflectionBreadcrumb
        items={[
          { label: 'Cambridge · Computer Science', onClick: vi.fn() },
          { label: 'Experiences', onClick: vi.fn() },
          { label: 'Entrepreneurship Club', onClick: vi.fn() },
          { label: 'Challenge' },
        ]}
      />,
    );

    const current = screen.getByText('Challenge');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).not.toBe('BUTTON');

    for (const label of ['Cambridge · Computer Science', 'Experiences', 'Entrepreneurship Club']) {
      expect(screen.getByRole('button', { name: label })).toBeVisible();
    }
  });

  it('exposes proper breadcrumb semantics for assistive tech', () => {
    render(<ReflectionBreadcrumb items={[{ label: 'Experiences', onClick: vi.fn() }, { label: 'Challenge' }]} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('clicking an earlier item invokes its own onClick, not the last item’s', () => {
    const onExperiences = vi.fn();
    const onActivity = vi.fn();
    render(
      <ReflectionBreadcrumb
        items={[
          { label: 'Experiences', onClick: onExperiences },
          { label: 'Entrepreneurship Club', onClick: onActivity },
          { label: 'Challenge' },
        ]}
      />,
    );

    screen.getByRole('button', { name: 'Entrepreneurship Club' }).click();
    expect(onActivity).toHaveBeenCalledTimes(1);
    expect(onExperiences).not.toHaveBeenCalled();
  });

  it('renders the compact mobile "← back / title · meta" pattern when given', () => {
    const onBack = vi.fn();
    render(
      <ReflectionBreadcrumb
        items={[{ label: 'Experiences', onClick: vi.fn() }, { label: 'Challenge' }]}
        mobile={{
          backLabel: 'Entrepreneurship Club',
          onBack,
          title: 'Challenge',
          meta: '3 of 7',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /Entrepreneurship Club/ })).toBeVisible();
    expect(screen.getByText('3 of 7')).toBeVisible();
    screen.getByRole('button', { name: /Entrepreneurship Club/ }).click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
