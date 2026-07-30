import { describe, expect, it } from 'vitest';
import { attachedOptions, bestCoveragePercent, scholarshipCandidates } from '../saved-list';

type Option = { id: number; name: string };

type Covered = {
  id: number;
  name: string;
  coverage: string | null;
  fundingType: string[] | null;
};

function covered(
  universityId: number,
  options: Covered[],
  attachedIds: number[] = [],
): { universityId: number; name: string; options: Covered[]; attached: Array<{ id: number }> } {
  return {
    universityId,
    name: `University ${universityId}`,
    options,
    attached: attachedIds.map((id) => ({ id })),
  };
}

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

describe('attachedOptions', () => {
  const full: Covered = { id: 10, name: 'Full ride', coverage: '100% tuition', fundingType: null };
  const half: Covered = { id: 11, name: 'Half', coverage: '50% of tuition', fundingType: null };

  it('joins the attached ids back onto the full options', () => {
    expect(attachedOptions(covered(1, [full, half], [11]))).toEqual([half]);
  });

  it('returns nothing when the student has attached nothing', () => {
    expect(attachedOptions(covered(1, [full, half]))).toEqual([]);
  });

  it('skips an attached award that is no longer linked to the university', () => {
    // Reachable: the directory link can be removed after the student attached
    // it. Defaulting a coverage here would print an invented discount.
    expect(attachedOptions(covered(1, [full], [999]))).toEqual([]);
  });
});

describe('bestCoveragePercent', () => {
  it('reads the percentage out of a coverage sentence', () => {
    const row1 = covered(1, [{ id: 1, name: 'A', coverage: '50% of tuition', fundingType: null }], [1]);
    expect(bestCoveragePercent([row1])).toBe(50);
  });

  it('takes the best single award, never a sum', () => {
    // 50% of one university's bill plus 50% of another's is not 100% off.
    const a = covered(1, [{ id: 1, name: 'A', coverage: '50% tuition', fundingType: null }], [1]);
    const b = covered(2, [{ id: 2, name: 'B', coverage: '50% tuition', fundingType: null }], [2]);
    expect(bestCoveragePercent([a, b])).toBe(50);
  });

  it('prefers the largest percentage across rows', () => {
    const a = covered(1, [{ id: 1, name: 'A', coverage: '25% tuition', fundingType: null }], [1]);
    const b = covered(2, [{ id: 2, name: 'B', coverage: '80% tuition', fundingType: null }], [2]);
    expect(bestCoveragePercent([a, b])).toBe(80);
  });

  it('recognises full-ride funding with no number in the prose', () => {
    const row1 = covered(
      1,
      [{ id: 1, name: 'A', coverage: 'Covers everything', fundingType: ['full-ride'] }],
      [1],
    );
    expect(bestCoveragePercent([row1])).toBe(100);
  });

  it('returns null for a cash award, rather than converting it to a percentage', () => {
    // "2,000USD" reduces a bill without being a proportion of one, and the size
    // of the bill is free prose we cannot divide by reliably.
    const row1 = covered(
      1,
      [{ id: 1, name: 'A', coverage: 'USD 2,000 towards fees', fundingType: null }],
      [1],
    );
    expect(bestCoveragePercent([row1])).toBeNull();
  });

  it('ignores percentages on awards the student has not attached', () => {
    const row1 = covered(1, [{ id: 1, name: 'A', coverage: '100% tuition', fundingType: null }]);
    expect(bestCoveragePercent([row1])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(bestCoveragePercent([])).toBeNull();
  });
});
