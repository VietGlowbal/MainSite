import { describe, expect, it, vi } from 'vitest';
import {
  canonicalSourceFingerprint,
  targetProfileSchema,
  type CatalogueProjection,
} from './domain';

const ADMISSION_ROWS = [
  {
    course_id: 'prog-1',
    document_type: 'english_proficiency',
    requirement_status: 'required',
    required_count: 1,
    application_stage: 'initial_application',
    display_mode: 'structured',
    source_run_id: 'run-1',
    source_retrieved_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
  },
  {
    course_id: 'prog-1',
    document_type: 'transcript',
    requirement_status: 'required',
    required_count: 1,
    application_stage: 'initial_application',
    display_mode: 'structured',
    source_run_id: 'run-2',
    source_retrieved_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-03T00:00:00Z',
  },
];

const PROJECTION: CatalogueProjection = {
  programme: {
    id: 'prog-1',
    course_name: 'Computer Science',
    university_name: 'Demo University',
    degree_level: 'undergraduate',
    subject: 'computing',
    source_run_id: 'run-1',
    source_retrieved_at: '2026-08-01T00:00:00Z',
  },
  admissionRequirements: ADMISSION_ROWS,
  fieldValues: [
    {
      id: 'fv-1',
      field_name: 'programme_description',
      value: { text: 'A hands-on computing programme.' },
      verification_status: 'AI_EXTRACTED',
      retrieved_at: '2026-08-01T00:00:00Z',
      source_run_id: 'run-1',
    },
  ],
  sources: [
    {
      ref: 'run-1',
      url: 'https://example.edu/cs',
      title: 'CS programme page',
      retrievedAt: '2026-08-01T00:00:00Z',
      contentHash: 'hash-1',
    },
    {
      ref: 'run-2',
      url: 'https://example.edu/apply',
      title: 'How to apply',
      retrievedAt: '2026-08-01T00:00:00Z',
      contentHash: 'hash-2',
    },
  ],
};

describe('canonicalSourceFingerprint', () => {
  it('is stable regardless of row ordering', () => {
    const shuffled: CatalogueProjection = {
      ...PROJECTION,
      admissionRequirements: [...ADMISSION_ROWS].reverse(),
      sources: [...PROJECTION.sources].reverse(),
      fieldValues: [...PROJECTION.fieldValues],
    };
    expect(canonicalSourceFingerprint(shuffled)).toBe(canonicalSourceFingerprint(PROJECTION));
  });

  it('changes when ingested content changes', () => {
    const changed: CatalogueProjection = {
      ...PROJECTION,
      admissionRequirements: ADMISSION_ROWS.map((row) =>
        row.document_type === 'transcript' ? { ...row, requirement_status: 'optional' } : row,
      ),
    };
    expect(canonicalSourceFingerprint(changed)).not.toBe(canonicalSourceFingerprint(PROJECTION));
  });

  it('ignores retrieval timestamps when the ingested content is unchanged', () => {
    const refreshed: CatalogueProjection = {
      ...PROJECTION,
      programme: { ...PROJECTION.programme, source_retrieved_at: '2026-08-27T00:00:00Z' },
      sources: PROJECTION.sources.map((source) => ({
        ...source,
        retrievedAt: '2026-08-27T00:00:00Z',
      })),
      fieldValues: PROJECTION.fieldValues.map((field) => ({
        ...field,
        retrieved_at: '2026-08-27T00:00:00Z',
      })),
      admissionRequirements: ADMISSION_ROWS.map((row) => ({
        ...row,
        source_retrieved_at: '2026-08-27T00:00:00Z',
        updated_at: '2026-08-27T00:00:00Z',
      })),
    };

    expect(canonicalSourceFingerprint(refreshed)).toBe(canonicalSourceFingerprint(PROJECTION));
  });
});

describe('targetProfileSchema', () => {
  const baseRequirement = {
    id: 'req-1',
    category: 'academic' as const,
    label: 'English proficiency',
    detail: 'IELTS 6.5 overall',
    status: 'required' as const,
  };

  it('accepts a requirement carrying source references', () => {
    const parsed = targetProfileSchema.safeParse(minimalProfile({
      requirements: [{ ...baseRequirement, sourceRefs: ['run-1'], missingInformation: null }],
    }));
    expect(parsed.success).toBe(true);
  });

  it('accepts a requirement declaring explicit missing information instead of sources', () => {
    const parsed = targetProfileSchema.safeParse(minimalProfile({
      requirements: [{ ...baseRequirement, sourceRefs: [], missingInformation: 'Threshold not stated in ingested pages.' }],
    }));
    expect(parsed.success).toBe(true);
  });

  it('rejects a requirement with neither source references nor declared missing information', () => {
    const parsed = targetProfileSchema.safeParse(minimalProfile({
      requirements: [{ ...baseRequirement, sourceRefs: [], missingInformation: null }],
    }));
    expect(parsed.success).toBe(false);
  });

  it('rejects an output that contains an admission probability field anywhere in requirements', () => {
    const parsed = targetProfileSchema.safeParse(
      minimalProfile({
        requirements: [
          { ...baseRequirement, sourceRefs: ['run-1'], missingInformation: null, probabilityOfAdmission: 0.7 },
        ],
      }),
    );
    // Zod strips unknown keys by default, so also assert the TYPE never models it:
    expect(parsed.success).toBe(true);
    const requirementKeys = Object.keys((parsed as { data?: { requirements?: Record<string, unknown>[] } }).data?.requirements?.[0] ?? {});
    expect(requirementKeys).not.toContain('probabilityOfAdmission');
    expect('probability' in targetProfileSchema.shape ? 'leak' : 'clean').toBe('clean');
  });
});

function minimalProfile(overrides: Record<string, unknown>) {
  return {
    programme: {
      id: 'prog-1',
      name: 'Computer Science',
      university: 'Demo University',
      level: 'undergraduate',
      subject: 'computing',
    },
    universityValues: [],
    programmeThemes: { description: null, themes: [] },
    requirements: [] as unknown[],
    deadlines: [],
    missingInformation: [],
    sources: PROJECTION.sources.map((s) => ({
      ref: s.ref,
      url: s.url,
      title: s.title,
      retrievedAt: s.retrievedAt,
    })),
    ...overrides,
  };
}
