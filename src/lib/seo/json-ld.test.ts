import { describe, expect, it } from 'vitest';
import {
  serializeJsonLd,
  buildArticleJsonLd,
  buildBreadcrumbsJsonLd,
  buildUniversityJsonLd,
  buildAdvisorJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from './json-ld';

describe('JSON-LD schema generators', () => {
  it('safely serializes JSON-LD without allowing script tag breakout', () => {
    const malicious = {
      '@type': 'Article',
      headline: '</script><script>alert("xss")</script>',
    };
    const json = serializeJsonLd(malicious);
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script>');
    expect(JSON.parse(json)).toEqual(malicious);
  });

  it('builds valid Article JSON-LD with datePublished and dateModified', () => {
    const schema = buildArticleJsonLd({
      title: 'Study in UK Guide',
      description: 'Comprehensive guide for Vietnamese students',
      url: 'https://glowbal-education.com/news/study-in-uk-guide',
      imageUrl: 'https://glowbal-education.com/generated/news/study-in-uk-guide.png',
      publishedAt: '2026-08-01',
      updatedAt: '2026-08-20',
      keywords: ['study abroad', 'UK'],
      relatedLinks: ['https://glowbal-education.com/news/uk-scholarships'],
    });

    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe('Study in UK Guide');
    expect(schema.datePublished).toBe('2026-08-01');
    expect(schema.dateModified).toBe('2026-08-20');
    expect(schema.mainEntityOfPage).toBe('https://glowbal-education.com/news/study-in-uk-guide');
  });

  it('builds valid Breadcrumbs JSON-LD', () => {
    const schema = buildBreadcrumbsJsonLd([
      { name: 'Home', url: 'https://glowbal-education.com' },
      { name: 'News', url: 'https://glowbal-education.com/news' },
      { name: 'Article', url: 'https://glowbal-education.com/news/sample' },
    ]);

    expect(schema['@type']).toBe('BreadcrumbList');
    const items = schema.itemListElement as Array<{ name: string; position: number; item: string; '@type': string }>;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://glowbal-education.com',
    });
  });

  it('builds CollegeOrUniversity schema only from factual fields', () => {
    const schema = buildUniversityJsonLd({
      name: 'University of Oxford',
      url: 'https://glowbal-education.com/universities/1',
      imageUrl: 'https://upload.wikimedia.org/oxford.jpg',
      officialWebsite: 'https://ox.ac.uk',
      description: 'Prestigious university in Oxford, England.',
      addressCountry: 'United Kingdom',
    });

    expect(schema['@type']).toBe('CollegeOrUniversity');
    expect(schema.name).toBe('University of Oxford');
    expect(schema.url).toBe('https://glowbal-education.com/universities/1');
    expect(schema.sameAs).toBe('https://ox.ac.uk');
  });

  it('builds Person schema for advisors', () => {
    const schema = buildAdvisorJsonLd({
      name: 'Sarah Nguyen',
      url: 'https://glowbal-education.com/advisors/sarah-nguyen',
      subject: 'Computer Science',
      universityName: 'University of Oxford',
      bio: 'Oxford CS graduate offering mentorship.',
    });

    expect(schema['@type']).toBe('Person');
    expect(schema.name).toBe('Sarah Nguyen');
    expect(schema.jobTitle).toBe('Advisor');
  });

  it('builds Organization and WebSite schema', () => {
    const org = buildOrganizationJsonLd({
      name: 'GlowBal',
      url: 'https://glowbal-education.com',
      logoUrl: 'https://glowbal-education.com/glowbal-logo.png',
      description: 'Global education and scholarship guidance platform.',
    });
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe('GlowBal');

    const site = buildWebSiteJsonLd({
      name: 'GlowBal',
      url: 'https://glowbal-education.com',
      description: 'Study abroad search and strategy.',
      inLanguage: ['en', 'vi'],
    });
    expect(site['@type']).toBe('WebSite');
  });
});
