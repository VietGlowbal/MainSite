import { listArticlesForAdmin } from '@/lib/geo-cms';
import { AdminHeading } from '../_ui';
import { AdminNewsClient } from './admin-news-client';

/**
 * GEO News CMS — article list. The /admin layout already verified the caller
 * is an admin. Reads every article (all statuses) via the service-role client.
 */
export default async function AdminNewsPage() {
  const articles = await listArticlesForAdmin();

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="News & GEO articles"
        description="Create, edit, publish, and remove GLOWBAL News articles."
      />

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
