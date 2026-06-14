import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/scholarships/search
 *
 * Uses AI to find the best scholarships for a user's course applications.
 *
 * Body:
 * - applicationIds?: string[] (optional — search for specific apps; defaults to all active)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI service not configured' },
      { status: 500 },
    );
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const body = await request.json().catch(() => ({}));
  const { applicationIds } = body as { applicationIds?: string[] };

  // Fetch user's applications
  let query = supabase
    .from('course_applications')
    .select('id, university_name, course_name, degree_level, subject, country, intake, deadline, tuition_fee')
    .eq('user_id', user.id)
    .not('status', 'in', '("rejected","withdrawn","archived")');

  if (applicationIds && applicationIds.length > 0) {
    query = query.in('id', applicationIds);
  }

  const { data: applications, error: appsError } = await query;

  if (appsError || !applications || applications.length === 0) {
    return NextResponse.json(
      { error: 'No active applications found. Import a course first.' },
      { status: 404 },
    );
  }

  // Fetch user profile for eligibility matching
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('nationality, country_of_residence, gpa, degree_level, subject_area, financial_need, achievements')
    .eq('user_id', user.id)
    .maybeSingle();

  const systemPrompt = `You are an expert scholarship researcher. For each course application, find the BEST scholarships the student could realistically apply for.

You must respond with valid JSON only — no markdown, no code fences.

For each scholarship, provide:
- name: Official scholarship name
- provider: Who funds it (university, government, charity, etc.)
- amount: Value (e.g., "Full tuition", "£5,000/year", "50% fee waiver")
- currency: Currency code if applicable
- coverage: What it covers (tuition, living, travel, etc.)
- eligibility: Key eligibility criteria
- deadline: Application deadline if known (ISO date or descriptive)
- applicationUrl: URL to apply or find more info (if you know it)
- matchReason: Why this is a good fit for this student/course
- matchScore: How well it matches (0-100)
- difficulty: "easy" | "medium" | "hard" (how competitive)
- courseApplicationId: Which of the user's applications this scholarship relates to
- isUniversitySpecific: Whether this is from the same university
- type: "merit" | "need" | "subject" | "country" | "diversity" | "general" | "sport" | "research"

Find 3-6 scholarships per course, mixing:
- University-specific scholarships (most relevant)
- Government/external scholarships for the country of study
- Subject-specific scholarships
- Nationality-based scholarships (if student nationality is known)

Prioritise scholarships that are:
1. Still open or recurring annually
2. Realistic for the student's profile
3. Worth meaningful money
4. Not too competitive for an average strong candidate

Return JSON: { "scholarships": [...] }`;

  const coursesDescription = applications
    .map(
      (app) =>
        `- ${app.course_name} at ${app.university_name} (${app.degree_level || 'Degree'}, ${app.subject || 'unspecified subject'}, ${app.country || 'unspecified country'}, intake: ${app.intake || 'unspecified'}, tuition: ${app.tuition_fee || 'unknown'}) [appId: ${app.id}]`,
    )
    .join('\n');

  const profileDescription = profile
    ? `Student profile:
- Nationality: ${profile.nationality || 'Unknown'}
- Residing in: ${profile.country_of_residence || 'Unknown'}
- GPA: ${profile.gpa || 'Unknown'}
- Current level: ${profile.degree_level || 'Unknown'}
- Subject area: ${profile.subject_area || 'Unknown'}
- Financial need: ${profile.financial_need || 'Not specified'}
- Achievements: ${profile.achievements || 'Not specified'}`
    : 'No profile available — provide general scholarships.';

  const userPrompt = `Find the best scholarships for this student's course applications:

${coursesDescription}

${profileDescription}

Return JSON only: { "scholarships": [...] }`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error in scholarship search');
      return NextResponse.json(
        { error: 'AI search failed. Please try again.' },
        { status: 502 },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 502 },
      );
    }

    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json({
      scholarships: result.scholarships || [],
      applicationsSearched: applications.length,
      searchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Scholarship search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for scholarships' },
      { status: 500 },
    );
  }
}
