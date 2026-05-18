import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-lg">
        <div className="glow-card text-center space-y-5 py-12">
          <div className="text-5xl">🌍</div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Lost in space</h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              The page you&apos;re looking for doesn&apos;t exist. It may have been moved or never existed.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link
              href="/"
              className="glow-button-primary text-sm px-5 py-2.5"
            >
              Back home
            </Link>
            <Link
              href="/universities"
              className="glow-button-secondary text-sm px-5 py-2.5"
            >
              Browse universities
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
