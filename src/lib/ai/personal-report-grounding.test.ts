import { describe, expect, it } from 'vitest';
import { isGroundedInSource } from './personal-report-v2';

describe('Personal Report factual grounding', () => {
  it('accepts a close paraphrase that preserves source facts', () => {
    expect(
      isGroundedInSource(
        'Founded a 12-person team that shared scholarship information.',
        'Founded a 12-person team and reached 350 students with scholarship information.',
      ),
    ).toBe(true);
  });

  it('rejects an extracted claim that invents a number absent from the source', () => {
    expect(
      isGroundedInSource(
        'Founded a 40-person team and reached 5,000 students.',
        'Founded a 12-person team and reached 350 students with scholarship information.',
      ),
    ).toBe(false);
  });

  it('rejects unrelated factual prose even when the source record itself is real', () => {
    expect(
      isGroundedInSource(
        'Published peer-reviewed cancer research with a university laboratory.',
        'Surveyed 500 students to find gaps in scholarship awareness.',
      ),
    ).toBe(false);
  });

  it('accepts a semantically supported activity interpretation', () => {
    expect(
      isGroundedInSource(
        'Identified an engagement problem and showed initiative by adapting an educational workshop.',
        'Students were losing interest, so I redesigned our financial literacy workshop into an interactive investment simulation.',
      ),
    ).toBe(true);
  });

  it('does not turn a redesign into unsupported founding or leadership ownership', () => {
    expect(
      isGroundedInSource(
        'Founded and led an educational organisation.',
        'Students were losing interest, so I redesigned our financial literacy workshop into an interactive investment simulation.',
      ),
    ).toBe(false);
  });
});
