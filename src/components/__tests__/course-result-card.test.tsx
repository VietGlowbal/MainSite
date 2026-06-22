import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseResultCard } from '../course-result-card';

describe('CourseResultCard', () => {
  const mockResult = {
    universityId: 1,
    courseName: 'Computer Science BSc',
    courseUrl: 'https://example.com/courses/cs',
    sourceDomain: 'example.com',
    snippet: 'A comprehensive computer science degree covering software engineering, algorithms, and more.',
    degreeLevel: 'Undergraduate',
    duration: '3 years',
    tuitionFeeText: '£9,250 per year',
    confidenceLabel: 'Checked recently',
    sourceConfidence: 0.95,
    rank: 1,
    sourceType: 'cached' as const,
  };

  it('renders course name', () => {
    render(<CourseResultCard result={mockResult} />);
    expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
  });

  it('renders snippet', () => {
    render(<CourseResultCard result={mockResult} />);
    expect(screen.getByText(/comprehensive computer science degree/i)).toBeInTheDocument();
  });

  it('renders confidence badge', () => {
    render(<CourseResultCard result={mockResult} />);
    expect(screen.getByText('Checked recently')).toBeInTheDocument();
  });

  it('renders source domain', () => {
    render(<CourseResultCard result={mockResult} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('renders metadata (degree level, duration, tuition)', () => {
    render(<CourseResultCard result={mockResult} />);
    expect(screen.getByText('Undergraduate')).toBeInTheDocument();
    expect(screen.getByText('3 years')).toBeInTheDocument();
    expect(screen.getByText('£9,250 per year')).toBeInTheDocument();
  });

  it('renders view official page link', () => {
    render(<CourseResultCard result={mockResult} />);
    const link = screen.getByRole('link', { name: /view official page/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/courses/cs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not render checkbox when not selectable', () => {
    render(<CourseResultCard result={mockResult} selectable={false} />);
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    expect(card).not.toBeInTheDocument();
  });

  it('renders checkbox when selectable', () => {
    render(<CourseResultCard result={mockResult} selectable={true} />);
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    expect(card).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    const onSelect = vi.fn();
    render(<CourseResultCard result={mockResult} selectable={true} onSelect={onSelect} />);
    
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    if (card) {
      fireEvent.click(card);
    }
    
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when Enter key is pressed', () => {
    const onSelect = vi.fn();
    render(<CourseResultCard result={mockResult} selectable={true} onSelect={onSelect} />);
    
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    if (card) {
      fireEvent.keyDown(card, { key: 'Enter' });
    }
    
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when Space key is pressed', () => {
    const onSelect = vi.fn();
    render(<CourseResultCard result={mockResult} selectable={true} onSelect={onSelect} />);
    
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    if (card) {
      fireEvent.keyDown(card, { key: ' ' });
    }
    
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows selected state visually when selected', () => {
    const { container } = render(
      <CourseResultCard result={mockResult} selectable={true} selected={true} />
    );
    
    // Check for selected border and background classes
    const card = container.querySelector('.border-pink-500');
    expect(card).toBeInTheDocument();
  });

  it('does not call onSelect when clicking view official page link', () => {
    const onSelect = vi.fn();
    render(<CourseResultCard result={mockResult} selectable={true} onSelect={onSelect} />);
    
    const link = screen.getByRole('link', { name: /view official page/i });
    fireEvent.click(link);
    
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('handles missing optional metadata gracefully', () => {
    const resultWithoutMetadata = {
      ...mockResult,
      degreeLevel: undefined,
      duration: undefined,
      tuitionFeeText: undefined,
    };
    
    render(<CourseResultCard result={resultWithoutMetadata} />);
    expect(screen.getByText('Computer Science BSc')).toBeInTheDocument();
  });

  it('applies correct confidence badge color for "Checked recently"', () => {
    const { container } = render(<CourseResultCard result={mockResult} />);
    const badge = container.querySelector('.bg-green-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Checked recently');
  });

  it('applies correct confidence badge color for "Good match"', () => {
    const resultGoodMatch = { ...mockResult, confidenceLabel: 'Good match' };
    const { container } = render(<CourseResultCard result={resultGoodMatch} />);
    const badge = container.querySelector('.bg-blue-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Good match');
  });

  it('applies correct confidence badge color for "Needs review"', () => {
    const resultNeedsReview = { ...mockResult, confidenceLabel: 'Needs review' };
    const { container } = render(<CourseResultCard result={resultNeedsReview} />);
    const badge = container.querySelector('.bg-amber-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Needs review');
  });

  it('applies correct confidence badge color for "Needs refresh"', () => {
    const resultNeedsRefresh = { ...mockResult, confidenceLabel: 'Needs refresh' };
    const { container } = render(<CourseResultCard result={resultNeedsRefresh} />);
    const badge = container.querySelector('.bg-slate-100');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Needs refresh');
  });

  it('has proper accessibility attributes for selectable card', () => {
    render(<CourseResultCard result={mockResult} selectable={true} />);
    const card = screen.getByText('Computer Science BSc').closest('div[role="button"]');
    expect(card).toHaveAttribute('tabIndex', '0');
    expect(card).toHaveAttribute('role', 'button');
  });

  it('truncates long course names with line-clamp-2', () => {
    const longNameResult = {
      ...mockResult,
      courseName: 'Very Long Computer Science and Software Engineering with Artificial Intelligence and Machine Learning Degree Programme',
    };
    
    const { container } = render(<CourseResultCard result={longNameResult} />);
    const heading = container.querySelector('h3');
    expect(heading).toHaveClass('line-clamp-2');
  });

  it('truncates long snippets with line-clamp-3', () => {
    const longSnippetResult = {
      ...mockResult,
      snippet: 'This is a very long snippet that should be truncated. '.repeat(10),
    };
    
    const { container } = render(<CourseResultCard result={longSnippetResult} />);
    const snippet = container.querySelector('p.line-clamp-3');
    expect(snippet).toBeInTheDocument();
  });
});
