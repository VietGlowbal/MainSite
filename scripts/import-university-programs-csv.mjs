import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 100;
const VERIFICATION_STATUS = 'NEEDS_REVIEW';
const SOURCE_NAME = 'uploaded_csv';

const CORE_COLUMNS = [
  'University Name',
  'Program Name',
  'Degree',
  'School / College',
  'Department',
  'Program Link',
  'Location',
  'Duration',
  'Country',
];

export function parseCsv(text) {
  const matrix = [];
  let row = [];
  let field = '';
  let quoted = false;

  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      matrix.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV ended inside a quoted field.');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    matrix.push(row);
  }
  if (matrix.length < 2) throw new Error('CSV must contain a header and at least one data row.');

  const headers = matrix[0].map((header) => header.trim());
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV contains duplicate headers: ${[...new Set(duplicateHeaders)].join(', ')}`);
  }

  const rows = matrix.slice(1).filter((values) => values.some((value) => value.trim().length > 0));
  for (const [index, values] of rows.entries()) {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} fields; expected ${headers.length}.`,
      );
    }
  }

  return {
    headers,
    rows: rows.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index].trim()])),
    ),
  };
}

export function normalizeUniversityName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]{1,24}\)\s*/g, ' ')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProgrammeName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(value) {
  const parsed = new URL(value);
  parsed.hash = '';
  parsed.search = '';
  parsed.hostname = parsed.hostname.toLocaleLowerCase('en-US');
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  return parsed.toString().replace(/\/$/, '');
}

export function inferDegreeLevel(degree, programmeName = '') {
  const value = `${degree} ${programmeName}`.toLocaleLowerCase('en-US');
  if (/\b(ph\.?d|doctor of philosophy|doctoral)\b/.test(value)) return 'phd';
  if (
    /\b(j\.?d\.?|juris doctor|m\.?d\.?|doctor of medicine|dds|dmd|dvm|vmd|pharmd|ed\.?d)\b/.test(
      value,
    )
  ) {
    return 'professional';
  }
  if (
    /\b(master|mba|m\.?(a|s|eng|ed|fa|ph|pp|pa|sn)\.?|sm|llm|mph|mpp|mpa|meng|msn)\b/.test(
      value,
    )
  ) {
    return 'master';
  }
  if (
    /\b(bachelor|b\.?s\.?e?|b\.?a\.?s?|a\.?b\.?|s\.?b\.?|bsn|undergraduate)\b/.test(
      value,
    )
  ) {
    return 'bachelor';
  }
  return null;
}

export function credentialFromDegree(value) {
  const compact = value
    .split(/[;(—–]/, 1)[0]
    .replace(/\s+/g, ' ')
    .trim();
  return compact ? compact.slice(0, 120) : null;
}

function isPresent(value) {
  return Boolean(value && value.trim() && value.trim().toLocaleUpperCase('en-US') !== 'N/A');
}

function stableUuid(namespace, value) {
  const bytes = createHash('sha256').update(`${namespace}\u001f${value}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slug(value) {
  return normalizeProgrammeName(value).replace(/\s+/g, '-').slice(0, 48) || 'programme';
}

export function disambiguateProgrammeUrls(rows) {
  const byUrl = Map.groupBy(rows, (row) => normalizeUrl(row['Program Link']));
  return rows.map((row) => {
    const baseUrl = normalizeUrl(row['Program Link']);
    const siblings = byUrl.get(baseUrl) ?? [];
    if (siblings.length === 1) return baseUrl;
    const suffix = stableUuid(
      'glowbal-programme-link',
      `${row['University Name']}|${row['Program Name']}|${row.Degree}`,
    ).slice(0, 8);
    return `${baseUrl}#glowbal-program=${slug(row['Program Name'])}-${suffix}`;
  });
}

