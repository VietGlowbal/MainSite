import { notFound } from 'next/navigation';
import { getArticleById, listArticlesForAdmin } from '@/lib/geo-cms';
import { ArticleEditor } from '../../article-editor';

/**
 * Edit an existing GEO News article. The /admin layout gates this to admins;
 * the editor PATCHes /api/admin/news/[id], which re-checks server-side.
 */
export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  // Other articles available as link targets in the GEO graph editor.
  const all = await listArticlesForAdmin();
  const candidates = all
    .filter((a) => a.id !== id)
    .map((a) => ({ id: a.id, title: a.title, slug: a.slug }));

  return <ArticleEditor article={article} candidates={candidates} />;
}
