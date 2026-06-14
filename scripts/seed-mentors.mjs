// ============================================================================
// scripts/seed-mentors.mjs
// ----------------------------------------------------------------------------
// Seed Glowbal with a handful of realistic, approved mentor profiles so the
// /mentors browse page has something to show and bookings can be tested
// end to end.
//
// Usage:
//   1. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY set (the service role key is required to
//      create auth users and bypass RLS).
//   2. Run:   node --env-file=.env.local scripts/seed-mentors.mjs
//      Or:    npm run seed:mentors
//
// What it does:
//   - Looks up a few well-known universities by name; falls back to whatever
//     the database has if names don't match.
//   - For each fake mentor it creates a confirmed Supabase auth user, then
//     upserts an `achiever_profiles` row with status='approved' and a
//     handful of `mentor_availability_slots` for the next two weeks.
//   - Idempotent: re-running won't duplicate users or slots.
//
// Cleanup:
//   To remove the fake mentors later:
//     node --env-file=.env.local scripts/seed-mentors.mjs --cleanup
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Run with: node --env-file=.env.local scripts/seed-mentors.mjs',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// All seeded users share this email suffix so we can find/cleanup later.
const SEED_EMAIL_SUFFIX = '@glowbal-seed.test';
const SEED_PASSWORD = 'Glowbal!Seed-2026';

// ----------------------------------------------------------------------------
// Mentor catalog. Twelve people, mixed countries / subjects / currencies so
// the browse page filters all show something interesting.
// ----------------------------------------------------------------------------

