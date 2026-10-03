import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  applyExistingCataloguePolicy,
  applyPlan,
  buildImportPlan,
  readAll,
  revalidateUniversityCaches,
  stableUuid,
} from './import-university-programs-csv.mjs';

const UNIVERSITY_ID = 97;
const EXPECTED = { colleges: 4, programmes: 12, assertions: 60 };
const HEADERS = [
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validateSource(source) {
  if (source?.source?.review_status !== 'HUMAN_VERIFIED') {
    throw new Error('VinUni source must be HUMAN_VERIFIED.');
  }
  if (source?.university?.id !== UNIVERSITY_ID) {
    throw new Error(`VinUni source must target university ${UNIVERSITY_ID}.`);
  }
  if (source.colleges?.length !== EXPECTED.colleges) {
    throw new Error(`Expected ${EXPECTED.colleges} colleges, found ${source.colleges?.length ?? 0}.`);
  }
  if (source.programmes?.length !== EXPECTED.programmes) {
    throw new Error(`Expected ${EXPECTED.programmes} programmes, found ${source.programmes?.length ?? 0}.`);
  }
  const names = new Set(source.programmes.map((programme) => programme.name));
  if (names.size !== EXPECTED.programmes) throw new Error('VinUni programme names must be unique.');
  const assertions = source.programmes.reduce((count, programme) => count + programme.facts.length, 0);
  if (assertions !== EXPECTED.assertions || source.programmes.some((programme) => programme.facts.length !== 5)) {
    throw new Error(`Expected ${EXPECTED.assertions} assertions in five-field programme blocks, found ${assertions}.`);
  }
}

export function buildVinUniPlan(source, university) {
  validateSource(source);
  if (university.id !== UNIVERSITY_ID || university.name !== source.university.name) {
    throw new Error(`Supabase university ${university.id} does not match reviewed VinUni source.`);
  }

  const retrievedAt = source.source.retrieved_at;
  const rows = source.programmes.map((programme) => ({
    'University Name': source.university.name,
    'Program Name': programme.name,
    Degree: programme.degree,
    'School / College': programme.college,
    Department: 'Not provided in reviewed workbook',
    'Program Link': programme.official_url,
    Location: 'Hanoi, Vietnam',
    Duration: programme.duration ?? '',
    Country: 'Vietnam',
  }));
  const normalizedHash = sha256(JSON.stringify(source));
  const plan = buildImportPlan({
    rows,
    headers: HEADERS,
    universities: [{
      ...university,
      country_code: university.country_code ?? 'VN',
      primary_domain: university.primary_domain ?? 'vinuni.edu.vn',
      official_url: university.official_url ?? source.university.official_url,
    }],
    fileName: source.source.file_name,
    fileHash: source.source.sha256,
    retrievedAt,
    verificationStatus: 'HUMAN_VERIFIED',
    catalogueSource: 'reviewed_workbook',
  });
  plan.runKey = `vinuni-reviewed-${source.source.sha256.slice(0, 12)}-${normalizedHash.slice(0, 12)}`;
  plan.institutions[0] = {
    ...plan.institutions[0],
    payload: {
      ...plan.institutions[0].payload,
      school_profile: {
        fields: source.university.profile,
        source_urls: [source.university.official_url],
      },
    },
  };
  plan.organisationUnits = plan.organisationUnits.map((unit) => ({ ...unit, confidence: 1 }));
  plan.programmeRelations = plan.programmeRelations.map((relation) => ({ ...relation, confidence: 1 }));
  plan.programmes = plan.programmes.map((programme) => ({
    ...programme,
    selection_basis: 'Reviewed VinUni workbook',
  }));
  const fieldAssertions = plan.programmes.flatMap((programme, programmeIndex) =>
    source.programmes[programmeIndex].facts.map((fact) => ({
      assertion_id: stableUuid('vinuni-reviewed-assertion', `${programme.programme_id}|${fact.field_name}`),
      entity_type: 'programme',
      entity_id: programme.programme_id,
      field_name: fact.field_name,
      value_json: {
        title: fact.title,
        content: fact.content,
        applications: fact.applications,
      },
      null_reason: null,
      source_url: fact.source.url ?? source.programmes[programmeIndex].official_url,
      source_type: 'reviewed_workbook',
      evidence: null,
      evidence_locator: `${fact.source.sheet}!${fact.source.content_cell}`,
      scope: 'programme',
      audience: fact.applications.join('; ') || null,
      academic_cycle: null,
      retrieved_at: retrievedAt,
      confidence: 1,
      verification_status: 'HUMAN_VERIFIED',
      extractor_version: 'vinuni-reviewed-v1',
      model_name: null,
      validation_errors: [],
      extraction_group: fact.source.sheet,
      applicability_source_url: null,
      applicability_evidence: null,
      source_content_hash: sha256(fact.content),
      is_effective: true,
    })),
  );
  return { ...plan, fieldAssertions };
}

async function count(supabase, table, configure = (query) => query) {
  const { count: value, error } = await configure(
    supabase.from(table).select('*', { count: 'exact', head: true }),
  );
  if (error) throw new Error(`${table} verification: ${error.message}`);
  return value ?? 0;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const confirmedRunKey = process.argv.find((arg) => arg.startsWith('--confirm-run-key='))?.split('=')[1];
  const sourcePath = resolve('data/vinuni-reviewed.json');
  const workbookPath = resolve('data/VinUni data.xlsx');
  const [sourceText, workbook] = await Promise.all([fs.readFile(sourcePath, 'utf8'), fs.readFile(workbookPath)]);
  const source = JSON.parse(sourceText);
  if (sha256(workbook) !== source.source.sha256) {
    throw new Error('VinUni workbook hash differs from the reviewed normalized source.');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ data: university, error: universityError }, existingCatalog] = await Promise.all([
    supabase.from('universities').select('id,name,country,country_code,primary_domain,official_url').eq('id', UNIVERSITY_ID).single(),
    readAll(supabase, 'catalog_programmes', 'programme_id,university_id,programme_name,official_url,canonical_url,degree_level'),
  ]);
  if (universityError) throw new Error(`VinUniversity preflight: ${universityError.message}`);
  const plan = applyExistingCataloguePolicy(buildVinUniPlan(source, university), existingCatalog, { updateExisting: true });
  const summary = {
    mode: apply ? 'apply-requested' : 'dry-run',
    run_key: plan.runKey,
    university_id: UNIVERSITY_ID,
    workbook_sha256: source.source.sha256,
    counts: {
      colleges: plan.organisationUnits.length,
      programmes: plan.programmes.length,
      assertions: plan.fieldAssertions.length,
      existing_programmes_updated: plan.programmes.filter((row) => row.payload.import_decision === 'update_existing_catalogue_programme').length,
    },
    duplicate_source_urls: plan.duplicateUrlGroups,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log(`Dry-run only. Apply with --apply --confirm-run-key=${plan.runKey}`);
    return;
  }
  if (confirmedRunKey !== plan.runKey) throw new Error(`Write blocked. Pass --confirm-run-key=${plan.runKey}.`);

  const otherUniversitiesBefore = await count(supabase, 'catalog_programmes', (query) => query.neq('university_id', UNIVERSITY_ID));
  const result = await applyPlan(supabase, plan, {
    retrievedAt: source.source.retrieved_at,
    pipelineVersion: 'vinuni-reviewed-v1',
    configName: 'vinuni-reviewed-workbook',
    notes: 'Imported from the owner-reviewed VinUni workbook; Supabase is the runtime source of truth.',
    metrics: summary.counts,
    coverageReport: { university_id: UNIVERSITY_ID, expected: EXPECTED },
    sourceManifest: {
      ...source.source,
      normalized_file: 'data/vinuni-reviewed.json',
      profile_source: source.university.source,
      ai_training: source.ai_training,
    },
  });

  const [programmes, units, assertions, profile, otherUniversitiesAfter] = await Promise.all([
    count(supabase, 'catalog_programmes', (query) => query.eq('university_id', UNIVERSITY_ID)),
    count(supabase, 'academic_units', (query) => query.eq('university_id', UNIVERSITY_ID)),
    count(supabase, 'course_field_values', (query) => query.eq('source_run_id', result.run_id)),
    count(supabase, 'university_profiles', (query) => query.eq('university_id', UNIVERSITY_ID)),
    count(supabase, 'catalog_programmes', (query) => query.neq('university_id', UNIVERSITY_ID)),
  ]);
  if (programmes !== 12 || units !== 4 || assertions !== 60 || profile !== 1) {
    throw new Error(`Post-import verification failed: ${JSON.stringify({ programmes, units, assertions, profile })}`);
  }
  if (otherUniversitiesAfter !== otherUniversitiesBefore) {
    throw new Error(`Non-VinUni catalogue count changed (${otherUniversitiesBefore} → ${otherUniversitiesAfter}).`);
  }
  const revalidated = await revalidateUniversityCaches();
  console.log(JSON.stringify({ mode: 'applied', ...result, verified: { programmes, units, assertions, profile, other_university_programmes: otherUniversitiesAfter }, revalidated }, null, 2));
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isEntrypoint) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
