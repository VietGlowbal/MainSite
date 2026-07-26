import { describe, expect, it } from 'vitest';
import { scholarshipCandidates } from '../saved-list';

type Option = { id: number; name: string };

function row(
  universityId: number,
  name: string,
  options: Option[],
  attached: Array<{ id: number }> = [],
) {
  return { universityId, name, options, attached };
}

const MIT = row(1, 'MIT', [
  { id: 10, name: 'Presidential Fellowship' },
  { id: 11, name: 'Need-based grant' },
]);
const OXFORD = row(2, 'University of Oxford', [{ id: 20, name: 'Clarendon' }]);

describe('scholarshipCandidates', () => {
  it('returns nothing when no university is ticked', () => {
    expect(scholarshipCandidates([MIT, OXFORD], [])).toEqual([]);
  });

  it('only offers scholarships from the ticked universities', () => {
    const result = scholarshipCandidates([MIT, OXFORD], [2]);
    expect(result.map((c) => c.option.id)).toEqual([20]);
    expect(result[0]?.universityName).toBe('University of Oxford');
  });

  it('carries the university each scholarship belongs to', () => {
    const result = scholarshipCandidates([MIT, OXFORD], [1, 2]);
    expect(result.map((c) => [c.universityId, c.option.id])).toEqual([
      [1, 10],
      [1, 11],
      [2, 20],
    ]);
  });

  it('drops scholarships already attached to that university', () => {
    const withAttached = row(1, 'MIT', MIT.options, [{ id: 10 }]);
    const result = scholarshipCandidates([withAttached], [1]);
    expect(result.map((c) => c.option.id)).toEqual([11]);
  });

  it('yields an empty list when every option is already attached', () => {
    const withAttached = row(1, 'MIT', MIT.options, [{ id: 10 }, { id: 11 }]);
    expect(scholarshipCandidates([withAttached], [1])).toEqual([]);
  });

  it('ignores ticks for universities that are no longer in the list', () => {
    // The page removes rows optimistically, so a stale selection is reachable.
    expect(scholarshipCandidates([OXFORD], [1, 2]).map((c) => c.option.id)).toEqual([20]);
  });

  it('handles a university with no linked scholarships', () => {
    expect(scholarshipCandidates([row(3, 'Sorbonne', [])], [3])).toEqual([]);
  });
});
