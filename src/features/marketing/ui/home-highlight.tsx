import type { ReactNode } from 'react';

/**
 * Keyword highlight for the sales-journey Home.
 *
 * The owner's content PDF sets one rule for the whole page: "Các keywords thì
 * highlight bằng cách đổi màu thành gradient đỏ-hồng" — keywords change colour
 * to a red→pink gradient. The PDF marks them bold-italic (the hero's
 * "solution … hunters", the four numbers, the pricing sale tag); the owner
 * picked the hero's on 2026-09-29: "ultimate solution".
 *
 * Rose only. The first v2 build ran these into cyan, a leftover of the retired
 * five-hue globe palette; the brief makes rose the page's only accent.
 *
 * Four tones, by what the word sits on:
 *   dark   black / wine bands — rose-500 → rose-300, the pink end lifts it off
 *          the dark ground.
 *   light  white bands and white cards — rose-700 → rose-500, both ends clear
 *          3:1 on white at display sizes.
 *   tint   the pink bands after the numbers (team, journey) — rose-700 →
 *          rose-600. On rose-200 the light tone's rose-500 end measures 2.6:1,
 *          under the 3:1 large-text floor; rose-600 is 3.3:1.
 *   band   the saturated rose numbers band — white → rose-100, because a rose
 *          gradient on a rose ground disappears.
 */
export type HighlightTone = 'dark' | 'light' | 'tint' | 'band';

const GRADIENT: Readonly<Record<HighlightTone, string>> = {
  dark: 'from-gb-brand-500 to-gb-brand-300',
  light: 'from-gb-brand-700 to-gb-brand-500',
  tint: 'from-gb-brand-700 to-gb-brand-600',
  band: 'from-gb-neutral-0 to-gb-brand-100',
};

/** The classes, for a node that is already its own element (a counted figure). */
export function highlightClass(tone: HighlightTone): string {
  return `bg-gradient-to-r ${GRADIENT[tone]} bg-clip-text text-transparent`;
}

/**
 * ⚠️ Not named `Highlight`: that is a browser global (the CSS Custom Highlight
 * API's constructor), so a file that used `<Highlight>` and lost its import
 * would still type-check against lib.dom and then throw at render — which is
 * exactly what happened mid-edit on 2026-09-29.
 */
export function KeywordHighlight({ tone, children }: { tone: HighlightTone; children: ReactNode }) {
  return <span className={highlightClass(tone)}>{children}</span>;
}

/**
 * Wraps each of `phrases` inside an already-localized `text`.
 *
 * Pass phrases in the same locale as the text. A phrase the text does not
 * contain is skipped rather than forced, so a translation that words the idea
 * differently degrades to plain text, never to a broken sentence.
 */
export function highlightPhrases(
  text: string,
  phrases: readonly string[],
  tone: HighlightTone,
): ReactNode {
  const found = phrases
    .filter((phrase) => phrase.length > 0)
    .map((phrase) => ({ phrase, at: text.indexOf(phrase) }))
    .filter((hit) => hit.at >= 0)
    .sort((a, b) => a.at - b.at);

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { phrase, at } of found) {
    // Skip a phrase that overlaps one already wrapped.
    if (at < cursor) continue;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <KeywordHighlight key={`${at}-${phrase}`} tone={tone}>
        {phrase}
      </KeywordHighlight>,
    );
    cursor = at + phrase.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length === 1 ? parts[0] : parts;
}
