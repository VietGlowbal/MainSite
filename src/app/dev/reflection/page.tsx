import { notFound } from 'next/navigation';
import { ReflectionPreview } from './reflection-preview';

/**
 * /dev/reflection?step=about | evidence — defaults to about.
 *
 * The gate stays in this server component: a `'use client'` route reads
 * ENABLE_DEV_ROUTES from the browser bundle, where a non-`NEXT_PUBLIC_`
 * variable is undefined and the page 404s regardless of the flag.
 */
export default async function DevReflectionPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  const { step } = await searchParams;

  return (
    <main className="min-h-screen bg-surface">
      <ReflectionPreview step={step === 'evidence' ? 'evidence' : 'about'} />
    </main>
  );
}
