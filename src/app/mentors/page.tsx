import { getApprovedMentors } from '@/lib/mentors';
import { createClient } from '@/lib/supabase/server';
import { MentorBrowse } from '@/components/mentorship/MentorBrowse';
import { JourneySteps } from '@/components/JourneySteps';

type Props = {
  searchParams: Promise<{ university?: string; country?: string; date?: string }>;
};

/**
 * /mentors — the new mentorship hub home. The legacy /achievers route still
 * works (see redirect in src/app/achievers/page.tsx) so existing links and
 * deep-shared URLs continue to land users in the right place.
 */
export default async function MentorsBrowsePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialUniversityId = params.university ? Number(params.university) : undefined;

  const mentors = await getApprovedMentors({
    university_id: initialUniversityId,
    country: params.country,
    available_from: params.date,
  });

  // For the "available_from" client-side filter to be live without round-trips
  // we ship a small index of open-slot dates per mentor. Limited to 90 days
  // ahead — anything further can use the date filter to refresh the page.
  const supabase = await createClient();
  // eslint-disable-next-line react-hooks/purity -- server route handler; freshness is intentional.
  const nowMs = Date.now();
  const { data: openSlots } = await supabase
    .from('mentor_availability_slots')
    .select('mentor_id, starts_at')
    .eq('status', 'open')
    .gte('starts_at', new Date(nowMs).toISOString())
    .lte('starts_at', new Date(nowMs + 90 * 24 * 60 * 60 * 1000).toISOString());

  const slotsByMentor: Record<string, string[]> = {};
  for (const row of openSlots ?? []) {
    const day = new Date(row.starts_at as string).toISOString().slice(0, 10);
    const arr = slotsByMentor[row.mentor_id as string] ?? [];
    if (!arr.includes(day)) arr.push(day);
    slotsByMentor[row.mentor_id as string] = arr;
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8 md:py-16">
      <div className="w-full">
        <JourneySteps activeStep={5} />
        <MentorBrowse
          mentors={mentors}
          initialUniversityId={initialUniversityId}
          initialSlotsByMentor={slotsByMentor}
        />
      </div>
    </main>
  );
}
