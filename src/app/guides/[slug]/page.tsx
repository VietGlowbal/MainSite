import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getGeoGuide, listGeoGuides } from '@/lib/geo-content';

export async function generateStaticParams() {
  return listGeoGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGeoGuide(slug);
  if (!guide) return {};
  const md = guide.metadata as { title?: string; metaDescription?: string } | undefined;
  return {
    title: md?.title || guide.title,
    description: md?.metaDescription || guide.description,
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGeoGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${guide.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {guide.status === 'draft' ? 'draft live test page' : 'published'}
        </span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">{guide.title}</h1>
        {guide.description ? <p className="mt-4 text-lg text-slate-600">{guide.description}</p> : null}
      </div>

      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-a:text-cyan-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{guide.content}</ReactMarkdown>
      </article>
    </div>
  );
}
