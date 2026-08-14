import { describe, expect, it } from 'vitest';
import { validateArticleForPublish } from './geo-cms-validation';

describe('validateArticleForPublish', () => {
  it('accepts a complete article with an accessible hero image', () => {
    expect(validateArticleForPublish({
      title: 'A useful article',
      description: 'A concise summary.',
      body: 'Body copy.',
      topic: 'Universities',
      hero_image: 'https://cdn.example.com/hero.webp',
      meta: { heroImageAlt: 'Students on a campus' },
    })).toEqual([]);
  });

  it('returns actionable errors for missing publish requirements', () => {
    expect(validateArticleForPublish({
      title: '',
      description: null,
      body: '  ',
      topic: 'All topics',
      hero_image: null,
      meta: {},
    })).toEqual([
      'Title is required',
      'Description is required',
      'Body is required',
      'Topic is required',
      'Hero image is required',
      'Hero image alt text is required',
    ]);
  });

  it('rejects an alt text value that is present but blank', () => {
    expect(validateArticleForPublish({
      title: 'A useful article',
      description: 'A concise summary.',
      body: 'Body copy.',
      topic: 'Universities',
      hero_image: '/news/hero.webp',
      meta: { heroImageAlt: '   ' },
    })).toContain('Hero image alt text is required');
  });

  it('rejects inline images with empty alt text', () => {
    expect(validateArticleForPublish({
      title: 'A useful article',
      description: 'A concise summary.',
      body: 'Body copy.\n\n![](https://cdn.example.com/inline.webp)',
      topic: 'Universities',
      hero_image: '/news/hero.webp',
      meta: { heroImageAlt: 'Students on campus' },
    })).toContain('Every inline image needs alt text');
  });
});