function hostMatchesDomain(url, domain) {
  if (!domain) return false;
  const hostname = new URL(url).hostname.toLocaleLowerCase('en-US').replace(/^www\./, '');
  const expected = domain.toLocaleLowerCase('en-US').replace(/^www\./, '');
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

function fieldConsensus(rows, field) {
  const values = rows.map((row) => row[field]).filter(isPresent);
  const groups = Map.groupBy(values, (value) => value.replace(/\s+/g, ' ').trim());
  return [...groups.entries()]
    .map(([value, matches]) => ({ value, count: matches.length }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export function buildImportPlan({ rows, headers, universities, fileName, fileHash, retrievedAt }) {
  const missingColumns = CORE_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
  }

  const invalidRows = rows.flatMap((row, index) => {
    const missing = CORE_COLUMNS.slice(0, 6).filter((column) => !isPresent(row[column]));
    return missing.length > 0 ? [{ row: index + 2, missing }] : [];
  });
  if (invalidRows.length > 0) {
    throw new Error(`CSV has incomplete core rows: ${JSON.stringify(invalidRows.slice(0, 10))}`);
  }

  const universityGroups = Map.groupBy(rows, (row) => row['University Name']);
  const universityCandidates = Map.groupBy(universities, (university) =>
    normalizeUniversityName(university.name ?? ''),
  );
  const resolvedUniversities = new Map();

  for (const [sourceName, sourceRows] of universityGroups) {
    const nameMatches = universityCandidates.get(normalizeUniversityName(sourceName)) ?? [];
    const sourceHosts = new Set(sourceRows.map((row) => new URL(row['Program Link']).hostname));
    const domainMatches = universities.filter(
      (university) =>
        university.primary_domain &&
        [...sourceHosts].some((hostname) =>
          hostMatchesDomain(`https://${hostname}`, university.primary_domain),
        ),
    );
    const candidates = nameMatches.length > 0 ? nameMatches : domainMatches;
    if (candidates.length === 0) {
      throw new Error(`No university match for "${sourceName}".`);
    }
    const ordered = [...candidates].sort((left, right) => left.id - right.id);
    const chosen = ordered[0];
    const metadataSource = ordered.find(
      (candidate) => candidate.primary_domain && candidate.official_url,
    );
    resolvedUniversities.set(sourceName, {
      ...chosen,
      // The directory intentionally chooses the lowest-id, fully populated
      // identity. A few historical duplicates have the domain metadata only on
      // the later sparse row, so borrow it for validation without changing the
      // selected university id or writing back to universities.
      primary_domain: chosen.primary_domain ?? metadataSource?.primary_domain ?? null,
      official_url: chosen.official_url ?? metadataSource?.official_url ?? null,
    });
  }

  const domainMismatches = rows.flatMap((row, index) => {
    const university = resolvedUniversities.get(row['University Name']);
    return hostMatchesDomain(row['Program Link'], university.primary_domain)
      ? []
      : [
          {
            row: index + 2,
            university: row['University Name'],
            url: row['Program Link'],
            expectedDomain: university.primary_domain,
          },
        ];
  });
  if (domainMismatches.length > 0) {
    throw new Error(
      `Program links outside the matched university domain: ${JSON.stringify(domainMismatches.slice(0, 10))}`,
    );
  }

  const effectiveUrls = disambiguateProgrammeUrls(rows);
  const institutions = [];
  const organisationUnits = new Map();
  const programmes = [];
  const programmeRelations = [];

  for (const [sourceName, sourceRows] of universityGroups) {
    const university = resolvedUniversities.get(sourceName);
    const institutionId = `csv-university-${university.id}`;
    institutions.push({
      institution_id: institutionId,
      university_id: university.id,
      canonical_name: university.name,
      country_code: university.country_code ?? 'US',
      official_domain: university.primary_domain,
      official_url: university.official_url,
      verification_status: VERIFICATION_STATUS,
      last_checked_at: retrievedAt,
      payload: {
        source: SOURCE_NAME,
        source_name: sourceName,
        row_count: sourceRows.length,
        repeated_field_consensus: Object.fromEntries(
          ['University Type', 'QS Ranking 2026', 'THE Ranking 2026', 'ARWU Ranking'].map(
            (field) => [field, fieldConsensus(sourceRows, field)],
          ),
        ),
      },
    });
  }

  rows.forEach((row, index) => {
    const university = resolvedUniversities.get(row['University Name']);
    const institutionId = `csv-university-${university.id}`;
    let schoolId = null;
    let departmentId = null;

    if (isPresent(row['School / College'])) {
      schoolId = stableUuid(
        'glowbal-csv-academic-unit',
        `${university.id}|school|${normalizeProgrammeName(row['School / College'])}`,
      );
      organisationUnits.set(schoolId, {
        organisation_unit_id: schoolId,
        institution_id: institutionId,
        parent_organisation_unit_id: null,
        unit_name: row['School / College'],
        unit_type: 'school',
        official_url: null,
        source_url: row['Program Link'],
        evidence: `School / College: ${row['School / College']}`,
        confidence: 0.55,
        verification_status: VERIFICATION_STATUS,
        retrieved_at: retrievedAt,
        payload: { source: SOURCE_NAME },
      });
    }

    // The current product groups programmes by school/college. Department is
    // still preserved in raw_fields, but is promoted as an academic unit only
    // when a row has no school-level unit to group under.
    if (!schoolId && isPresent(row.Department)) {
      departmentId = stableUuid(
        'glowbal-csv-academic-unit',
        `${university.id}|department|${schoolId ?? ''}|${normalizeProgrammeName(row.Department)}`,
      );
      organisationUnits.set(departmentId, {
        organisation_unit_id: departmentId,
        institution_id: institutionId,
        parent_organisation_unit_id: schoolId,
        unit_name: row.Department,
        unit_type: 'department',
        official_url: null,
        source_url: row['Program Link'],
        evidence: `Department: ${row.Department}`,
        confidence: 0.55,
        verification_status: VERIFICATION_STATUS,
        retrieved_at: retrievedAt,
        payload: { source: SOURCE_NAME },
      });
    }

    const programmeId = stableUuid(
      'glowbal-csv-programme',
      `${university.id}|${normalizeProgrammeName(row['Program Name'])}|${normalizeProgrammeName(row.Degree)}|${normalizeUrl(row['Program Link'])}`,
    );
    const primaryUnitId = schoolId ?? departmentId;
    programmes.push({
      programme_id: programmeId,
      institution_id: institutionId,
      programme_name: row['Program Name'],
      official_url: effectiveUrls[index],
      degree_level: inferDegreeLevel(row.Degree, row['Program Name']),
      credential: credentialFromDegree(row.Degree),
      normalized_field: null,
      organisation_unit_id: primaryUnitId,
      language: null,
      campus: null,
      delivery_mode: null,
      duration: row.Duration,
      programme_status: null,
      catalogue_source: SOURCE_NAME,
      retrieved_at: retrievedAt,
      verification_status: VERIFICATION_STATUS,
      is_deep_selected: true,
      selection_basis: 'User-provided university programme dataset',
      payload: {
        source: SOURCE_NAME,
        source_file: fileName,
        source_file_sha256: fileHash,
        source_official_url: normalizeUrl(row['Program Link']),
        location: row.Location,
        raw_fields: row,
      },
    });

    if (primaryUnitId) {
      programmeRelations.push({
        programme_id: programmeId,
        organisation_unit_id: primaryUnitId,
        relationship_type: 'administered_by',
        is_primary: true,
        source_url: row['Program Link'],
        evidence: schoolId
          ? `School / College: ${row['School / College']}`
          : `Department: ${row.Department}`,
        confidence: 0.55,
        verification_status: VERIFICATION_STATUS,
        payload: { source: SOURCE_NAME },
      });
    }
  });

  const duplicateUrlGroups = [...Map.groupBy(rows, (row) => normalizeUrl(row['Program Link'])).entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([url, matches]) => ({
      url,
      programmes: matches.map((row) => `${row['Program Name']} (${row.Degree})`),
    }));

  return {
    runKey: `manual-us-programs-${fileHash.slice(0, 16)}`,
    resolvedUniversities,
    duplicateUrlGroups,
    institutions,
    organisationUnits: [...organisationUnits.values()],
    programmes,
    programmeRelations,
  };
}

export function applyExistingCataloguePolicy(plan, existingCatalog) {
  const byExactUrl = Map.groupBy(existingCatalog, (programme) => programme.official_url);
  const byIdentity = Map.groupBy(
    existingCatalog,
    (programme) =>
      `${programme.university_id}|${normalizeProgrammeName(programme.programme_name)}|${programme.degree_level ?? ''}`,
  );

  const programmes = plan.programmes.map((sourceProgramme) => {
    let programme = sourceProgramme;
    const universityId = Number.parseInt(
      programme.institution_id.replace('csv-university-', ''),
      10,
    );
    const exactMatches = byExactUrl.get(programme.official_url) ?? [];
    const crossUniversityMatch = exactMatches.find(
      (existing) => existing.university_id !== universityId,
    );
    if (crossUniversityMatch) {
      throw new Error(
        `Programme URL ${programme.official_url} already belongs to university ${crossUniversityMatch.university_id}; refusing to re-home it to ${universityId}.`,
      );
    }
    const exactSameDegree = exactMatches.filter(
      (existing) => existing.degree_level === programme.degree_level,
    );
    if (exactMatches.length > 0 && exactSameDegree.length === 0) {
      const baseUrl = normalizeUrl(programme.payload.source_official_url ?? programme.official_url);
      const suffix = stableUuid(
        'glowbal-existing-programme-link',
        `${universityId}|${programme.programme_name}|${programme.degree_level ?? ''}`,
      ).slice(0, 8);
      programme = {
        ...programme,
        official_url: `${baseUrl}#glowbal-program=${slug(programme.programme_name)}-${suffix}`,
        payload: {
          ...programme.payload,
          import_url_decision: 'disambiguate_existing_url_with_different_degree',
          colliding_programmes: exactMatches.map((existing) => ({
            programme_id: existing.programme_id,
            programme_name: existing.programme_name,
            degree_level: existing.degree_level,
            official_url: existing.official_url,
          })),
        },
      };
    }
    const identityKey = `${universityId}|${normalizeProgrammeName(programme.programme_name)}|${programme.degree_level ?? ''}`;
    const identityMatches = byIdentity.get(identityKey) ?? [];
    const matches = exactSameDegree.length > 0 ? exactSameDegree : identityMatches;
    if (matches.length === 0) return programme;

    return {
      ...programme,
      verification_status: 'REJECTED',
      payload: {
        ...programme.payload,
        import_decision: 'skip_existing_catalogue_programme',
        match_basis: exactMatches.length > 0 ? 'exact_course_url' : 'name_and_degree',
        existing_programmes: matches.map((existing) => ({
          programme_id: existing.programme_id,
          programme_name: existing.programme_name,
          university_id: existing.university_id,
          degree_level: existing.degree_level,
          official_url: existing.official_url,
        })),
      },
    };
  });

  const rejectedIds = new Set(
    programmes
      .filter((programme) => programme.verification_status === 'REJECTED')
      .map((programme) => programme.programme_id),
  );
  const programmeRelations = plan.programmeRelations.filter(
    (relation) => !rejectedIds.has(relation.programme_id),
  );
  const usedUnitIds = new Set(
    programmeRelations.map((relation) => relation.organisation_unit_id),
  );

  return {
    ...plan,
    programmes,
    programmeRelations,
    organisationUnits: plan.organisationUnits.filter((unit) =>
      usedUnitIds.has(unit.organisation_unit_id),
    ),
  };
}

async function readAll(supabase, table, select = '*') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function upsertBatches(supabase, table, rows, onConflict) {
  for (let from = 0; from < rows.length; from += BATCH_SIZE) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(from, from + BATCH_SIZE), { onConflict });
    if (error) throw new Error(`${table} batch ${from / BATCH_SIZE + 1}: ${error.message}`);
  }
}

function summarizePlan(plan, existingCatalog, existingRun) {
  const promotableProgrammes = plan.programmes.filter(
    (programme) => programme.verification_status !== 'REJECTED',
  );
  const skippedProgrammes = plan.programmes.filter(
    (programme) => programme.verification_status === 'REJECTED',
  );
  const catalogByExactUrl = Map.groupBy(existingCatalog, (programme) => programme.official_url);
  const catalogByNormalizedUrl = Map.groupBy(existingCatalog, (programme) => {
    try {
      return normalizeUrl(programme.official_url);
    } catch {
      return programme.official_url;
    }
  });
  const programmeTargetId = (programme) =>
    Number.parseInt(programme.institution_id.replace('csv-university-', ''), 10);
  const exactGlobalMatches = promotableProgrammes.flatMap((programme) =>
    (catalogByExactUrl.get(programme.official_url) ?? []).map((existing) => ({
      incoming_programme: programme.programme_name,
      incoming_university_id: programmeTargetId(programme),
      existing_programme: existing.programme_name,
      existing_university_id: existing.university_id,
      official_url: programme.official_url,
    })),
  );
  const normalizedGlobalMatches = promotableProgrammes.flatMap((programme) =>
    (catalogByNormalizedUrl.get(normalizeUrl(programme.official_url)) ?? []).map((existing) => ({
      incoming_programme: programme.programme_name,
      incoming_university_id: programmeTargetId(programme),
      existing_programme: existing.programme_name,
      existing_university_id: existing.university_id,
      incoming_url: programme.official_url,
      existing_url: existing.official_url,
    })),
  );
  const byUniversity = [...plan.resolvedUniversities.entries()].map(([sourceName, university]) => {
    const sourceProgrammes = plan.programmes.filter(
      (programme) => programme.institution_id === `csv-university-${university.id}`,
    );
    const planned = sourceProgrammes.filter(
      (programme) => programme.verification_status !== 'REJECTED',
    );
    const skipped = sourceProgrammes.filter(
      (programme) => programme.verification_status === 'REJECTED',
    );
    const current = existingCatalog.filter((programme) => programme.university_id === university.id);
    const currentUrls = new Set(current.map((programme) => programme.official_url));
    const currentIdentities = new Set(
      current.map(
        (programme) =>
          `${normalizeProgrammeName(programme.programme_name)}|${programme.degree_level ?? ''}`,
      ),
    );
    const identityMatches = planned.flatMap((programme) => {
      const key = `${normalizeProgrammeName(programme.programme_name)}|${programme.degree_level ?? ''}`;
      return current
        .filter(
          (existing) =>
            `${normalizeProgrammeName(existing.programme_name)}|${existing.degree_level ?? ''}` === key,
        )
        .map((existing) => ({
          incoming_programme: programme.programme_name,
          existing_programme: existing.programme_name,
          degree_level: programme.degree_level,
          incoming_url: programme.official_url,
          existing_url: existing.official_url,
        }));
    });
    return {
      source_name: sourceName,
      university_id: university.id,
      database_name: university.name,
      planned_programmes: planned.length,
      skipped_existing_programmes: skipped.length,
      existing_programmes: current.length,
      exact_effective_url_overlaps: planned.filter((programme) =>
        currentUrls.has(programme.official_url),
      ).length,
      name_and_degree_overlaps: planned.filter((programme) =>
        currentIdentities.has(
          `${normalizeProgrammeName(programme.programme_name)}|${programme.degree_level ?? ''}`,
        ),
      ).length,
      name_and_degree_overlap_details: identityMatches,
    };
  });

  const degreeLevels = Object.fromEntries(
    [...Map.groupBy(plan.programmes, (programme) => programme.degree_level ?? 'unmapped').entries()]
      .map(([level, programmes]) => [level, programmes.length])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  return {
    mode: 'dry-run',
    run_key: plan.runKey,
    existing_run_status: existingRun?.status ?? null,
    csv_programmes: plan.programmes.length,
    promotable_programmes: promotableProgrammes.length,
    skipped_existing_programmes: skippedProgrammes.map((programme) => ({
      incoming_programme: programme.programme_name,
      university_id: programmeTargetId(programme),
      degree_level: programme.degree_level,
      official_url: programme.official_url,
      match_basis: programme.payload.match_basis,
      existing_programmes: programme.payload.existing_programmes,
    })),
    universities: plan.institutions.length,
    academic_units: plan.organisationUnits.length,
    programme_academic_units: plan.programmeRelations.length,
    degree_levels: degreeLevels,
    unmapped_degree_programmes: plan.programmes
      .filter((programme) => programme.degree_level == null)
      .map((programme) => ({
        programme_name: programme.programme_name,
        raw_degree: programme.payload.raw_fields.Degree,
        university_id: programmeTargetId(programme),
      })),
    duplicate_source_url_groups: plan.duplicateUrlGroups,
    promotion_impact: {
      exact_course_url_updates: exactGlobalMatches.length,
      likely_inserts: promotableProgrammes.length - exactGlobalMatches.length,
      cross_university_rehomes: exactGlobalMatches.filter(
        (match) => match.incoming_university_id !== match.existing_university_id,
      ),
      exact_course_url_update_details: exactGlobalMatches,
      normalized_url_overlap_details: normalizedGlobalMatches,
    },
    tables_if_approved: {
      crawl_runs: 1,
      crawl_institutions: plan.institutions.length,
      crawl_organisation_units: plan.organisationUnits.length,
      crawl_programmes: plan.programmes.length,
      crawl_programme_organisation_units: plan.programmeRelations.length,
      courses_likely_inserted: promotableProgrammes.length - exactGlobalMatches.length,
      courses_updated_by_exact_url: exactGlobalMatches.length,
      academic_units_upserted: plan.organisationUnits.length,
      course_academic_units_upserted: plan.programmeRelations.length,
      catalog_promotions: 1,
      course_field_values: 0,
      university_profiles: 0,
    },
    by_university: byUniversity,
  };
}

async function applyPlan(supabase, plan, metadata) {
  const { data: existingRuns, error: existingRunError } = await supabase
    .from('crawl_runs')
    .select('id,status')
    .eq('run_key', plan.runKey)
    .limit(1);
  if (existingRunError) throw new Error(`crawl_runs preflight: ${existingRunError.message}`);

  let runId;
  const existing = existingRuns?.[0];
  if (existing) {
    runId = existing.id;
    if (!['failed', 'importing', 'completed', 'approved'].includes(existing.status)) {
      throw new Error(`Run ${plan.runKey} has unsupported status ${existing.status}.`);
    }
    if (['completed', 'approved'].includes(existing.status)) {
      const { data: promotion, error: promotionError } = await supabase
        .from('catalog_promotions')
        .select('source_run_id,counts')
        .eq('source_run_id', runId)
        .maybeSingle();
      if (promotionError) throw new Error(`catalog_promotions: ${promotionError.message}`);
      if (promotion) return { already_imported: true, run_id: runId, counts: promotion.counts };
    }
    const { error } = await supabase
      .from('crawl_runs')
      .update({ status: 'importing', notes: null })
      .eq('id', runId);
    if (error) throw new Error(`crawl_runs retry: ${error.message}`);
  } else {
    const { data, error } = await supabase
      .from('crawl_runs')
      .insert({
        run_key: plan.runKey,
        pipeline_version: 'manual-csv-v1',
        config_name: 'user-provided-us-university-programmes',
        status: 'importing',
        started_at: metadata.retrievedAt,
        imported_at: new Date().toISOString(),
        metrics: metadata.metrics,
        coverage_report: metadata.coverageReport,
        source_manifest: metadata.sourceManifest,
        notes: 'Imported from a user-provided CSV; rich non-core fields remain in crawl_programmes.payload pending source-level validation.',
      })
      .select('id')
      .single();
    if (error) throw new Error(`crawl_runs insert: ${error.message}`);
    runId = data.id;
  }

  const withRunId = (rows) => rows.map((row) => ({ run_id: runId, ...row }));
  try {
    await upsertBatches(
      supabase,
      'crawl_institutions',
      withRunId(plan.institutions),
      'run_id,institution_id',
    );
    await upsertBatches(
      supabase,
      'crawl_organisation_units',
      withRunId(plan.organisationUnits),
      'run_id,organisation_unit_id',
    );
    await upsertBatches(
      supabase,
      'crawl_programmes',
      withRunId(plan.programmes),
      'run_id,programme_id',
    );
    await upsertBatches(
      supabase,
      'crawl_programme_organisation_units',
      withRunId(plan.programmeRelations),
      'run_id,programme_id,organisation_unit_id',
    );

    const { error: completedError } = await supabase
      .from('crawl_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', runId);
    if (completedError) throw new Error(`crawl_runs complete: ${completedError.message}`);

    const { data: dryRun, error: dryRunError } = await supabase.rpc('promote_crawl_run', {
      p_run_id: runId,
      p_dry_run: true,
    });
    if (dryRunError) throw new Error(`promote_crawl_run dry-run: ${dryRunError.message}`);

    const { data: promoted, error: promoteError } = await supabase.rpc('promote_crawl_run', {
      p_run_id: runId,
      p_dry_run: false,
    });
    if (promoteError) throw new Error(`promote_crawl_run: ${promoteError.message}`);

    return { already_imported: false, run_id: runId, promotion_dry_run: dryRun, promoted };
  } catch (error) {
    await supabase
      .from('crawl_runs')
      .update({ status: 'failed', notes: String(error.message ?? error).slice(0, 1000) })
      .eq('id', runId);
    throw error;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const confirmedRunKey = process.argv
    .find((argument) => argument.startsWith('--confirm-run-key='))
    ?.slice('--confirm-run-key='.length);
  const positional = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  const inputPath = positional[0];
  if (!inputPath) {
    throw new Error(
      'Usage: npm run import:university-programs -- <path-to.csv> [--apply]. Default is dry-run.',
    );
  }

  const [fileText, fileStats] = await Promise.all([fs.readFile(inputPath, 'utf8'), fs.stat(inputPath)]);
  const fileHash = createHash('sha256').update(fileText).digest('hex');
  const parsed = parseCsv(fileText);
  const retrievedAt = fileStats.mtime.toISOString();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [universities, existingCatalog] = await Promise.all([
    readAll(
      supabase,
      'universities',
      'id,name,country,country_code,primary_domain,official_url',
    ),
    readAll(
      supabase,
      'catalog_programmes',
      'programme_id,university_id,programme_name,official_url,canonical_url,degree_level',
    ),
  ]);
  const plan = applyExistingCataloguePolicy(
    buildImportPlan({
      ...parsed,
      universities,
      fileName: basename(inputPath),
      fileHash,
      retrievedAt,
    }),
    existingCatalog,
  );
  const { data: existingRuns, error: runError } = await supabase
    .from('crawl_runs')
    .select('id,status')
    .eq('run_key', plan.runKey)
    .limit(1);
  if (runError) throw new Error(`crawl_runs preflight: ${runError.message}`);

  const summary = summarizePlan(plan, existingCatalog, existingRuns?.[0]);
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log(
      `Dry-run only. Database writes require --apply --confirm-run-key=${plan.runKey} after explicit owner approval.`,
    );
    return;
  }
  if (confirmedRunKey !== plan.runKey) {
    throw new Error(
      `Write blocked. After explicit owner approval, pass --confirm-run-key=${plan.runKey} with --apply.`,
    );
  }

  const byUniversity = Object.fromEntries(
    [...plan.resolvedUniversities.entries()].map(([sourceName, university]) => [
      sourceName,
      {
        university_id: university.id,
        programme_count: plan.programmes.filter(
          (programme) => programme.institution_id === `csv-university-${university.id}`,
        ).length,
      },
    ]),
  );
  const result = await applyPlan(supabase, plan, {
    retrievedAt,
    metrics: {
      csv_rows: parsed.rows.length,
      csv_columns: parsed.headers.length,
      universities: plan.institutions.length,
      programmes: plan.programmes.length,
      academic_units: plan.organisationUnits.length,
    },
    coverageReport: { by_university: byUniversity },
    sourceManifest: {
      file_name: basename(inputPath),
      sha256: fileHash,
      columns: parsed.headers,
      rich_fields_policy:
        'Stored in crawl_programmes.payload only; not promoted as structured facts without per-field source provenance.',
    },
  });

  const { count, error: verifyError } = await supabase
    .from('catalog_programmes')
    .select('programme_id', { count: 'exact', head: true })
    .eq('source_run_id', result.run_id);
  if (verifyError) throw new Error(`catalog verification: ${verifyError.message}`);
  const expectedPromoted = plan.programmes.filter(
    (programme) => programme.verification_status !== 'REJECTED',
  ).length;
  if (count !== expectedPromoted) {
    throw new Error(
      `Catalog verification expected ${expectedPromoted} promoted programmes, found ${count}.`,
    );
  }

  console.log(
    JSON.stringify(
      { mode: 'apply', ...result, verified_catalog_programmes: count },
      null,
      2,
    ),
  );
}

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
