import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { T } from '@/lib/i18n';
import { Badge, Button, ICONS, KitIcon } from '@/shared/ui';

function ApplicationStatusItem({
  number,
  label,
  status,
  state,
}: {
  number: number;
  label: string;
  status: string;
  state: 'complete' | 'current' | 'upcoming';
}) {
  const markerClass = state === 'complete'
    ? 'bg-tier-safe text-on-tier-safe'
    : state === 'current'
      ? 'bg-brand text-on-brand'
      : 'bg-surface text-fg-muted';

  return (
    <li className="flex items-center gap-gb-lg rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
      <span className={`flex size-gb-4xl shrink-0 items-center justify-center rounded-gb-full text-gb-sm font-semibold ${markerClass}`}>
        {state === 'complete' ? <KitIcon art={ICONS.checkCircle} frame={20} /> : number}
      </span>
      <span className="min-w-0 flex-1 text-gb-sm font-semibold text-fg"><T k={label} /></span>
      <span className="shrink-0 text-gb-xs text-fg-muted"><T k={status} /></span>
    </li>
  );
}

export default async function MentorApplySuccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/advisors');

  return (
    <main className="min-h-screen bg-transparent px-gb-xl py-gb-7xl md:px-gb-4xl">
      <article className="mx-auto flex max-w-gb-width-sm flex-col gap-gb-3xl rounded-gb-2xl border border-line bg-surface p-gb-4xl shadow-gb-lg md:p-gb-5xl">
        <div className="flex flex-col items-center gap-gb-lg text-center">
          <span className="flex size-gb-7xl items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe">
            <KitIcon art={ICONS.checkCircle} frame={28} />
          </span>
          <Badge variant="safe-chip"><T k="Application submitted" /></Badge>
          <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
            <T k="Application received" />
          </h1>
          <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            <T k="Thanks for applying. Your request is now in the admin review queue, and we’ll email you with the outcome within 48 hours." />
          </p>
        </div>

        <h2 id="application-status-heading" className="sr-only"><T k="Application status" /></h2>
        <ol className="grid gap-gb-sm" aria-labelledby="application-status-heading">
          <ApplicationStatusItem number={1} label="Submitted" status="Complete" state="complete" />
          <ApplicationStatusItem number={2} label="Admin verification" status="In review" state="current" />
          <ApplicationStatusItem number={3} label="Profile published" status="After approval" state="upcoming" />
        </ol>

        <div className="rounded-gb-xl border border-gb-brand-100 bg-brand-subtle p-gb-xl text-gb-sm text-fg-secondary">
          <T k="You can add availability from your advisor dashboard while you wait. Students will only see your profile after an admin approves it." />
        </div>

        <div className="flex flex-col gap-gb-lg sm:flex-row">
          <Button href="/dashboard/advisor" size="lg" className="sm:flex-1">
            <T k="Go to my advisor dashboard" />
          </Button>
          <Button href="/advisors" variant="secondary" size="lg" className="sm:flex-1">
            <T k="Browse other advisors" />
          </Button>
        </div>
      </article>
    </main>
  );
}
