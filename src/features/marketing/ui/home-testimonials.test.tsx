import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeTestimonials } from './home-testimonials';

describe('HomeTestimonials', () => {
  it('renders the dark testimonial layout with three illustrative portraits', () => {
    const { container } = render(<HomeTestimonials />);

    const label = screen.getByText('Testimonials');
    expect(label).toHaveClass('text-gb-display-xs');
    expect(label.closest('section')).toHaveClass('bg-surface-inverse-strong');

    expect(container.querySelectorAll('figure')).toHaveLength(3);
    expect(screen.getAllByText('Anonymous student')).toHaveLength(3);
    expect(screen.getAllByText('Illustrative portrait')).toHaveLength(3);

    const portraits = [...container.querySelectorAll('img')];
    expect(portraits).toHaveLength(3);
    expect(portraits.map((portrait) => portrait.getAttribute('src'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('vietnamese-student-01.webp'),
        expect.stringContaining('vietnamese-student-02.webp'),
        expect.stringContaining('vietnamese-student-03.webp'),
      ]),
    );
    expect(portraits.every((portrait) => portrait.getAttribute('alt') === '')).toBe(true);
  });
});
