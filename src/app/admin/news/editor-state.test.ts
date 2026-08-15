import { describe, expect, it } from 'vitest';
import { hasUnsavedRevision, uploadedImageTarget } from './editor-state';

describe('News editor autosave state', () => {
  it('keeps newer edits dirty after an older request completes', () => {
    expect(hasUnsavedRevision(4, 4)).toBe(false);
    expect(hasUnsavedRevision(4, 5)).toBe(true);
  });

  it('does not replace the hero when an inline image is uploaded', () => {
    expect(uploadedImageTarget('inline', '/hero.webp', '/inline.webp')).toEqual({
      heroImage: '/hero.webp',
      inlineImageUrl: '/inline.webp',
    });
    expect(uploadedImageTarget('hero', '/old.webp', '/new.webp')).toEqual({
      heroImage: '/new.webp',
      inlineImageUrl: null,
    });
  });
});
