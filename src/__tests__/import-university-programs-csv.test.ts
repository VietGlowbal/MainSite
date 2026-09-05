import { afterEach, describe, expect, it, vi } from 'vitest';
// The production importer is an executable Node ESM script. Keep its pure
// parsing/mapping helpers directly testable without adding a second TS build.
import {
  applyExistingCataloguePolicy,
  credentialFromDegree,
  disambiguateProgrammeUrls,
  inferDegreeLevel,
  normalizeUniversityName,
  parseCsv,
  revalidateUniversityCaches,
} from '../../scripts/import-university-programs-csv.mjs';

describe('university programme CSV importer', () => {
  it('parses quoted commas, escaped quotes and embedded newlines', () => {
    const parsed = parseCsv(
      'University Name,Program Name,Notes\r\n"University of California, Berkeley",Economics,"A ""quoted""\nline"\r\n',
    );

    expect(parsed.headers).toEqual(['University Name', 'Program Name', 'Notes']);
    expect(parsed.rows).toEqual([
      {
        'University Name': 'University of California, Berkeley',
        'Program Name': 'Economics',
        Notes: 'A "quoted"\nline',
      },
    ]);
  });

  it('normalizes common university aliases onto the same identity', () => {
    expect(normalizeUniversityName('Massachusetts Institute of Technology (MIT)')).toBe(
      normalizeUniversityName('Massachusetts Institute of Technology'),
    );
    expect(normalizeUniversityName('University of California, Berkeley (UCB)')).toBe(
      normalizeUniversityName('University of California-Berkeley'),
    );
  });

  it.each([
    ['BS in Economics', 'Finance', 'bachelor'],
    ['Master of Science', 'Computer Science', 'master'],
    ['PhD', 'Economics', 'phd'],
    ['Juris Doctor (JD)', 'Law', 'professional'],
    ['VMD', 'Veterinary Medicine', 'professional'],
  ])('maps %s to %s degree level', (degree, programme, expected) => {
    expect(inferDegreeLevel(degree, programme)).toBe(expected);
  });

  it('keeps a concise credential while preserving combined degrees', () => {
    expect(
      credentialFromDegree(
        "BS in Economics (Wharton's single undergraduate degree; Finance is a concentration)",
      ),
    ).toBe('BS in Economics');
    expect(credentialFromDegree('BA or BS')).toBe('BA or BS');
  });

  it('adds deterministic fragments only when one source URL represents several programmes', () => {
    const rows = [
      {
        'University Name': 'Example University',
        'Program Name': 'Economics',
        Degree: 'BA',
        'Program Link': 'https://example.edu/programs/',
      },
      {
        'University Name': 'Example University',
        'Program Name': 'Financial Economics',
        Degree: 'BA',
        'Program Link': 'https://example.edu/programs/',
      },
      {
        'University Name': 'Example University',
        'Program Name': 'Physics',
        Degree: 'BS',
        'Program Link': 'https://example.edu/physics/',
      },
    ];

    const first = disambiguateProgrammeUrls(rows);
    const second = disambiguateProgrammeUrls(rows);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(3);
    expect(first[0]).toContain('#glowbal-program=economics-');
    expect(first[1]).toContain('#glowbal-program=financial-economics-');
    expect(first[2]).toBe('https://example.edu/physics');
  });

  it('skips existing identities but preserves a different degree sharing the same URL', () => {
    const makeProgramme = (name: string, degree: string, url: string) => ({
      programme_id: `${name}-${degree}`,
      institution_id: 'csv-university-5',
      programme_name: name,
      official_url: url,
      degree_level: degree,
      verification_status: 'NEEDS_REVIEW',
      payload: { source_official_url: url, raw_fields: { Degree: degree } },
    });
    const plan = {
      programmes: [
        makeProgramme('Economics', 'bachelor', 'https://example.edu/economics'),
        makeProgramme('Computer Science (PhD)', 'phd', 'https://example.edu/cs'),
      ],
      programmeRelations: [],
      organisationUnits: [],
    };
    const existing = [
      {
        programme_id: 'existing-econ',
        university_id: 5,
        programme_name: 'Economics',
        official_url: 'https://example.edu/economics',
        degree_level: 'bachelor',
      },
      {
        programme_id: 'existing-cs',
        university_id: 5,
        programme_name: 'Computer Science',
        official_url: 'https://example.edu/cs',
        degree_level: 'master',
      },
    ];

    const result = applyExistingCataloguePolicy(plan, existing);
    expect(result.programmes[0].verification_status).toBe('REJECTED');
    expect(result.programmes[1].verification_status).toBe('NEEDS_REVIEW');
    expect(result.programmes[1].official_url).toContain('#glowbal-program=computer-science-phd-');
  });
});

/**
 * `/universities/matches` caches `catalog_programmes` for twelve hours
 * (`getMatchingCatalogue`, docs/performance.md fix 6). This script is that
 * table's only writer, and it writes straight to Postgres — so if it stops
 * expiring the cache, an operator's corrected programmes are invisible to
 * ranking until the TTL runs out, with nothing on screen to say so.
 *
 * It must also never turn a successful import into a failed one: the rows are
 * already promoted and verified by the time this runs, so a cache ping that
 * cannot land is a warning with the manual command, not a throw.
 */
describe('post-import cache revalidation', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('expires the universities cache against the configured site', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-token';
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response('{}', { status: 200 });
    }));

    const result = await revalidateUniversityCaches();

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0]!;
    // Trailing slash trimmed, or the URL doubles up and 404s.
    expect(url).toBe('https://example.test/api/admin/universities/revalidate');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-role-token');
  });

  it('warns instead of throwing when the endpoint cannot be reached', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-token';
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(revalidateUniversityCaches()).resolves.toMatchObject({ ok: false, reason: 'unreachable' });
    expect(warn.mock.calls[0]?.[0]).toContain('npm run revalidate:universities');
    warn.mockRestore();
  });

  it('warns instead of throwing when the site URL is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-token';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(revalidateUniversityCaches()).resolves.toMatchObject({ ok: false, reason: 'missing-env' });
    expect(fetchMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
