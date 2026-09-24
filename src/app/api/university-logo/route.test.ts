import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, faviconUpstream, isProxyableDomain } from './route';

/** Drives the route the way an `<img src>` does. */
async function get(query: string) {
  return GET(new NextRequest(`https://glowbal-education.com/api/university-logo?${query}`));
}

/** Stands in for Google's endpoint (after its redirect to t1.gstatic.com). */
function upstream(status: number, contentType: string, body = 'PNGDATA') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status, headers: { 'content-type': contentType } })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('domain validation', () => {
  it('accepts the hostnames that actually appear in logo_url', () => {
    for (const domain of ['ox.ac.uk', 'ed.ac.uk', 'u-tokyo.ac.jp', 'unibocconi.it']) {
      expect(isProxyableDomain(domain)).toBe(true);
    }
  });

  it('refuses anything that is not a bare hostname', () => {
    // A URL, a path, a port, credentials, an IP literal: each is either a way
    // to point the proxy somewhere it should not go, or simply not a domain.
    for (const value of [
      null,
      '',
      'not a domain',
      'https://evil.example/x',
      'example.com/path',
      'example.com:8080',
      'user@example.com',
      '127.0.0.1',
      '169.254.169.254',
      'localhost',
    ]) {
      expect(isProxyableDomain(value)).toBe(false);
    }
  });

  it('builds the upstream itself so a caller can never choose the host', () => {
    expect(faviconUpstream('ox.ac.uk')).toBe(
      'https://www.google.com/s2/favicons?sz=128&domain=ox.ac.uk',
    );
  });
});

describe('GET /api/university-logo', () => {
  it('rejects an invalid domain without calling out at all', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect((await get('domain=https://evil.example')).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes a real favicon through as an image', async () => {
    upstream(200, 'image/png');
    const response = await get('domain=ox.ac.uk');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('answers 404 when Google has no favicon, rather than passing its grey globe on', async () => {
    // t1.gstatic.com replies 404 WITH a generic PNG body; an <img> would render
    // that body. Callers must get a miss so their own initials mark shows.
    upstream(404, 'image/png');
    const response = await get('domain=ed.ac.uk');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'no_favicon' });
    expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
  });

  it('reports a non-image or failing upstream as a bad gateway', async () => {
    upstream(200, 'text/html');
    expect((await get('domain=ox.ac.uk')).status).toBe(502);

    upstream(500, 'image/png');
    expect((await get('domain=ox.ac.uk')).status).toBe(502);
  });

  it('never lets an upstream timeout become a 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timed out'); }));
    expect((await get('domain=ox.ac.uk')).status).toBe(502);
  });
});
