export const FUNDING_TYPES = [
  'merit',
  'need',
  'leadership',
  'research',
  'sport',
  'diversity',
  'regional',
  'field-specific',
  'full-ride',
  'partial',
  'travel',
  'other',
] as const;

export const SCHOLARSHIP_SCOPES = ['university', 'country', 'consortium', 'provider'] as const;
export const SCHOLARSHIP_STATUSES = ['draft', 'published', 'archived'] as const;

export const FUNDING_TYPE_LABELS: Record<(typeof FUNDING_TYPES)[number], string> = {
  merit: 'Merit-based',
  need: 'Need-based',
  leadership: 'Leadership',
  research: 'Research',
  sport: 'Sport',
  diversity: 'Diversity & inclusion',
  regional: 'Regional / government',
  'field-specific': 'Field-specific',
  'full-ride': 'Full ride',
  partial: 'Partial',
  travel: 'Travel / mobility',
  other: 'Other',
};

export const SCHOLARSHIP_SCOPE_LABELS: Record<(typeof SCHOLARSHIP_SCOPES)[number], string> = {
  university: 'University-specific',
  country: 'Country / government',
  consortium: 'Consortium',
  provider: 'Foundation / provider',
};
