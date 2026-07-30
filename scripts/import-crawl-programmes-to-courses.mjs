import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function readAll(table, select = '*') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const normalize = (value) => value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const normalizeUrl = (value) => {
  const parsed = new URL(value);
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString().toLocaleLowerCase('en-US');
};
const unique = (values) => [...new Set(values.filter(Boolean))];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [programmes, offerings, institutions, universities, existingCourses] =
  await Promise.all([
    readAll('crawl_programmes'),
    readAll('crawl_programme_offerings'),
    readAll('crawl_institutions'),
    readAll('universities', 'id,name,country'),
    readAll('courses', 'id,university_id,course_name,course_url'),
  ]);

assert(programmes.length === 400, `Expected 400 crawl programmes, found ${programmes.length}.`);
assert(
  new Set(programmes.map(({ programme_id }) => programme_id)).size === programmes.length,
  'crawl_programmes contains duplicate programme_id values.',
);
assert(
  new Set(programmes.map(({ official_url }) => normalizeUrl(official_url))).size === programmes.length,
  'crawl_programmes contains duplicate official_url values.',
);

const runIds = unique(programmes.map(({ run_id }) => run_id));
assert(runIds.length === 1, `Expected one crawl run, found ${runIds.length}.`);
const runId = runIds[0];
const runInstitutions = institutions.filter(({ run_id }) => run_id === runId);
const runOfferings = offerings.filter(({ run_id }) => run_id === runId);
const institutionById = new Map(
  runInstitutions.map((institution) => [institution.institution_id, institution]),
);
const universityById = new Map(universities.map((university) => [university.id, university]));
const offeringsByProgramme = Map.groupBy(
  runOfferings,
  ({ programme_id }) => programme_id,
);

for (const programme of programmes) {
  assert(programme.programme_name?.trim(), `Missing programme_name: ${programme.programme_id}`);
  assert(programme.official_url?.trim(), `Missing official_url: ${programme.programme_id}`);
  assert(programme.degree_level?.trim(), `Missing degree_level: ${programme.programme_id}`);

  const institution = institutionById.get(programme.institution_id);
  assert(institution, `Missing institution: ${programme.institution_id}`);
  assert(
    universityById.has(institution.university_id),
    `Missing university: ${institution.university_id}`,
  );

  const hostname = new URL(programme.official_url).hostname.toLocaleLowerCase('en-US');
  const domain = institution.official_domain.toLocaleLowerCase('en-US');
  assert(
    hostname === domain || hostname.endsWith(`.${domain}`),
    `Official domain mismatch: ${programme.programme_id}`,
  );
}

const existingUrls = new Set(existingCourses.map(({ course_url }) => normalizeUrl(course_url)));
const existingNames = new Set(
  existingCourses.map(({ university_id, course_name }) => `${university_id}:${normalize(course_name)}`),
);

const rows = programmes.flatMap((programme) => {
  const institution = institutionById.get(programme.institution_id);
  const university = universityById.get(institution.university_id);
  const nameKey = `${university.id}:${normalize(programme.programme_name)}`;
  if (existingUrls.has(normalizeUrl(programme.official_url)) || existingNames.has(nameKey)) {
    return [];
  }

  const programmeOfferings = offeringsByProgramme.get(programme.programme_id) ?? [];
  const intakes = unique(programmeOfferings.map(({ intake }) => intake));
  const deliveryModes = unique(programmeOfferings.map(({ delivery_mode }) => delivery_mode));
  const isComplete = programme.verification_status === 'RULE_VALIDATED';

  return [{
    id: programme.programme_id,
    university_id: university.id,
    university_name: university.name,
    course_name: programme.programme_name.trim(),
    course_url: programme.official_url.trim(),
    degree_level: programme.degree_level,
    subject: programme.normalized_field,
    study_mode: programme.delivery_mode ?? deliveryModes[0] ?? null,
    duration: programme.duration,
    intake: intakes.length ? intakes.join(', ') : null,
    country: university.country,
    source_confidence: isComplete ? 0.9 : 0.65,
    extraction_status: isComplete ? 'extracted' : 'needs_review',
    last_extracted_at: programme.retrieved_at,
    search_keywords: unique([
      normalize(programme.programme_name),
      normalize(programme.degree_level),
      programme.normalized_field && normalize(programme.normalized_field),
      normalize(university.name),
    ]),
    source_domain: new URL(programme.official_url).hostname,
    university_metadata: {
      source: 'crawl_programmes',
      crawl_run_id: programme.run_id,
      crawl_programme_id: programme.programme_id,
      crawl_institution_id: programme.institution_id,
      verification_status: programme.verification_status,
    },
  }];
});

const extractedCount = rows.filter(({ extraction_status }) => extraction_status === 'extracted').length;
const reviewCount = rows.filter(({ extraction_status }) => extraction_status === 'needs_review').length;
console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry-run',
  crawlRunId: runId,
  sourceRows: programmes.length,
  existingRows: existingCourses.length,
  skippedDuplicates: programmes.length - rows.length,
  rowsToWrite: rows.length,
  extracted: extractedCount,
  needsReview: reviewCount,
}, null, 2));

if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to write rows.');
  process.exit(0);
}

for (let from = 0; from < rows.length; from += 100) {
  const { error } = await supabase
    .from('courses')
    .upsert(rows.slice(from, from + 100), { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`courses batch ${from / 100 + 1}: ${error.message}`);
}

console.log(`Imported ${rows.length} courses.`);
