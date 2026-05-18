import { notFound } from 'next/navigation';
import { getAchieverById, getAvailableSlots, getAchieverReviews, getAchieversByUniversity } from '@/lib/achievers';
import { AchieverProfileClient } from '@/components/achievers/AchieverProfile';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AchieverProfilePage({ params }: Props) {
  const { id } = await params;
  const achiever = await getAchieverById(id);

  if (!achiever || (achiever.status !== 'approved' && achiever.id !== id)) {
    notFound();
  }

  const [availability, { reviews, count: reviewCount }, relatedAchievers] = await Promise.all([
    getAvailableSlots(id),
    getAchieverReviews(id),
    achiever.university_id
      ? getAchieversByUniversity(achiever.university_id, 3).then((list) =>
          list.filter((a) => a.id !== id),
        )
      : Promise.resolve([]),
  ]);

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl">
        <AchieverProfileClient
          achiever={achiever}
          availability={availability}
          reviews={reviews}
          reviewCount={reviewCount}
          relatedAchievers={relatedAchievers}
        />
      </div>
    </main>
  );
}
