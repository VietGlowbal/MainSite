import { NextResponse } from 'next/server';

/**
 * Machine-translation endpoint used for *dynamic* content that can't live in
 * the static UI dictionary — university descriptions from the database and
 * AI-generated article bodies.
 *
 * POST { texts: string[], target: 'vi' | 'en' } -> { translations: string[] }
 *
 * - Backed by the same OpenAI setup the rest of the app uses (OPENAI_API_KEY).
 * - Batches all strings into a single request and caches results in-process,
 *   so repeated views (and shared strings) don't re-incur cost.
 * - Degrades gracefully: with no key or on error it returns the source text,
 *   so the site simply stays English rather than breaking.
 */

const cache = new Map<string, string>();
const MAX_TEXTS = 60;
const MAX_CHARS = 8000;

export async function POST(request: Request) {
  let body: { texts?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const target = body.target === 'vi' ? 'vi' : 'en';
  const texts = Array.isArray(body.texts)
    ? body.texts.filter((t): t is string => typeof t === 'string').slice(0, MAX_TEXTS)
    : [];

  if (texts.length === 0) return NextResponse.json({ translations: [] });
  // Nothing to do for English — it's the source language.
  if (target === 'en') return NextResponse.json({ translations: texts });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // No provider configured — fall back to source text (English).
    return NextResponse.json({ translations: texts, fallback: true });
  }

  // Resolve from cache; collect the misses for a single batched call.
  const result = new Array<string>(texts.length);
  const missIdx: number[] = [];
  const missTexts: string[] = [];
  texts.forEach((text, i) => {
    const key = `vi:${text}`;
    if (cache.has(key)) {
      result[i] = cache.get(key)!;
    } else if (text.length > MAX_CHARS) {
      result[i] = text; // too large to translate safely — leave as-is
    } else {
      missIdx.push(i);
      missTexts.push(text);
    }
  });

  if (missTexts.length === 0) {
    return NextResponse.json({ translations: result });
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const systemPrompt =
    'You are a professional English-to-Vietnamese translator for a study-abroad platform. ' +
    'Translate each item of the input JSON array into natural, fluent Vietnamese. ' +
    'Preserve Markdown formatting, link URLs, HTML, numbers, currency, and placeholders like {name} exactly. ' +
    'Do NOT translate brand names (GLOWBAL), university names, or proper nouns. ' +
    'Return ONLY a JSON object of the form {"translations": string[]} with the same length and order as the input.';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(missTexts) },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('Translate API error:', await response.text().catch(() => ''));
      missIdx.forEach((idx, k) => (result[idx] = missTexts[k]));
      return NextResponse.json({ translations: result, fallback: true });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    const out: unknown = parsed.translations ?? parsed;
    const translated = Array.isArray(out) ? out : [];

    missIdx.forEach((idx, k) => {
      const value = typeof translated[k] === 'string' && translated[k].trim() ? translated[k] : missTexts[k];
      result[idx] = value;
      cache.set(`vi:${missTexts[k]}`, value);
    });

    return NextResponse.json({ translations: result });
  } catch (err) {
    console.error('Translate failed:', err);
    missIdx.forEach((idx, k) => (result[idx] = missTexts[k]));
    return NextResponse.json({ translations: result, fallback: true });
  }
}
