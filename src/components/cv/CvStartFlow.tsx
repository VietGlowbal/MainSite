'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { T } from '@/lib/i18n';
import type { CvPublicTemplateId } from '@/lib/ai/cv-builder';

function SparkleIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" className={className}>
      <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" />
      <path d="m19 15 .55 2.45L22 18l-2.45.55L19 21l-.55-2.45L16 18l2.45-.55L19 15Z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" className="size-5">
      <path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

function FormatCard({ id, title, description, selected, onSelect }: {
  id: CvPublicTemplateId;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (id: CvPublicTemplateId) => void;
}) {
  return (
    <article className={`flex min-h-[318px] flex-col rounded-gb-xl border bg-surface p-gb-3xl transition ${selected ? 'border-brand ring-2 ring-brand/15' : 'border-line'}`}>
      <span className="grid size-10 place-items-center rounded-gb-full bg-surface-muted text-fg"><SparkleIcon className="size-5" /></span>
      <h2 className="mt-gb-2xl text-gb-xl font-semibold tracking-tight text-fg-brand"><T k={title} /></h2>
      <p className="mt-gb-md max-w-xl text-gb-md leading-6 text-fg-secondary"><T k={description} /></p>
      <button type="button" aria-pressed={selected} onClick={() => onSelect(id)} className="mt-auto inline-flex min-h-12 items-center justify-center rounded-gb-md bg-brand px-gb-xl text-gb-md font-semibold text-on-brand shadow-gb-xs transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <T k="Choose now" />
      </button>
    </article>
  );
}

export function StartCard({ title, description, href, actionLabel, icon }: {
  title: string;
  description: string;
  href: string | null;
  actionLabel: string;
  icon: ReactNode;
}) {
  const classes = 'mt-auto inline-flex min-h-12 items-center justify-center gap-gb-sm rounded-gb-md bg-brand px-gb-xl text-gb-md font-semibold text-on-brand shadow-gb-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
  return (
    <article className="flex min-h-[334px] flex-col rounded-gb-xl border border-line bg-surface p-gb-3xl">
      <span className="grid size-10 place-items-center rounded-gb-full bg-surface-muted text-fg"><SparkleIcon className="size-5" /></span>
      <h2 className="mt-gb-2xl text-gb-xl font-semibold tracking-tight text-fg-brand"><T k={title} /></h2>
      <p className="mt-gb-md max-w-2xl text-gb-md leading-6 text-fg-secondary"><T k={description} /></p>
      {href ? <Link href={href} className={`${classes} hover:bg-brand-hover`}>{icon}<T k={actionLabel} /></Link> : <span aria-disabled="true" className={`${classes} cursor-not-allowed opacity-45`}>{icon}<T k={actionLabel} /></span>}
    </article>
  );
}

export function CvStartFlow({ applicationId }: { applicationId: string }) {
  const [template, setTemplate] = useState<CvPublicTemplateId | null>(null);
  const query = template ? `?template=${template}` : '';

  return (
    <>
      <section aria-labelledby="cv-format-heading">
        <h1 id="cv-format-heading" className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl"><T k="Choose a CV format" /></h1>
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <FormatCard id="technical" title="AACC" description="Light rose–slate, emphasizes personal character." selected={template === 'technical'} onSelect={setTemplate} />
          <FormatCard id="academic" title="Harvard Style" description="Black and white, single column, ATS-optimized." selected={template === 'academic'} onSelect={setTemplate} />
        </div>
      </section>
      <section id="cv-start" aria-labelledby="cv-start-heading" className="mt-28">
        <h2 id="cv-start-heading" className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl"><T k="Where would you like to start?" /></h2>
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <StartCard title="Build from scratch" description="Bring your experience together into a target profile and an English CV for the programme" href={template ? `/apply/${applicationId}/cv-builder${query}` : null} actionLabel="Start building your CV" icon={<SparkleIcon className="size-5" />} />
          <StartCard title="Input" description="Upload or paste an existing CV to receive evidence-based feedback" href={template ? `/apply/${applicationId}/cv-review${query}` : null} actionLabel="Upload" icon={<UploadIcon />} />
        </div>
      </section>
    </>
  );
}
