import { notFound } from 'next/navigation';
import {
  getMentorById,
  getMentorOpenSlots,
  getMentorReviews,
  getMentorsByUniversity,
} from '@/lib/mentors';
import { createClient } from '@/lib/supabase/server';
import { MentorProfile } from '@/components/mentorship/MentorProfile';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MentorProfilePage({ params }: Props) {
  const { id } = await params;

  const mentor = await getMentorById(id);
  if (!mentor || mentor.status !== 'approved') {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [slots, { reviews, count }, related] = await Promise.all([
    getMentorOpenSlots(id),
    getMentorReviews(id),
    mentor.university_id
      ? getMentorsByUniversity(mentor.university_id, 4).then((list) =>
          list.filter((m) => m.id !== id).slice(0, 3),
        )
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        <MentorProfile
          mentor={mentor}
          slots={slots}
          reviews={reviews}
          reviewCount={count}
          related={related}
          isSignedIn={!!user}
        />
      </div>
    </main>
  );
}
