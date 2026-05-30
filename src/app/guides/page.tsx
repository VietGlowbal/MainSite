import Link from 'next/link';
import { listGeoGuides } from '@/lib/geo-content';

export const metadata = {
  title: 'Glowbal Guides',
  description: 'Automated Glowbal study-abroad guides and comparison pages.',
};

export default function GuidesIndexPage() {
  const guides = listGeoGuides();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-600">Glowbal guides</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Study-abroad guides now live for testing</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          These pages are being generated automatically to test SEO and GEO effects. Some pages may still be drafts and should be treated as experimental.
        </p>
      </div>

      <div className="space-y-4">
        {guides.map((guide) => (
          <article key={guide.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${guide.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {guide.status}
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">
              <Link href={`/guides/${guide.slug}`} className="hover:text-cyan-700">
                {guide.title}
              </Link>
            </h2>
            {guide.description ? <p className="mt-2 text-slate-600">{guide.description}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}
