import Link from 'next/link';

export function ProfileSectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to profile
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        {children}
      </div>
    </main>
  );
}
