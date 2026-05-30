import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMatchResult } from '@/lib/matching';
import type { University } from '@/lib/types';
import { VINUNI_UNIVERSITY_ID } from '@/lib/vinuni-content';
import { VinUniProfileClient } from './vinuni-profile-client';

export const metadata: Metadata = {
  title: 'VinUniversity — Ivy-standard education in Vietnam | Glowbal',
  description:
    'VinUni full profile on Glowbal — academics, scholarships, admissions, career outcomes and campus life. Co-developed with Cornell and the University of Pennsylvania.',
};

// Re-render at most every 12 hours; matches the universities explorer ISR
// cadence in src/app/universities/page.tsx.
export const revalidate = 43200;

export default async function VinUniPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [{ data: { user } }, { data: university }] = await Promise.all([
    supabase.auth.getUser(),
    adminSupabase
      .from('universities')
      .select('*')
      .eq('id', VINUNI_UNIVERSITY_ID)
      .maybeSingle(),
  ]);

  if (!university) notFound();

  let matchPercentage: number | null = null;
  let isSaved = false;

  if (user) {
    const [profileResult, savedResult] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('user_universities')
        .select('id')
        .eq('user_id', user.id)
        .eq('university_id', VINUNI_UNIVERSITY_ID)
        .maybeSingle(),
    ]);

    if (profileResult.data) {
      const match = computeMatchResult(profileResult.data, university as University);
      matchPercentage = match.percentage;
    }
    isSaved = !!savedResult.data;
  }

  return (
    <VinUniProfileClient
      university={university as University}
      matchPercentage={matchPercentage}
      isLoggedIn={!!user}
      initiallySaved={isSaved}
    />
  );
}
