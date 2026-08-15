import { describe, expect, it } from 'vitest';
import { isNavLinkActive } from './nav-model';

describe('isNavLinkActive', () => {
  it('treats an in-page destination as its pathname for active navigation', () => {
    expect(isNavLinkActive('/apply', '/apply#portal')).toBe(true);
    expect(isNavLinkActive('/apply/application-1', '/apply#portal')).toBe(true);
    expect(isNavLinkActive('/universities', '/apply#portal')).toBe(false);
  });
});
