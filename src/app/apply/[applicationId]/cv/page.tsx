import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { isCvBuilderEnabled } from '@/lib/ai/cv-builder-context';
import { createClient } from '@/lib/supabase/server';

export default async function CvHubPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  if (!isCvBuilderEnabled()) redirect(`/apply/${applicationId}/cv-review`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');
  const workspace = await fetchApplicationWorkspace(applicationId, user.id);
  if (!workspace) notFound();

  return (
    <main className="min-h-screen bg-[#f6f4f1] px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <Link href={`/apply/${applicationId}`} className="text-sm font-semibold text-slate-500">
          ← Quay lại hồ sơ
        </Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.24em] text-pink-600">
          CV Workspace
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
          Bạn muốn bắt đầu từ đâu?
        </h1>
        <p className="mt-5 text-slate-600">
          {workspace.application.courseName} · {workspace.application.universityName}
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Link
            href={`/apply/${applicationId}/cv-builder`}
            className="group rounded-[2rem] border border-pink-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-pink-400 hover:shadow-xl"
          >
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">01</span>
            <h2 className="mt-12 text-3xl font-semibold tracking-tight">Build from scratch</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Gom trải nghiệm, tạo Target Profile và xây CV tiếng Anh phù hợp với chương trình.
            </p>
            <span className="mt-10 inline-block font-semibold text-pink-600">Bắt đầu xây CV →</span>
          </Link>
          <Link
            href={`/apply/${applicationId}/cv-review`}
            className="group rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:border-pink-400 hover:shadow-xl"
          >
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-pink-600">02</span>
            <h2 className="mt-12 text-3xl font-semibold tracking-tight">Review existing CV</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Tải lên hoặc dán CV hiện có để nhận đánh giá theo dẫn chứng.
            </p>
            <span className="mt-10 inline-block font-semibold text-pink-600">Mở CV Review →</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
