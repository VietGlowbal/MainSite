import { notFound, redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth-helpers';
import { getArticleById } from '@/lib/geo-cms';
import { createClient } from '@/lib/supabase/server';
import { NewsPreviewClient } from './preview-client';

export const dynamic = 'force-dynamic';

export default async function AdminNewsPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/admin/news');
  if (!(await isAdmin(user.id))) redirect('/apply');

  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();
  return <NewsPreviewClient article={article} />;
}
