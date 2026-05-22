import Link from 'next/link';

export const metadata = {
  title: 'GLOWBAL News',
  description: 'University admissions news, success stories, and platform updates.',
};

/**
 * GLOWBAL News — placeholder index.
 * Real CMS-backed implementation will replace this. For now we ship a
 * branded "coming soon" so the nav link has a destination.
 */
export default function NewsPage() {
  return (
    <main className="app-page-shell">
      <div className="app-page-container">
        <section className="glow-card text-center">
          <span className="glow-pill">Coming soon</span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            <span className="glowbal-wordmark">GLOWBAL News</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 leading-7">
            University admissions intel, student stories, and product updates — all in one place.
            We&apos;re writing the first batch of pieces now.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/universities" className="glow-button-primary">Explore universities</Link>
            <Link href="/mentors" className="glow-button-secondary">Find a mentor</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
