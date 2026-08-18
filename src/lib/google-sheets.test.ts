import { describe, expect, it } from 'vitest';
import { columnLetter } from './google-sheets';

describe('columnLetter', () => {
  it('maps a column count to the A1 letter that ends the range', () => {
    expect(columnLetter(1)).toBe('A');
    // The contact export is 17 columns wide.
    expect(columnLetter(17)).toBe('Q');
    expect(columnLetter(26)).toBe('Z');
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(52)).toBe('AZ');
  });
});
