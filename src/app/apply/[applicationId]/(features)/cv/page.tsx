import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CvStartFlow } from '@/components/cv/CvStartFlow';
import { isCvBuilderEnabled } from '@/lib/ai/cv-builder-context';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { getServerIdentity } from '@/server/auth/server-identity';

export const metadata: Metadata = {
  title: 'Build your CV | GlowBal',
  description: 'Choose a format and how to start building your CV.',
};

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" className={className}>
      <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" />
      <path d="m19 15 .55 2.45L22 18l-2.45.55L19 21l-.55-2.45L16 18l2.45-.55L19 15Z" />
    </svg>
  );
}

function FloatingAiLink({ applicationId }: { applicationId: string }) {
  return (
    <Link href={`/ai-strategy/${applicationId}`} aria-label="Open Glowbal AI" title="Glowbal AI" className="fixed bottom-6 right-6 z-30 grid size-16 place-items-center rounded-full bg-brand text-on-brand shadow-[0_14px_30px_rgba(225,29,72,0.3)] transition hover:-translate-y-1 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
      <SparkleIcon className="size-7" />
    </Link>
  );
}

export default async function CvHubPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  if (!isCvBuilderEnabled()) redirect(`/ai-strategy/${applicationId}/cv/review`);

  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');
  const context = await getApplicationDocumentContext(applicationId, user.id);
  if (!context) notFound();

  return (
    <main className="min-h-screen bg-surface-muted px-4 pb-24 pt-12 text-fg sm:px-6 lg:px-8 lg:pt-14">
      <div className="mx-auto max-w-[1216px]"><CvStartFlow applicationId={applicationId} /></div>
      <FloatingAiLink applicationId={applicationId} />
    </main>
  );
}
