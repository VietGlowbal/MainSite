import { listArticlesForAdmin } from '@/lib/geo-cms';
import { AdminNewsClient } from './admin-news-client';

/**
 * GEO News CMS — article list. The /admin layout already verified the caller
 * is an admin. Reads every article (all statuses) via the service-role client.
 */
export default async function AdminNewsPage() {
  const articles = await listArticlesForAdmin();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            News &amp; GEO articles
          </h2>
          <p className="text-sm text-slate-500">
            Create, edit, publish, and remove GLOWBAL News articles.
          </p>
        </div>
      </div>

      <AdminNewsClient
        articles={articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          topic: a.topic,
          status: a.status,
          source: a.source,
          updated_at: a.updated_at,
          published_at: a.published_at,
        }))}
      />
    </section>
  );
}
