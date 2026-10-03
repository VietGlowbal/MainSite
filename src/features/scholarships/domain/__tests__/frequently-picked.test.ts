import { describe, expect, it } from 'vitest';
import {
  aggregateFrequentlyPicked,
  DEFAULT_FREQUENTLY_PICKED_POLICY,
  validateFrequentlyPickedPolicy,
} from '../frequently-picked';

const policy = { version: 'test-frequently-picked-v1', threshold: 2 };

describe('frequently-picked aggregation', () => {
  it('counts distinct current users and preserves zero-count scholarships', () => {
    const result = aggregateFrequentlyPicked(
      [
        { scholarshipId: 7, userId: 'user-1', universityId: 42 },
        { scholarshipId: 7, userId: 'user-1', universityId: 99 },
        { scholarshipId: 7, userId: 'user-2', universityId: 42 },
        { scholarshipId: 8, userId: 'user-1' },
      ],
      [7, 8, 9],
      policy,
    );

    expect(result).toEqual({
      '7': { count: 2, threshold: 2, isFrequentlyPicked: true },
      '8': { count: 1, threshold: 2, isFrequentlyPicked: false },
      '9': { count: 0, threshold: 2, isFrequentlyPicked: false },
    });
  });

  it('applies the threshold at the exact boundary', () => {
    const atBoundary = aggregateFrequentlyPicked(
      [{ scholarshipId: 7, userId: 'user-1' }, { scholarshipId: 7, userId: 'user-2' }],
      [7],
      policy,
    );
    const belowBoundary = aggregateFrequentlyPicked(
      [{ scholarshipId: 7, userId: 'user-1' }],
      [7],
      policy,
    );

    expect(atBoundary['7']?.isFrequentlyPicked).toBe(true);
    expect(belowBoundary['7']?.isFrequentlyPicked).toBe(false);
  });

  it('counts one user once even when duplicate university-context rows exist', () => {
    const result = aggregateFrequentlyPicked(
      [
        { scholarshipId: 7, userId: 'user-1' },
        { scholarshipId: 7, userId: 'user-1' },
        { scholarshipId: 7, userId: 'user-2' },
      ],
      [7],
      { version: policy.version, threshold: 3 },
    );

    expect(result['7']).toEqual({ count: 2, threshold: 3, isFrequentlyPicked: false });
  });

  it('reflects current save and remove semantics without historical state', () => {
    const beforeSave = [{ scholarshipId: 7, userId: 'user-1' }];
    const afterSave = [...beforeSave, { scholarshipId: 7, userId: 'user-2' }];
    const afterRemove = afterSave.filter((row) => row.userId !== 'user-1');

    expect(aggregateFrequentlyPicked(beforeSave, [7], policy)['7']?.count).toBe(1);
    expect(aggregateFrequentlyPicked(afterSave, [7], policy)['7']?.count).toBe(2);
    expect(aggregateFrequentlyPicked(afterRemove, [7], policy)['7']?.count).toBe(1);
  });

  it('does not expose user ids in the output contract', () => {
    const result = aggregateFrequentlyPicked(
      [{ scholarshipId: 7, userId: 'private-user-id' }],
      [7],
      policy,
    );

    expect(JSON.stringify(result)).not.toContain('private-user-id');
    expect(Object.keys(result['7'] ?? {}).sort()).toEqual([
      'count',
      'isFrequentlyPicked',
      'threshold',
    ]);
  });

  it('validates versioned threshold configuration', () => {
    expect(validateFrequentlyPickedPolicy(DEFAULT_FREQUENTLY_PICKED_POLICY)).toEqual(
      DEFAULT_FREQUENTLY_PICKED_POLICY,
    );
    expect(() => validateFrequentlyPickedPolicy({ version: '', threshold: 2 })).toThrow(/version/i);
    expect(() => validateFrequentlyPickedPolicy({ version: 'test', threshold: 0 })).toThrow(/threshold/i);
    expect(() => validateFrequentlyPickedPolicy({ version: 'test', threshold: 1.5 })).toThrow(/threshold/i);
  });
});
