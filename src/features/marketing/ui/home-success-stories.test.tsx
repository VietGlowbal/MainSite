import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeSuccessStories } from './home-success-stories';
import { SUCCESS_STORY_FEATURE, SUCCESS_STORY_VOICES } from './success-stories-content';

/**
 * These cover the four things about this section that can rot silently — a
 * regression in any of them still renders a plausible-looking wall of quotes,
 * which is exactly why they are worth asserting rather than eyeballing.
 */
describe('HomeSuccessStories', () => {
  it('renders every voice whole, with the students’ own punctuation intact', () => {
    const { container } = render(<HomeSuccessStories locale="vi" />);

    const quotes = [...container.querySelectorAll('blockquote')];
    expect(quotes).toHaveLength(SUCCESS_STORY_VOICES.length);

    /* The section's whole claim is that these are real students talking, and
       `=))))` is most of the evidence. A truncation or a "tidy-up" pass would
       take it first, so it is pinned here — see the ⚠️ in
       success-stories-content.ts. */
    const text = quotes.map((quote) => quote.textContent ?? '');
    expect(text.some((quote) => quote.includes(':)))'))).toBe(true);
    expect(text.some((quote) => quote.endsWith('=))))'))).toBe(true);

    // Whole, not clipped: every quote matches its source string exactly.
    expect(text).toEqual(SUCCESS_STORY_VOICES.map((voice) => voice.quote.vi));
  });

  it('picks the language by locale and only flags the translation under en', () => {
    const { unmount } = render(<HomeSuccessStories locale="en" />);
    expect(screen.getByText(SUCCESS_STORY_VOICES[0]!.quote.en)).toBeInTheDocument();
    expect(screen.getByText('Quotes translated from Vietnamese.')).toBeInTheDocument();
    unmount();

    render(<HomeSuccessStories locale="vi" />);
    expect(screen.getByText(SUCCESS_STORY_VOICES[0]!.quote.vi)).toBeInTheDocument();
    // Under `vi` the quote IS the student's words, so the note would be a lie.
    expect(screen.queryByText('Quotes translated from Vietnamese.')).not.toBeInTheDocument();
  });

  it('leaves the magnitude gutter empty rather than inventing a figure', () => {
    const { container } = render(<HomeSuccessStories locale="en" />);

    const rows = [...container.querySelectorAll<HTMLElement>('article ul > li')];
    expect(rows).toHaveLength(SUCCESS_STORY_FEATURE.awards.length);

    for (const [index, award] of SUCCESS_STORY_FEATURE.awards.entries()) {
      const row = rows[index]!;
      expect(within(row).getByText(award.institution)).toBeInTheDocument();
      const gutter = row.firstElementChild!;
      expect(gutter.textContent).toBe(award.magnitude ?? '');
    }

    // One student's school was never supplied; the line is absent, not blank.
    const withoutSchool = SUCCESS_STORY_VOICES.filter((voice) => voice.school === null);
    expect(withoutSchool).not.toHaveLength(0);
    for (const voice of withoutSchool) {
      const footer = screen.getByText(voice.name).closest('footer')!;
      expect(footer.querySelectorAll('span')).toHaveLength(1);
    }
  });

  it('counts its own content and survives having no media to show', () => {
    const { container, unmount } = render(<HomeSuccessStories locale="en" />);

    /* The wall heading states a number. If it were hard-coded, removing a
       student would leave the page claiming a count it no longer shows. */
    expect(
      screen.getByRole('heading', {
        name: `${SUCCESS_STORY_VOICES.length} students, on what GlowBal changed for them`,
      }),
    ).toBeInTheDocument();

    // No media today: one column, capped, and NO placeholder standing in for
    // the video that has not arrived. See departure 2 in the component header.
    const card = container.querySelector('article')!;
    expect(card.className).toContain('lg:max-w-[880px]');
    expect(card.querySelector('img')).toBeNull();
    unmount();

    // With media the cap lifts and the second column is real content.
    const withMedia = render(
      <HomeSuccessStories locale="en" media={<div data-testid="chi-video" />} />,
    );
    const filled = withMedia.container.querySelector('article')!;
    expect(filled.className).not.toContain('lg:max-w-[880px]');
    expect(withMedia.getByTestId('chi-video')).toBeInTheDocument();
  });
});
