import { notFound } from 'next/navigation';
import { getArticleById } from '@/lib/geo-cms';
import { ArticleEditor } from '../../article-editor';

/**
 * Edit an existing GEO News article. The /admin layout gates this to admins;
 * the editor PATCHes /api/admin/news/[id], which re-checks server-side.
 */
export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  return <ArticleEditor article={article} />;
}
