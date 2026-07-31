import { describe, expect, it } from 'vitest';
import { isLorTask } from './is-lor-task';

describe('isLorTask', () => {
  it.each([
    'Request a letter of recommendation',
    'Add an academic reference',
    'Contact your referee',
    'Choose a recommender',
    'Upload LOR',
  ])('recognises %s', (title) => {
    expect(isLorTask({ title })).toBe(true);
  });

  it('does not treat a general recommendation as an LOR task', () => {
    expect(isLorTask({ title: 'Review our course recommendations' })).toBe(false);
  });
});
