import Link from 'next/link';
import { getApprovedAchievers } from '@/lib/achievers';
import { AchieverBrowseClient } from '@/components/achievers/AchieverBrowseClient';

type Props = {
  searchParams: Promise<{ university?: string }>;
};

export default async function AchieversPage({ searchParams }: Props) {
  const params = await searchParams;
  const universityId = params.university ? Number(params.university) : undefined;
  const achievers = await getApprovedAchievers();

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="glow-pill">Global Station</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Find an Achiever
            </h1>
            <p className="mt-2 text-slate-500 leading-7 max-w-lg">
              Book 1-on-1 sessions with students and alumni who have been accepted to your target universities.
            </p>
          </div>
          <Link
            href="/achievers/apply"
            className="glow-button-secondary text-sm px-5 py-2.5 shrink-0"
          >
            Become an Achiever
          </Link>
        </div>

        {/* Browse grid with filters */}
        <AchieverBrowseClient
          achievers={achievers}
          initialUniversityId={universityId}
        />
      </div>
    </main>
  );
}
