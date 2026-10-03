import { describe, expect, it } from 'vitest';
import { canonicalizeExternalUrl, isSafeExternalUrl } from './external-url';

describe('external scholarship URL boundary', () => {
  it.each([
    'https://example.test/scholarship',
    'http://example.test/scholarship',
  ])('accepts %s', (url) => {
    expect(canonicalizeExternalUrl(url)).toBe(`${url}`);
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.test/id',
    ' /relative/path',
    'https://example.test/with whitespace',
    'java%73cript:alert(1)',
    'https://example.test/%0Ajavascript:alert(1)',
  ])('rejects unsafe or malformed URL %s', (url) => {
    expect(canonicalizeExternalUrl(url)).toBeNull();
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});