const MENTORS = [
  {
    handle: 'linh-nguyen',
    display_name: 'Linh N.',
    legal_name: 'Linh Thi Hoang Nguyen',
    university_search: ['University of Cambridge', 'Cambridge'],
    fallback_country: 'United Kingdom',
    degree_level: 'undergraduate',
    subject: 'Computer Science, BA',
    study_start_year: 2022,
    graduation_year: 2025,
    currently_enrolled: true,
    bio: 'Cambridge CS undergrad. I help applicants demystify the SAQ, technical interviews, and the personal statement. Happy to chat in English or Vietnamese.',
    help_topics: ['Personal statement', 'Interview prep', 'Course choice', 'SAQ'],
    strengths: ['STEM Olympiad veteran', 'Strong writer', 'Mock interviews'],
    languages: ['English', 'Vietnamese'],
    hourly_rate_amount: 4500, // $45.00
    hourly_rate_currency: 'USD',
    avg_rating: 4.9,
    total_sessions: 21,
  },
  {
    handle: 'arjun-patel',
    display_name: 'Arjun P.',
    legal_name: 'Arjun Patel',
    university_search: ['University of Oxford', 'Oxford'],
    fallback_country: 'United Kingdom',
    degree_level: 'masters',
    subject: 'MSc Computer Science',
    study_start_year: 2023,
    graduation_year: 2024,
    currently_enrolled: false,
    bio: "Oxford MSc CS, now working in fintech. I review SOPs line-by-line and run mock technical interviews. I'll also tell you honestly when a school isn't worth it.",
    help_topics: ['SOP review', 'Interview prep', 'Career planning', 'Internships'],
    strengths: ['Tech-savvy', 'Mock interviews', 'Startup experience'],
    languages: ['English', 'Hindi'],
    hourly_rate_amount: 6500,
    hourly_rate_currency: 'GBP',
    avg_rating: 4.8,
    total_sessions: 34,
  },
  {
    handle: 'mai-tran',
    display_name: 'Mai T.',
    legal_name: 'Mai Anh Tran',
    university_search: ['Harvard University', 'Harvard'],
    fallback_country: 'United States',
    degree_level: 'undergraduate',
    subject: 'Economics, AB',
    study_start_year: 2021,
    graduation_year: 2025,
    currently_enrolled: true,
    bio: 'Harvard \u201925, majoring in Economics with a minor in Statistics. I love helping students with the Common App essays — yes, all 650 words of them.',
    help_topics: ['Personal statement', 'Common App', 'Scholarships', 'Life on campus'],
    strengths: ['Empathetic listener', 'Strong writer'],
    languages: ['English', 'Vietnamese', 'Mandarin'],
    hourly_rate_amount: 7500,
    hourly_rate_currency: 'USD',
    avg_rating: 5.0,
    total_sessions: 12,
  },
  {
    handle: 'kenji-suzuki',
    display_name: 'Kenji S.',
    legal_name: 'Kenji Suzuki',
    university_search: ['Imperial College London', 'Imperial'],
    fallback_country: 'United Kingdom',
    degree_level: 'phd',
    subject: 'PhD Aeronautical Engineering',
    study_start_year: 2020,
    graduation_year: 2025,
    currently_enrolled: true,
    bio: 'PhD candidate at Imperial. I help applicants for engineering and physics programmes navigate research statements and interview panels.',
    help_topics: ['Research applications', 'Interview prep', 'Course choice'],
    strengths: ['Public speaking', 'STEM Olympiad veteran'],
    languages: ['English', 'Japanese'],
    hourly_rate_amount: 5500,
    hourly_rate_currency: 'GBP',
    avg_rating: 4.7,
    total_sessions: 8,
  },
  {
    handle: 'sophia-lee',
    display_name: 'Sophia L.',
    legal_name: 'Sophia Lee',
    university_search: ['Stanford University', 'Stanford'],
    fallback_country: 'United States',
    degree_level: 'masters',
    subject: 'MS Symbolic Systems',
    study_start_year: 2022,
    graduation_year: 2024,
    currently_enrolled: false,
    bio: 'Stanford alum now at a YC-backed AI startup. I focus on Stanford-specific essays, internship prep, and breaking into Bay Area tech.',
    help_topics: ['Personal statement', 'Internships', 'Career planning', 'Interview prep'],
    strengths: ['Startup experience', 'Tech-savvy', 'Mock interviews'],
    languages: ['English', 'Korean'],
    hourly_rate_amount: 9000,
    hourly_rate_currency: 'USD',
    avg_rating: 4.9,
    total_sessions: 27,
  },
  {
    handle: 'duc-pham',
    display_name: 'Duc P.',
    legal_name: 'Duc Hoang Pham',
    university_search: ['Vietnam National University, Hanoi', 'Hanoi'],
    fallback_country: 'Vietnam',
    degree_level: 'undergraduate',
    subject: 'Business Administration',
    study_start_year: 2022,
    graduation_year: 2026,
    currently_enrolled: true,
    bio: 'VNU Hanoi business student. I work mostly with applicants targeting top Vietnamese universities and exchange programmes — affordable rates in VND.',
    help_topics: ['Course choice', 'Visa & relocation', 'Scholarships'],
    strengths: ['Multilingual', 'Empathetic listener'],
    languages: ['Vietnamese', 'English'],
    hourly_rate_amount: 250000, // 250,000 ₫
    hourly_rate_currency: 'VND',
    avg_rating: 4.6,
    total_sessions: 15,
  },
  {
    handle: 'isabel-garcia',
    display_name: 'Isabel G.',
    legal_name: 'Isabel Garcia',
    university_search: ['University College London', 'UCL'],
    fallback_country: 'United Kingdom',
    degree_level: 'undergraduate',
    subject: 'BA Architecture',
    study_start_year: 2021,
    graduation_year: 2024,
    currently_enrolled: false,
    bio: 'UCL Architecture grad. Portfolio reviews, design-school interviews, and how to actually survive crit week as a first-year.',
    help_topics: ['Portfolio review', 'Interview prep', 'Course choice', 'Life on campus'],
    strengths: ['Strong writer', 'Public speaking'],
    languages: ['English', 'Spanish'],
    hourly_rate_amount: 4000,
    hourly_rate_currency: 'GBP',
    avg_rating: 4.8,
    total_sessions: 19,
  },
  {
    handle: 'omar-haddad',
    display_name: 'Omar H.',
    legal_name: 'Omar Haddad',
    university_search: ['Massachusetts Institute of Technology', 'MIT'],
    fallback_country: 'United States',
    degree_level: 'phd',
    subject: 'PhD Electrical Engineering',
    study_start_year: 2019,
    graduation_year: 2025,
    currently_enrolled: true,
    bio: 'MIT EECS PhD. I help applicants for top US engineering programmes nail their statement of purpose and prepare for grilling interviews.',
    help_topics: ['Research applications', 'SOP review', 'Interview prep'],
    strengths: ['STEM Olympiad veteran', 'Mock interviews'],
    languages: ['English', 'Arabic', 'French'],
    hourly_rate_amount: 12000,
    hourly_rate_currency: 'USD',
    avg_rating: 5.0,
    total_sessions: 41,
  },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function emailFor(handle) {
  return `${handle}${SEED_EMAIL_SUFFIX}`;
}

async function findUserByEmail(email) {
  // The admin API supports filtering by email via listUsers with a search.
  // We page through up to a few hundred entries — plenty for a seed script.
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 10) return null; // safety
  }
}

async function ensureAuthUser(mentor) {
  const email = emailFor(mentor.handle);
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: mentor.display_name, seed: true },
  });
  if (error) throw new Error(`Could not create auth user for ${email}: ${error.message}`);
  return data.user;
}

