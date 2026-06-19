import { ArticleEditor } from '../article-editor';

/**
 * Create a new GEO News article. The /admin layout already gates this to
 * admins; the editor POSTs to /api/admin/news, which re-checks server-side.
 */
export default function NewArticlePage() {
  return <ArticleEditor />;
}
