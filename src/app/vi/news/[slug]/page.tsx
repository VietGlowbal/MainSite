import type { Metadata } from 'next';
import GuideDetailPage from '../../../news/[slug]/page';
import { getGeoGuide, listGeoGuides } from '@/lib/geo-content';
import { SITE_URL } from '@/lib/site-url';
import { buildViLocaleAlternates } from '@/lib/seo/alternates';

export async function generateStaticParams() {
  const guides = await listGeoGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGeoGuide(slug);
  if (!guide) return { title: 'Không tìm thấy bài viết | GlowBal' };
  const md = guide.metadata as { title?: string; metaDescription?: string; heroImage?: string } | undefined;
  const title = md?.title || guide.title;
  const description = md?.metaDescription || guide.description;
  const heroImg = md?.heroImage || (guide.heroImage ? (guide.heroImage.startsWith('http') ? guide.heroImage : `${SITE_URL}${guide.heroImage}`) : undefined);

  return {
    title: `${title} | GlowBal`,
    description,
    alternates: buildViLocaleAlternates(`/news/${slug}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/vi/news/${slug}`,
      type: 'article',
      locale: 'vi_VN',
      alternateLocale: ['en_US'],
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt || guide.publishedAt,
      images: heroImg ? [{ url: heroImg, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: heroImg ? [heroImg] : undefined,
    },
  };
}

export default async function VietnameseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return <GuideDetailPage params={params} locale="vi" />;
}