async function pickUniversityId(searchTerms) {
  for (const term of searchTerms) {
    const { data } = await supabase
      .from('universities')
      .select('id, name, country')
      .ilike('name', `%${term}%`)
      .limit(1);
    if (data && data.length > 0) return { id: data[0].id, country: data[0].country };
  }
  // Fallback: just grab any university so the FK isn't null.
  const { data } = await supabase
    .from('universities')
    .select('id, country')
    .limit(1);
  if (data && data.length > 0) return { id: data[0].id, country: data[0].country };
  return null;
}

function generateAvatar(handle) {
  // DiceBear avataaars — deterministic per handle, no auth required.
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(handle)}`;
}

function nextSlots(count = 6) {
  const slots = [];
  const now = new Date();
  // Snap to top of next hour.
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  for (let i = 0; i < count; i++) {
    const start = new Date(now);
    // Spread slots across the next 14 days at varied times so the calendar
    // grid actually has things on different days.
    start.setDate(start.getDate() + i * 2 + 1);
    start.setHours(10 + ((i * 3) % 8));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    slots.push({ starts_at: start.toISOString(), ends_at: end.toISOString() });
  }
  return slots;
}

async function upsertMentor(mentor) {
  const email = emailFor(mentor.handle);
  const authUser = await ensureAuthUser(mentor);
  const uni = await pickUniversityId(mentor.university_search);

  const { error: profileErr } = await supabase
    .from('achiever_profiles')
    .upsert(
      {
        id: authUser.id,
        display_name: mentor.display_name,
        legal_name: mentor.legal_name,
        date_of_birth: '1999-06-15',
        avatar_url: generateAvatar(mentor.handle),
        university_id: uni?.id ?? null,
        degree_level: mentor.degree_level,
        subject: mentor.subject,
        graduation_year: mentor.graduation_year,
        study_start_year: mentor.study_start_year,
        currently_enrolled: mentor.currently_enrolled,
        bio: mentor.bio,
        help_topics: mentor.help_topics,
        strengths: mentor.strengths,
        languages: mentor.languages,
        hourly_rate_amount: mentor.hourly_rate_amount,
        hourly_rate_currency: mentor.hourly_rate_currency,
        // Legacy column — kept satisfied for the existing >=100000 check.
        session_price_vnd:
          mentor.hourly_rate_currency === 'VND'
            ? Math.max(mentor.hourly_rate_amount, 100000)
            : 100000,
        session_duration_mins: 60,
        avg_rating: mentor.avg_rating,
        total_sessions: mentor.total_sessions,
        status: 'approved',
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (profileErr) throw new Error(`Profile upsert failed for ${email}: ${profileErr.message}`);

  // Seed a handful of open availability slots.
  const slots = nextSlots(6).map((s) => ({
    mentor_id: authUser.id,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    status: 'open',
  }));
  // The unique index on (mentor_id, starts_at) makes this safely re-runnable
  // when used with onConflict.
  const { error: slotErr } = await supabase
    .from('mentor_availability_slots')
    .upsert(slots, { onConflict: 'mentor_id,starts_at', ignoreDuplicates: true });
  if (slotErr) {
    console.warn(`  ⚠ Could not seed slots for ${email}: ${slotErr.message}`);
  }

  return { email, id: authUser.id };
}

async function cleanup() {
  console.log('Cleaning up seeded mentors…');
  for (const mentor of MENTORS) {
    const email = emailFor(mentor.handle);
    const user = await findUserByEmail(email);
    if (!user) continue;
    // Delete the auth user — cascades to achiever_profiles and slots via FK.
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.warn(`  ⚠ Could not delete ${email}: ${error.message}`);
    else console.log(`  ✓ Removed ${email}`);
  }
  console.log('Done.');
}

async function seed() {
  console.log(`Seeding ${MENTORS.length} mentors…`);
  let okCount = 0;
  for (const mentor of MENTORS) {
    try {
      const { email, id } = await upsertMentor(mentor);
      console.log(`  ✓ ${mentor.display_name.padEnd(14)} ${email}  (${id})`);
      okCount += 1;
    } catch (err) {
      console.error(`  ✖ ${mentor.display_name}: ${err.message}`);
    }
  }
  console.log(`\nDone. ${okCount}/${MENTORS.length} mentors ready on /mentors.`);
  console.log(`Sign-in password for any seeded mentor: ${SEED_PASSWORD}`);
}

const args = process.argv.slice(2);
if (args.includes('--cleanup') || args.includes('-c')) {
  cleanup().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
