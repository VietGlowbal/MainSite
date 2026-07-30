import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
}

const COUNTRY_CODES = {
  Australia: 'AU',
  Canada: 'CA',
  China: 'CN',
  'Czech Republic': 'CZ',
  France: 'FR',
  Germany: 'DE',
  'Hong Kong': 'HK',
  Hungary: 'HU',
  Ireland: 'IE',
  Italy: 'IT',
  Japan: 'JP',
  Netherlands: 'NL',
  'New Zealand': 'NZ',
  Singapore: 'SG',
  'South Korea': 'KR',
  'United Kingdom': 'GB',
  'United States': 'US',
  Vietnam: 'VN',
};

const faviconDomain = (logoUrl) => {
  try {
    return new URL(logoUrl).searchParams.get('domain')?.toLowerCase() ?? null;
  } catch {
    return null;
  }
};

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: universities, error } = await supabase
  .from('universities')
  .select('*')
  .order('id');

if (error) throw new Error(error.message);

const now = new Date().toISOString();
const changes = universities.flatMap((university) => {
  const patch = {};
  const domain = university.primary_domain ?? faviconDomain(university.logo_url);

  if (!university.country_code && COUNTRY_CODES[university.country]) {
    patch.country_code = COUNTRY_CODES[university.country];
  }
  if (!university.primary_domain && domain) {
    patch.primary_domain = domain;
    patch.domain_discovered_at = university.images_resolved_at ?? now;
  }
  const officialUrl = university.official_url ?? (domain ? `https://${domain}/` : null);
  if (!university.official_url && officialUrl) patch.official_url = officialUrl;
  if (!university.logo_url && domain) {
    patch.logo_url = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
  }
  if ((!university.official_web_pages || university.official_web_pages.length === 0) && officialUrl) {
    patch.official_web_pages = [officialUrl];
  }

  return Object.keys(patch).length ? [{ id: university.id, patch }] : [];
});

const fieldCounts = {};
for (const { patch } of changes) {
  for (const field of Object.keys(patch)) fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
}

console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry-run',
  universityRows: universities.length,
  rowsToUpdate: changes.length,
  fieldCounts,
}, null, 2));

if (!APPLY) {
  console.log('Dry-run only. Re-run with --apply to write rows.');
  process.exit(0);
}

for (const { id, patch } of changes) {
  const { error: updateError } = await supabase
    .from('universities')
    .update(patch)
    .eq('id', id);
  if (updateError) throw new Error(`University ${id}: ${updateError.message}`);
}

console.log(`Updated ${changes.length} universities.`);
