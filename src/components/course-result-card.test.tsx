import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseResultCard } from './course-result-card';

describe('CourseResultCard - Task 11.3: Checkbox Selection', () => {
  const mockResult = {
    universityId: 1,
    courseName: 'Computer Science',
    courseUrl: 'https://example.com/course',
    sourceDomain: 'example.com',
    snippet: 'A comprehensive computer science program',
    degreeLevel: 'Bachelor',
    duration: '4 years',
    tuitionFeeText: '$20,000/year',
    confidenceLabel: 'Good match',
    sourceConfidence: 0.85,
    rank: 1,
    sourceType: 'cached' as const,
  };

  describe('Card clickability', () => {
    it('should call onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={onSelect}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onSelect when "View official page" link is clicked', () => {
      const onSelect = vi.fn();
      render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={onSelect}
        />
      );

      const link = screen.getByText('View official page');
      fireEvent.click(link);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should not be clickable when selectable is false', () => {
      const onSelect = vi.fn();
      render(
        <CourseResultCard
          result={mockResult}
          selectable={false}
          selected={false}
          onSelect={onSelect}
        />
      );

      const card = screen.queryByRole('button');
      expect(card).toBeNull();
    });
  });

  describe('Visual selected state', () => {
    it('should show border highlight and background tint when selected', () => {
      const { container } = render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={true}
          onSelect={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-pink-500');
      expect(card.className).toContain('bg-pink-50/50');
      expect(card.className).toContain('ring-2');
      expect(card.className).toContain('ring-pink-100');
    });

    it('should show default border when not selected', () => {
      const { container } = render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('border-slate-200');
      expect(card.className).toContain('bg-white');
    });

    it('should show checkmark icon when selected', () => {
      render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={true}
          onSelect={() => {}}
        />
      );

      // Check for SVG checkmark
      const svg = screen.getByRole('button').querySelector('svg[stroke="white"]');
      expect(svg).toBeTruthy();
    });
  });

  describe('Keyboard accessibility', () => {
    it('should toggle selection on Enter key', () => {
      const onSelect = vi.fn();
      render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={onSelect}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('should toggle selection on Space key', () => {
      const onSelect = vi.fn();
      render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={onSelect}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: ' ' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hover states', () => {
    it('should have hover classes when selectable', () => {
      const { container } = render(
        <CourseResultCard
          result={mockResult}
          selectable={true}
          selected={false}
          onSelect={() => {}}
        />
      );

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:border-pink-300');
      expect(card.className).toContain('hover:bg-pink-50/30');
    });
  });
});
