import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isCvBuilderEnabled } from '@/lib/ai/cv-builder-context';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { getServerIdentity } from '@/server/auth/server-identity';

export const metadata: Metadata = {
  title: 'Tạo CV | GlowBal',
  description: 'Chọn format và cách bắt đầu xây dựng CV của bạn.',
};

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      className={className}
    >
      <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" />
      <path d="m19 15 .55 2.45L22 18l-2.45.55L19 21l-.55-2.45L16 18l2.45-.55L19 15Z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      className="size-5"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

function FormatCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <article className="flex min-h-[318px] flex-col rounded-gb-xl border border-line bg-surface p-gb-3xl">
      <span className="grid size-10 place-items-center rounded-gb-full bg-surface-muted text-fg">
        <SparkleIcon className="size-5" />
      </span>
      <h2 className="mt-gb-2xl text-gb-xl font-semibold tracking-tight text-fg-brand">{title}</h2>
      <p className="mt-gb-md max-w-[290px] text-gb-md leading-6 text-fg-secondary">{description}</p>
      <Link
        href={href}
        className="mt-auto inline-flex min-h-12 items-center justify-center rounded-gb-md bg-brand px-gb-xl text-gb-md font-semibold text-on-brand shadow-gb-xs transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Chọn ngay
      </Link>
    </article>
  );
}

function StartCard({
  title,
  description,
  href,
  actionLabel,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="flex min-h-[334px] flex-col rounded-gb-xl border border-line bg-surface p-gb-3xl">
      <span className="grid size-10 place-items-center rounded-gb-full bg-surface-muted text-fg">
        <SparkleIcon className="size-5" />
      </span>
      <h2 className="mt-gb-2xl text-gb-xl font-semibold tracking-tight text-fg-brand">{title}</h2>
      <p className="mt-gb-md max-w-2xl text-gb-md leading-6 text-fg-secondary">{description}</p>
      <Link
        href={href}
        className="mt-auto inline-flex min-h-12 items-center justify-center gap-gb-sm rounded-gb-md bg-brand px-gb-xl text-gb-md font-semibold text-on-brand shadow-gb-xs transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {icon}
        {actionLabel}
      </Link>
    </article>
  );
}

function FloatingAiLink({ applicationId }: { applicationId: string }) {
  return (
    <Link
      href={`/ai-strategy/${applicationId}`}
      aria-label="Mở Glowbal AI"
      title="Glowbal AI"
      className="fixed bottom-6 right-6 z-30 grid size-16 place-items-center rounded-full bg-brand text-on-brand shadow-[0_14px_30px_rgba(225,29,72,0.3)] transition hover:-translate-y-1 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
    >
      <SparkleIcon className="size-7" />
    </Link>
  );
}

export default async function CvHubPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  if (!isCvBuilderEnabled()) redirect(`/apply/${applicationId}/cv-review`);

  const { identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');
  const context = await getApplicationDocumentContext(applicationId, user.id);
  if (!context) notFound();

  const builderHref = `/apply/${applicationId}/cv-builder`;
  const reviewHref = `/ai-strategy/${applicationId}/cv/review`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 pb-24 pt-12 text-fg sm:px-6 lg:px-8 lg:pt-14">
      <div className="mx-auto max-w-[1216px]">
        <section aria-labelledby="cv-format-heading">
          <h1 id="cv-format-heading" className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Chọn format CV
          </h1>
          <div className="mt-8 grid gap-10 md:grid-cols-3">
            <FormatCard
              title="AACC"
              description="Gom trải nghiệm tạo target profile và xây CV tiếng anh phù hợp với chương trình"
              href={builderHref}
            />
            <FormatCard
              title="Harvard Style"
              description="Tải CV lên hoặc dán CV hiện có để nhận đánh giá theo dẫn chứng"
              href={reviewHref}
            />
          </div>
        </section>

        <section id="cv-start" aria-labelledby="cv-start-heading" className="mt-28">
          <h2 id="cv-start-heading" className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            Bạn muốn bắt đầu từ đâu
          </h2>
          <div className="mt-8 grid gap-10 md:grid-cols-2">
            <StartCard
              title="Build from scratch"
              description="Gom trải nghiệm tạo target profile và xây CV tiếng anh phù hợp với chương trình"
              href={builderHref}
              actionLabel="Bắt đầu xây CV"
              icon={<SparkleIcon className="size-5" />}
            />
            <StartCard
              title="Input"
              description="Tải CV lên hoặc dán CV hiện có để nhận đánh giá theo dẫn chứng"
              href={reviewHref}
              actionLabel="Upload"
              icon={<UploadIcon />}
            />
          </div>
        </section>
      </div>
      <FloatingAiLink applicationId={applicationId} />
    </main>
  );
}
