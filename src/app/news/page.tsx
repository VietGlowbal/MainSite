import Link from 'next/link';
import { listGeoGuides } from '@/lib/geo-content';

export const metadata = {
  title: 'GLOWBAL News',
  description: 'University admissions intel, generated study-abroad stories, and platform updates.',
};

export default function NewsPage() {
  const guides = listGeoGuides();

  return (
    <main className="app-page-shell">
      <div className="app-page-container space-y-8">
        <section className="glow-card text-center">
          <span className="glow-pill">Live testing feed</span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            <span className="glowbal-wordmark">GLOWBAL News</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
            Generated study-abroad stories and guide pages created by Glowbal&apos;s GEO pipeline.
            This feed updates as new pages are generated and uploaded.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/guides" className="glow-button-primary">Browse all guides</Link>
            <Link href="/universities" className="glow-button-secondary">Explore universities</Link>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-600">Generated pages</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">{guides.length} stories currently live for testing</h2>
            </div>
          </div>

          {guides.length === 0 ? (
            <div className="glow-card text-slate-600">
              No generated stories are live yet. The daily GEO automation will add them here.
            </div>
          ) : (
            <div className="grid gap-4">
              {guides.map((guide) => (
                <article key={guide.slug} className="glow-card border border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        guide.status === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {guide.status === 'published' ? 'published' : 'draft live'}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">/guides/{guide.slug}</span>
                  </div>

                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
                    <Link href={`/guides/${guide.slug}`} className="hover:text-cyan-700">
                      {guide.title}
                    </Link>
                  </h3>

                  {guide.description ? (
                    <p className="mt-3 max-w-3xl leading-7 text-slate-600">{guide.description}</p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/guides/${guide.slug}`} className="glow-button-primary">
                      Read story
                    </Link>
                    <Link href="/guides" className="glow-button-secondary">
                      View all guides
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
