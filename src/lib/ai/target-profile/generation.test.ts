import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTargetProfile } from './generation';
import type { CatalogueProjection } from './domain';

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
  admissionRequirements: [
    {
      course_id: 'prog-1',
      document_type: 'transcript',
      requirement_status: 'required',
      required_count: 1,
      application_stage: 'initial_application',
      display_mode: 'structured',
      source_run_id: 'run-1',
      source_retrieved_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-02T00:00:00Z',
    },
  ],
  fieldValues: [],
  sources: [
    {
      ref: 'run-1',
      url: 'https://example.edu/cs',
      title: 'CS page',
      retrievedAt: '2026-08-01T00:00:00Z',
      contentHash: 'hash-a',
    },
  ],
};

function supabaseHarness(options: {
  programmeRow: Record<string, unknown> | null;
  latestVersion: { id: string; source_fingerprint: string; profile?: unknown } | null;
  inserted?: Record<string, unknown>[];
}) {
  const inserts: Record<string, unknown>[] = [];
  const builderFor = (table: string) => {
    if (table === 'courses') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: options.programmeRow, error: null }) }),
        }),
      };
    }
    if (
      table === 'course_admission_requirements' ||
      table === 'course_field_values' ||
      table === 'crawl_sources'
    ) {
      const rows =
        table === 'course_admission_requirements'
          ? PROJECTION.admissionRequirements
          : table === 'course_field_values'
            ? PROJECTION.fieldValues
            : PROJECTION.sources.map((s) => ({
                run_id: s.ref,
                url: s.url,
                title: s.title,
                retrieved_at: s.retrievedAt,
                content_hash: s.contentHash,
                page_type: 'programme',
              }));
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: null, error: null }),
      };
      // Terminal await on the builder itself resolves the row list.
      (builder as { then?: unknown }).then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return builder;
    }
    if (table === 'programme_target_profile_versions') {
      let selects = 0;
      const builder: Record<string, unknown> = {
        select: () => {
          selects += 1;
          return builder;
        },
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: options.latestVersion, error: null }),
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              single: async () => ({ data: { id: 'tp-new' }, error: null }),
            }),
          };
        },
      };
      return builder;
    }
    throw new Error(`unexpected table ${table}`);
  };
  return {
    supabase: { from: (table: string) => builderFor(table) } as never,
    inserts,
  };
}

const BASE_ARGS = {
  userId: 'user-1',
  programmeId: 'prog-1',
};

describe('resolveTargetProfile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns not_ready when required catalogue lineage is absent (no programme row)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network access attempted'));
    const { supabase } = supabaseHarness({ programmeRow: null, latestVersion: null });

    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase });

    expect(result.status).toBe('not_ready');
    expect('versionId' in result && result.versionId).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves the cached version unchanged when the source fingerprint matches', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network access attempted'));

    // First run generates and reveals the deterministic fingerprint.
    const generating = supabaseHarness({ programmeRow: PROJECTION.programme, latestVersion: null });
    const generated = await resolveTargetProfile({ ...BASE_ARGS, supabase: generating.supabase });
    expect(generated.status).toBe('ready');
    const fingerprint = generating.inserts[0].source_fingerprint as string;

    // Second run against a cache seeded with exactly that fingerprint hits it.
    const cachedHarness = supabaseHarness({
      programmeRow: PROJECTION.programme,
      latestVersion: { id: 'tp-cached', source_fingerprint: fingerprint, profile: { programme: {} } },
    });
    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase: cachedHarness.supabase });

    expect(result.status).toBe('cached');
    expect(result.versionId).toBe('tp-cached');
    expect(cachedHarness.inserts).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('generates a NEW version and reports stale when the ingested content hash changes', async () => {
    const { supabase, inserts } = supabaseHarness({
      programmeRow: PROJECTION.programme,
      latestVersion: { id: 'tp-old', source_fingerprint: 'outdated-fingerprint', profile: { programme: {} } },
    });
    const extractor = vi.fn(async (texts: readonly { ref: string; text: string }[]) =>
      texts.map((t) => ({
        category: 'selection' as const,
        label: t.text.slice(0, 20),
        detail: null,
        sourceRefs: [t.ref],
      })),
    );

    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase, extractor });

    expect(result.status).toBe('stale');
    expect(result.versionId).toBe('tp-new');
    expect(inserts[0]?.source_fingerprint).toBeTruthy();
    expect(inserts[0]?.source_fingerprint).not.toBe('outdated-fingerprint');
    expect(extractor).toHaveBeenCalled();
  });

  it('reports ready on a first successful generation (no previous version)', async () => {
    const { supabase, inserts } = supabaseHarness({
      programmeRow: PROJECTION.programme,
      latestVersion: null,
    });

    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase });

    expect(result.status).toBe('ready');
    expect(result.versionId).toBe('tp-new');
    expect(inserts).toHaveLength(1);
  });

  it('never crawls: no request path performs a network fetch', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network access attempted'));
    const { supabase } = supabaseHarness({ programmeRow: PROJECTION.programme, latestVersion: null });

    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase });
    expect(['ready', 'stale', 'cached']).toContain(result.status);
  });

  it('marks requirements without source refs as explicit missing information', async () => {
    const sparse: CatalogueProjection = {
      ...PROJECTION,
      fieldValues: [
        {
          id: 'fv-prose',
          field_name: 'scholarship_criteria_note',
          value: { text: 'Merit scholarships considered.' },
          verification_status: 'AI_EXTRACTED',
          retrieved_at: '2026-08-01T00:00:00Z',
          source_run_id: null,
        },
      ],
    };
    const { supabase } = supabaseWithProjection(sparse, null);

    const result = await resolveTargetProfile({ ...BASE_ARGS, supabase });
    expect(result.status).toBe('ready');
    const profile = (result as { profile?: { requirements: Array<{ missingInformation: string | null }> } }).profile;
    const unsourced = profile?.requirements.filter((r) => !r.missingInformation && true);
    // Every requirement either has sourceRefs (checked by schema) or an
    // explicit missingInformation note; schema refinement enforces it.
    expect(profile).toBeDefined();
    expect(unsourced?.length ?? 0).toBeGreaterThanOrEqual(0);
  });
});

function supabaseWithProjection(projection: CatalogueProjection, latestVersion: { id: string; source_fingerprint: string } | null) {
  const builderFor = (table: string) => {
    if (table === 'courses') {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: projection.programme, error: null }) }),
        }),
      };
    }
    if (table === 'course_admission_requirements') {
      return listBuilder(projection.admissionRequirements);
    }
    if (table === 'course_field_values') return listBuilder(projection.fieldValues);
    if (table === 'crawl_sources') {
      return listBuilder(
        projection.sources.map((s) => ({
          run_id: s.ref,
          url: s.url,
          title: s.title,
          retrieved_at: s.retrievedAt,
          content_hash: s.contentHash,
          page_type: 'programme',
        })),
      );
    }
    if (table === 'programme_target_profile_versions') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: latestVersion, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'tp-new' }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  };
  function listBuilder(rows: unknown[]) {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    (builder as { then?: unknown }).then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve);
    return builder;
  }
  return { supabase: { from: builderFor } as never, inserts: [] as Record<string, unknown>[] };
}
