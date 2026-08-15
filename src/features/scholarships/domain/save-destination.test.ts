import { describe, expect, it } from 'vitest';
import { scholarshipSaveDestination } from './save-destination';

describe('scholarshipSaveDestination', () => {
  it('automatically chooses the only linked university', () => {
    expect(scholarshipSaveDestination([42])).toEqual({
      kind: 'automatic',
      universityId: 42,
    });
  });

  it('requires a choice when several universities are linked', () => {
    expect(scholarshipSaveDestination([42, 7, 42])).toEqual({
      kind: 'choose-linked',
      universityIds: [42, 7],
    });
  });

  it('uses the directory choice for unlinked awards', () => {
    expect(scholarshipSaveDestination([])).toEqual({ kind: 'choose-directory' });
  });
});
