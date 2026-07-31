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
    <main className="min-h-screen bg-white px-5 py-12 text-slate-950 sm:py-20">
      <div className="mx-auto max-w-[1216px]">
        <Link
          href={`/apply/${applicationId}`}
          className="text-sm font-semibold text-slate-500 transition hover:text-rose-600"
        >
          ← Quay lại hồ sơ
        </Link>
        <p className="mt-12 text-xs font-bold uppercase tracking-[0.24em] text-rose-600">
          CV Workspace
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          Bạn muốn bắt đầu từ đâu?
        </h1>
        <p className="mt-4 text-base text-slate-600">
          {workspace.application.courseName} · {workspace.application.universityName}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link
            href={`/apply/${applicationId}/cv-builder`}
            className="group flex min-h-80 flex-col rounded-2xl border border-slate-200 bg-white p-8 transition hover:-translate-y-1 hover:border-rose-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]"
          >
            <span className="text-sm font-bold tabular-nums text-slate-400">01</span>
            <div className="mt-12 grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-xl text-rose-600">
              ↗
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">Build from scratch</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Gom trải nghiệm, tạo Target Profile và xây CV tiếng Anh phù hợp với chương trình.
            </p>
            <span className="mt-auto block rounded-lg bg-rose-600 px-5 py-3 text-center text-sm font-bold text-white transition group-hover:bg-rose-700">
              Bắt đầu xây CV
            </span>
          </Link>
          <Link
            href={`/apply/${applicationId}/cv-review`}
            className="group flex min-h-80 flex-col rounded-2xl border border-slate-200 bg-white p-8 transition hover:-translate-y-1 hover:border-rose-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.10)]"
          >
            <span className="text-sm font-bold tabular-nums text-slate-400">02</span>
            <div className="mt-12 grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-xl text-rose-600">
              ⤴
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">Review existing CV</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Tải lên hoặc dán CV hiện có để nhận đánh giá theo dẫn chứng.
            </p>
            <span className="mt-auto block rounded-lg bg-rose-600 px-5 py-3 text-center text-sm font-bold text-white transition group-hover:bg-rose-700">
              Mở CV Review
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
