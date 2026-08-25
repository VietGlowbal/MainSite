import { SITE_URL } from '@/lib/site-url';

/**
 * Safe JSON-LD serializer preventing script breakout (e.g. `</script>`).
 * Replaces `<` with `\u003c` in accordance with Next.js & Google security guidelines.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export type ArticleSchemaInput = {
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  publishedAt: string;
  updatedAt?: string | null;
  authorName?: string;
  publisherName?: string;
  keywords?: string[];
  relatedLinks?: string[];
};

export function buildArticleJsonLd(input: ArticleSchemaInput): Record<string, unknown> {
  const publishedDate = input.publishedAt.slice(0, 10);
  const modifiedDate = (input.updatedAt || input.publishedAt).slice(0, 10);
  const orgName = input.publisherName || 'GlowBal';
  const authorName = input.authorName || 'GlowBal';

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description || undefined,
    mainEntityOfPage: input.url,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: {
      '@type': 'Organization',
      name: authorName,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: orgName,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/glowbal-logo.png`,
      },
    },
  };

  if (input.imageUrl) {
    const fullImage = input.imageUrl.startsWith('http') ? input.imageUrl : `${SITE_URL}${input.imageUrl}`;
    schema.image = [fullImage];
  }

  if (input.keywords && input.keywords.length > 0) {
    schema.keywords = input.keywords.join(', ');
  }

  if (input.relatedLinks && input.relatedLinks.length > 0) {
    schema.relatedLink = input.relatedLinks;
  }

  return schema;
}

export function buildBreadcrumbsJsonLd(items: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export type UniversitySchemaInput = {
  name: string;
  url: string;
  imageUrl?: string | null;
  officialWebsite?: string | null;
  description?: string | null;
  addressCountry?: string | null;
};

export function buildUniversityJsonLd(input: UniversitySchemaInput): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: input.name,
    url: input.url,
    description: input.description || undefined,
  };

  if (input.imageUrl) {
    schema.image = input.imageUrl;
  }

  if (input.officialWebsite) {
    schema.sameAs = input.officialWebsite;
  }

  if (input.addressCountry) {
    schema.address = {
      '@type': 'PostalAddress',
      addressCountry: input.addressCountry,
    };
  }

  return schema;
}

export type AdvisorSchemaInput = {
  name: string;
  url: string;
  subject?: string | null;
  universityName?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
};

export function buildAdvisorJsonLd(input: AdvisorSchemaInput): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    url: input.url,
    jobTitle: 'Advisor',
    description: input.bio || undefined,
  };

  if (input.universityName) {
    schema.alumniOf = {
      '@type': 'CollegeOrUniversity',
      name: input.universityName,
    };
  }

  if (input.imageUrl) {
    schema.image = input.imageUrl;
  }

  return schema;
}

export type OrganizationSchemaInput = {
  name?: string;
  alternateName?: string;
  url?: string;
  logoUrl?: string;
  description?: string;
  sameAs?: string[];
};

export function buildOrganizationJsonLd(input: OrganizationSchemaInput = {}): Record<string, unknown> {
  const url = input.url || SITE_URL;
  return {
    '@type': 'Organization',
    '@id': `${url}/#organization`,
    name: input.name || 'GlowBal',
    alternateName: input.alternateName || 'GlowBal Education',
    url,
    logo: {
      '@type': 'ImageObject',
      url: input.logoUrl || `${url}/glowbal-logo.png`,
    },
    description:
      input.description ||
      'Student-first global course and university guidance platform helping students find scholarships and build application strategies.',
    ...(input.sameAs && input.sameAs.length > 0 ? { sameAs: input.sameAs } : {}),
  };
}

export type WebSiteSchemaInput = {
  name?: string;
  url?: string;
  description?: string;
  inLanguage?: string[];
};

export function buildWebSiteJsonLd(input: WebSiteSchemaInput = {}): Record<string, unknown> {
  const url = input.url || SITE_URL;
  return {
    '@type': 'WebSite',
    '@id': `${url}/#website`,
    url,
    name: input.name || 'GlowBal',
    description: input.description || 'Find Universities, Scholarships & Study Abroad Support',
    publisher: {
      '@id': `${url}/#organization`,
    },
    inLanguage: input.inLanguage || ['vi', 'en'],
  };
}
