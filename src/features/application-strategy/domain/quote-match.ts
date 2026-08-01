/**
 * Binding a piece of feedback to the passage that caused it.
 *
 * THE PROBLEM. An analysis records "this sentence is vague" along with the
 * sentence and its character offsets. The student then edits three paragraphs
 * above it. The offsets now point at the wrong text, and highlighting there
 * attaches the criticism to an innocent sentence — which is worse than showing no
 * highlight at all, because the student will rewrite the wrong thing.
 *
 * THE RULE. A range is returned only when the verbatim quote is genuinely present
 * at it. Order of attempts:
 *
 *   1. The stored offsets, IF the substring there still equals the quote.
 *   2. The quote as a verbatim search. Unique match only.
 *   3. The quote with runs of whitespace normalised, mapped back to real offsets.
 *      This exists because editors and paste operations change `\n` to ` ` and
 *      double-space to single without the student meaning to change any words.
 *   4. Give up.
 *
 * There is deliberately NO fuzzy, nearest, or best-effort match. Edit distance
 * would silently relocate feedback to a similar sentence, and "similar sentence"
 * in a personal statement usually means the one making the opposite point.
 *
 * AMBIGUITY IS ALSO FAILURE. If the quote appears more than once and the offsets
 * do not disambiguate, the result is `unmatched`. Picking the first occurrence
 * would be a coin flip, and repetition is itself something the analysis flags — so
 * the duplicate case is exactly where guessing wrong is most likely.
 */

export type QuoteMatch =
  | { kind: 'offset'; start: number; end: number }
  | { kind: 'rematched'; start: number; end: number }
  | { kind: 'unmatched' };

export type QuotedItem = {
  quote: string | null;
  quoteStart?: number | null;
  quoteEnd?: number | null;
};

export function matchQuote(text: string, item: QuotedItem): QuoteMatch {
  const quote = item.quote?.trim();
  if (!text || !quote) return { kind: 'unmatched' };

  // 1. Trust the offsets only if they still hold.
  const { quoteStart: start, quoteEnd: end } = item;
  if (
    typeof start === 'number' &&
    typeof end === 'number' &&
    start >= 0 &&
    end <= text.length &&
    start < end &&
    text.slice(start, end).trim() === quote
  ) {
    return { kind: 'offset', start, end };
  }

  // 2. Verbatim, and unique.
  const first = text.indexOf(quote);
  if (first !== -1) {
    const second = text.indexOf(quote, first + 1);
    if (second === -1) {
      return { kind: 'rematched', start: first, end: first + quote.length };
    }
    // Appears more than once. If the stored offsets point at one of the
    // occurrences we can still resolve it — the text around it moved but this
    // occurrence is the one the analysis meant.
    if (typeof start === 'number') {
      const nearest = nearestOccurrence(text, quote, start);
      if (nearest !== null) return { kind: 'rematched', start: nearest, end: nearest + quote.length };
    }
    return { kind: 'unmatched' };
  }

  // 3. Whitespace-normalised, mapped back to real offsets.
  return matchNormalised(text, quote);
}

/**
 * The occurrence closest to where the analysis said it was, but only if it is
 * unambiguously closer than the alternatives.
 *
 * "Unambiguously" is the point: if two occurrences are near-equidistant from the
 * recorded offset, the recorded offset is not evidence and we are back to a coin
 * flip. The threshold is that the best candidate must be at least twice as close
 * as the runner-up.
 */
function nearestOccurrence(text: string, quote: string, recordedStart: number): number | null {
  const positions: number[] = [];
  let at = text.indexOf(quote);
  while (at !== -1) {
    positions.push(at);
    at = text.indexOf(quote, at + 1);
  }
  if (positions.length === 0) return null;

  const ranked = positions
    .map((p) => ({ p, d: Math.abs(p - recordedStart) }))
    .sort((a, b) => a.d - b.d);

  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best) return null;
  if (!runnerUp) return best.p;
  if (best.d * 2 <= runnerUp.d) return best.p;
  return null;
}

/**
 * Match ignoring how whitespace is written, then translate the hit back to
 * offsets in the original string.
 *
 * Done by building an index map alongside the normalised text rather than by
 * counting characters afterwards: the normalised and original strings have
 * different lengths, so any arithmetic on the offsets is wrong by however much
 * whitespace was collapsed before the match.
 */
function matchNormalised(text: string, quote: string): QuoteMatch {
  const { normalised, indexMap } = normalise(text);
  const normalisedQuote = quote.replace(/\s+/g, ' ').trim();
  if (normalisedQuote.length === 0) return { kind: 'unmatched' };

  const at = normalised.indexOf(normalisedQuote);
  if (at === -1) return { kind: 'unmatched' };
  if (normalised.indexOf(normalisedQuote, at + 1) !== -1) return { kind: 'unmatched' };

  const start = indexMap[at];
  // The last matched character's original index, +1 for an exclusive end.
  const lastIndex = indexMap[at + normalisedQuote.length - 1];
  if (start === undefined || lastIndex === undefined) return { kind: 'unmatched' };

  return { kind: 'rematched', start, end: lastIndex + 1 };
}

function normalise(text: string): { normalised: string; indexMap: number[] } {
  let normalised = '';
  const indexMap: number[] = [];
  let inWhitespace = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;
    if (/\s/.test(char)) {
      if (!inWhitespace && normalised.length > 0) {
        normalised += ' ';
        indexMap.push(i);
      }
      inWhitespace = true;
      continue;
    }
    inWhitespace = false;
    normalised += char;
    indexMap.push(i);
  }

  // A trailing collapsed space would let a quote match past the end of the text.
  if (normalised.endsWith(' ')) {
    normalised = normalised.slice(0, -1);
    indexMap.pop();
  }

  return { normalised, indexMap };
}

/**
 * Split text into the runs a highlighted view renders.
 *
 * Overlapping ranges are resolved by taking the first: two pieces of feedback on
 * the same clause is common, and nesting `<mark>` elements produces a visual mess
 * plus an unreadable screen-reader experience. The second finding still appears in
 * the list, just without its own highlight.
 */
export type HighlightRun = { text: string; start: number; end: number; ids: string[] };

export function buildHighlightRuns(
  text: string,
  items: readonly { id: string; match: QuoteMatch }[],
): HighlightRun[] {
  const ranges = items
    .flatMap((item) =>
      item.match.kind === 'unmatched'
        ? []
        : [{ id: item.id, start: item.match.start, end: item.match.end }],
    )
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: { id: string; start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = kept[kept.length - 1];
    if (last && range.start < last.end) continue;
    kept.push(range);
  }

  const runs: HighlightRun[] = [];
  let cursor = 0;
  for (const range of kept) {
    if (range.start > cursor) {
      runs.push({ text: text.slice(cursor, range.start), start: cursor, end: range.start, ids: [] });
    }
    runs.push({
      text: text.slice(range.start, range.end),
      start: range.start,
      end: range.end,
      ids: [range.id],
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor), start: cursor, end: text.length, ids: [] });
  }

  return runs;
}
