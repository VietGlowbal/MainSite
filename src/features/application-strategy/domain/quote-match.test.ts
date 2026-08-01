import { describe, expect, it } from 'vitest';
import { buildHighlightRuns, matchQuote } from './quote-match';

/**
 * These tests exist for one property: feedback never points at the wrong text.
 * The interesting cases are all failures — a quote that moved, a quote that was
 * deleted, a quote that now appears twice — because the success case was never
 * the risk.
 */
describe('matchQuote', () => {
  const text = 'I want to study data science. My internship taught me to clean messy data.';

  it('trusts offsets that still hold', () => {
    const start = text.indexOf('My internship');
    const result = matchQuote(text, {
      quote: 'My internship taught me to clean messy data.',
      quoteStart: start,
      quoteEnd: start + 'My internship taught me to clean messy data.'.length,
    });
    expect(result).toEqual({
      kind: 'offset',
      start,
      end: start + 'My internship taught me to clean messy data.'.length,
    });
  });

  it('re-matches verbatim when the offsets have shifted', () => {
    // The student added a sentence at the front, so every recorded offset is now
    // 30 characters early.
    const edited = `I have always liked numbers. ${text}`;
    const result = matchQuote(edited, {
      quote: 'My internship taught me to clean messy data.',
      quoteStart: text.indexOf('My internship'),
      quoteEnd: text.indexOf('My internship') + 44,
    });
    expect(result.kind).toBe('rematched');
    if (result.kind !== 'unmatched') {
      expect(edited.slice(result.start, result.end)).toBe(
        'My internship taught me to clean messy data.',
      );
    }
  });

  it('re-matches when only whitespace changed', () => {
    const edited = text.replace('study data science.', 'study data\n  science.');
    const result = matchQuote(edited, { quote: 'study data science.', quoteStart: 10, quoteEnd: 29 });
    expect(result.kind).toBe('rematched');
    if (result.kind !== 'unmatched') {
      // The range covers the real characters, newline and all — not an offset
      // computed against the normalised string.
      expect(edited.slice(result.start, result.end)).toBe('study data\n  science.');
    }
  });

  it('gives up when the quote was deleted', () => {
    const result = matchQuote('Something else entirely.', {
      quote: 'My internship taught me to clean messy data.',
      quoteStart: 29,
      quoteEnd: 73,
    });
    expect(result).toEqual({ kind: 'unmatched' });
  });

  it('gives up on an ambiguous duplicate rather than guessing', () => {
    const duplicated = 'I love data. I love data.';
    const result = matchQuote(duplicated, { quote: 'I love data.' });
    expect(result).toEqual({ kind: 'unmatched' });
  });

  it('resolves a duplicate when the recorded offset is decisively nearer one', () => {
    const duplicated = `I love data. ${'filler '.repeat(40)}I love data.`;
    const second = duplicated.lastIndexOf('I love data.');
    const result = matchQuote(duplicated, {
      quote: 'I love data.',
      // Two characters off the second occurrence, and 300 off the first.
      quoteStart: second + 2,
      quoteEnd: second + 14,
    });
    expect(result.kind).toBe('rematched');
    if (result.kind !== 'unmatched') expect(result.start).toBe(second);
  });

  it('treats a null or empty quote as unmatched', () => {
    expect(matchQuote(text, { quote: null })).toEqual({ kind: 'unmatched' });
    expect(matchQuote(text, { quote: '   ' })).toEqual({ kind: 'unmatched' });
  });

  it('never returns a range whose text is not the quote', () => {
    // The property, asserted directly against a set of awkward inputs.
    const cases = [
      { body: text, quote: 'data science' },
      { body: text, quote: 'DATA SCIENCE' },
      { body: text, quote: 'internship' },
      { body: '', quote: 'anything' },
      { body: text, quote: text },
    ];
    for (const { body, quote } of cases) {
      const result = matchQuote(body, { quote });
      if (result.kind !== 'unmatched') {
        expect(body.slice(result.start, result.end).replace(/\s+/g, ' ').trim()).toBe(
          quote.replace(/\s+/g, ' ').trim(),
        );
      }
    }
  });
});

describe('buildHighlightRuns', () => {
  const text = 'One two three four five.';

  it('splits the text around matched ranges', () => {
    const runs = buildHighlightRuns(text, [
      { id: 'a', match: { kind: 'offset', start: 4, end: 7 } },
    ]);
    expect(runs.map((r) => r.text)).toEqual(['One ', 'two', ' three four five.']);
    expect(runs[1]?.ids).toEqual(['a']);
  });

  it('drops unmatched items entirely', () => {
    const runs = buildHighlightRuns(text, [{ id: 'a', match: { kind: 'unmatched' } }]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.ids).toEqual([]);
  });

  it('keeps the first of two overlapping ranges rather than nesting them', () => {
    const runs = buildHighlightRuns(text, [
      { id: 'a', match: { kind: 'offset', start: 0, end: 7 } },
      { id: 'b', match: { kind: 'offset', start: 4, end: 13 } },
    ]);
    const highlighted = runs.filter((r) => r.ids.length > 0);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.ids).toEqual(['a']);
    // No text is lost or duplicated by the overlap resolution.
    expect(runs.map((r) => r.text).join('')).toBe(text);
  });

  it('reassembles into exactly the original text', () => {
    const runs = buildHighlightRuns(text, [
      { id: 'a', match: { kind: 'offset', start: 0, end: 3 } },
      { id: 'b', match: { kind: 'offset', start: 8, end: 13 } },
    ]);
    expect(runs.map((r) => r.text).join('')).toBe(text);
  });
});
