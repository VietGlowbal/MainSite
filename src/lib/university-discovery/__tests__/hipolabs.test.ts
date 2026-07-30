import { describe, expect, it } from 'vitest';

import {
  buildHipolabsCandidate,
  normalizeHipolabsDomain,
} from '@/lib/university-discovery/hipolabs';

describe('Hipolabs university normalization', () => {
  it('keeps normalized domains and official web pages for review', () => {
    const candidate = buildHipolabsCandidate(
      {
        name: ' Example University ',
        country: 'Canada',
        alpha_two_code: 'ca',
        domains: ['www.example.edu', 'admissions.example.edu', 'javascript:bad'],
        web_pages: [
          'http://www.example.edu/',
          'https://admissions.example.edu/study#apply',
          'https://unrelated.example.org/',
        ],
      },
      'Fallback',
      '2026-07-27T00:00:00.000Z',
    );

    expect(candidate).toEqual({
      name: 'Example University',
      country: 'Canada',
      country_code: 'CA',
      primary_domain: 'example.edu',
      official_url: 'https://www.example.edu/',
      domain_candidates: ['example.edu', 'admissions.example.edu'],
      official_web_pages: [
        'https://www.example.edu/',
        'https://admissions.example.edu/study',
      ],
      domain_source: 'hipolabs',
      domain_review_status: 'pending',
      crawl_seed_enabled: false,
      domain_discovered_at: '2026-07-27T00:00:00.000Z',
      source: 'auto',
    });
  });

  it('rejects unsafe or domain-less records', () => {
    expect(normalizeHipolabsDomain('localhost')).toBeNull();
    expect(normalizeHipolabsDomain('database.internal')).toBeNull();
    expect(normalizeHipolabsDomain('127.0.0.1')).toBeNull();
    expect(normalizeHipolabsDomain('https://user:pass@example.edu')).toBeNull();
    expect(
      buildHipolabsCandidate(
        { name: 'No Domain University', country: 'US', domains: [] },
        'US',
      ),
    ).toBeNull();
  });
});
