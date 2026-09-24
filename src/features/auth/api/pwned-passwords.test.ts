import { describe, expect, it, vi } from 'vitest';
import { checkPasswordBreach } from './pwned-passwords';

/** SHA-1('password') = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8 */
const PWNED_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';

/**
 * Typed as `fetch` rather than by its implementation: that gives `mock.calls`
 * fetch's own parameter tuple, which the request-shape assertions below index
 * into. Inferring from a zero-argument body would type the tuple as `[]`.
 */
function respondWith(body: string, init: ResponseInit = {}) {
  return vi.fn<typeof globalThis.fetch>(async () => new Response(body, { status: 200, ...init }));
}

describe('checkPasswordBreach', () => {
  it('reports a breached password with its count', async () => {
    const fetchMock = respondWith(`${PWNED_SUFFIX}:9659364`);
    await expect(checkPasswordBreach('password', { fetch: fetchMock })).resolves.toEqual({
      status: 'breached',
      count: 9659364,
    });
  });

  it('reports a password absent from the corpus as clean', async () => {
    const fetchMock = respondWith('0018A45C4D1DEF81644B54AB7F969B88D65:3');
    await expect(checkPasswordBreach('password', { fetch: fetchMock })).resolves.toEqual({
      status: 'clean',
    });
  });

  it('NEVER transmits the password or the full hash — only the 5-char prefix', async () => {
    // This is the security property of the whole module. If it regresses, every
    // sign-up password is being handed to a third party.
    const fetchMock = respondWith('');
    await checkPasswordBreach('password', { fetch: fetchMock });

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('fetch was never called');
    const [url, init] = call;
    const requested = new URL(String(url));

    expect(requested.origin).toBe('https://api.pwnedpasswords.com');
    // Exactly five hex characters after /range/ — nothing more of the digest.
    expect(requested.pathname).toBe('/range/5BAA6');
    expect(requested.pathname.replace('/range/', '')).toHaveLength(5);
    // The remaining 35 characters stay local; they are matched against the
    // response here. (Asserting on the full URL string would be useless: the
    // host `pwnedpasswords.com` contains the literal substring "password".)
    expect(String(url)).not.toContain(PWNED_SUFFIX);
    expect(requested.search).toBe('');
    // Nothing sneaks out in a body either — it is a plain GET.
    expect((init as RequestInit | undefined)?.method).toBe('GET');
    expect((init as RequestInit | undefined)?.body).toBeUndefined();
  });

  it('asks for padding so the response size leaks nothing', async () => {
    const fetchMock = respondWith('');
    await checkPasswordBreach('password', { fetch: fetchMock });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>)['Add-Padding']).toBe('true');
  });

  it('fails OPEN on an HTTP error rather than blocking sign-up', async () => {
    const fetchMock = respondWith('rate limited', { status: 429 });
    await expect(checkPasswordBreach('password', { fetch: fetchMock })).resolves.toEqual({
      status: 'unavailable',
      reason: 'hibp_http_429',
    });
  });

  it('fails OPEN when the network throws', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const result = await checkPasswordBreach('password', { fetch: fetchMock });
    expect(result.status).toBe('unavailable');
  });

  it('fails OPEN on timeout instead of hanging the request', async () => {
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = await checkPasswordBreach('password', {
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      timeoutMs: 10,
    });
    expect(result.status).toBe('unavailable');
  });

  it('distinguishes "could not check" from "checked and clean"', async () => {
    // The route relies on this: `unavailable` must never be mistaken for a pass.
    const down = await checkPasswordBreach('password', {
      fetch: respondWith('', { status: 503 }),
    });
    const clean = await checkPasswordBreach('password', { fetch: respondWith('AAAA:1') });
    expect(down.status).not.toBe(clean.status);
  });
});
