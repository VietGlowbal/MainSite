import type { Metadata } from 'next';
import { ManualStatusPanel } from './manual-status-panel';

export const metadata: Metadata = {
  title: 'Bank transfer payment | GlowBal',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ManualPaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const reference = (await searchParams).reference ?? '';
  return (
    <main className="gb-page-full-bleed flex min-h-screen items-center justify-center bg-surface-muted px-gb-md py-gb-5xl sm:px-gb-xl sm:py-gb-9xl">
      <ManualStatusPanel reference={reference} />
    </main>
  );
}
