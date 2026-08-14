import { describe, expect, it } from 'vitest';
import { sanitizeExtractedField } from './sanitize-extracted-field';

describe('sanitizeExtractedField', () => {
  it('passes a normal extracted string through unchanged', () => {
    expect(sanitizeExtractedField('Ran weekly tutoring sessions.')).toBe('Ran weekly tutoring sessions.');
  });

  it('passes null through unchanged', () => {
    expect(sanitizeExtractedField(null)).toBeNull();
  });

  it('strips a literal trailing "|null" the model echoed from the prompt schema hint', () => {
    expect(sanitizeExtractedField('Accepted onto the program.|null')).toBe('Accepted onto the program.');
  });

  it('strips a trailing "|null" with surrounding whitespace', () => {
    expect(sanitizeExtractedField('Accepted onto the program.  |  null ')).toBe('Accepted onto the program.');
  });

  it('returns null for a string that is only the literal word "null"', () => {
    expect(sanitizeExtractedField('null')).toBeNull();
    expect(sanitizeExtractedField('Null')).toBeNull();
  });

  it('returns null once stripping "|null" leaves nothing behind', () => {
    expect(sanitizeExtractedField('|null')).toBeNull();
  });

  it('does not touch a legitimate string that happens to contain a pipe character', () => {
    expect(sanitizeExtractedField('Context: home | school')).toBe('Context: home | school');
  });
});
