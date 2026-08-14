/**
 * Defence-in-depth against a real, observed model failure mode: every
 * extraction prompt in this directory documents its JSON schema with a
 * `"...|null"` shorthand (meaning "a string, or the JSON value null") —
 * ambiguous enough that the model sometimes echoes the placeholder literally,
 * returning a real extracted string with a trailing `|null` still attached
 * (e.g. `"Accepted onto the program.|null"`), which then renders verbatim in
 * the Personal Report. Strips that literal suffix (and a lone literal
 * `"null"`) after parsing, independent of whichever prompt wording is
 * currently in use — reported live 2026-08-14.
 */
export function sanitizeExtractedField(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.replace(/\s*\|\s*null\s*$/i, '').trim();
  if (cleaned.length === 0 || cleaned.toLowerCase() === 'null') return null;
  return cleaned;
}
