import Link from 'next/link';
import { parseScenario, SCENARIO_LABEL } from './fixtures';

/** THROWAWAY DEMO — index and running order. Delete with the folder. */

const FLOW = [
  {
    href: '/demo-throwaway/overview',
    label: 'Workspace overview',
    note: 'Two document cards, derived status, and the single next action. Everything downstream is reachable from here.',
  },
  {
    href: '/demo-throwaway/cv/target-profile',
    label: '1 · Target Profile',
    note: 'What the CV has to prove. Seven fields, generated then edited, each tagged with where it came from.',
  },
  {
    href: '/demo-throwaway/cv/content',
    label: '2 · CV Content',
    note: 'Section and entry editor, import from an uploaded CV, per-entry AI suggestions behind Accept or Dismiss.',
  },
  {
    href: '/demo-throwaway/cv/review',
    label: '3 · CV Assessment',
    note: 'Strengths quoted from the CV, missing signals with a section to jump to, and the outdated-review state.',
  },
  {
    href: '/demo-throwaway/cv/layout',
    label: '4 · Layout and PDF',
    note: 'Three structurally different layouts, a deterministic recommendation, and the export state machine.',
  },
  {
    href: '/demo-throwaway/statement',
    label: 'Personal Statement',
    note: 'Strategy brief, editor, inline feedback bound to quotes, AACC pillars, and the readiness checklist.',
  },
];

export default async function DemoIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  const scenario = parseScenario(raw);

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-col gap-gb-lg">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          Application Strategy walkthrough
        </h1>
        <p className="max-w-3xl text-gb-md text-fg-tertiary">
          The CV and personal statement workspace from the Feature 2 spec, running on
          fixtures. Every page is clickable and stateful, nothing is persisted, and no
          request leaves the machine. Currently showing{' '}
          <strong className="font-semibold text-fg">{SCENARIO_LABEL[scenario]}</strong>.
        </p>
      </header>

      <ol className="flex flex-col gap-gb-lg">
        {FLOW.map((item) => (
          <li key={item.href}>
            <Link
              href={`${item.href}?scenario=${scenario}`}
              className="group flex flex-col gap-gb-xs rounded-gb-2xl border border-line bg-surface p-gb-2xl transition-colors hover:border-line-strong hover:bg-surface-hover"
            >
              <span className="text-gb-md font-semibold text-fg group-hover:text-fg-brand">
                {item.label}
              </span>
              <span className="text-gb-sm text-fg-tertiary">{item.note}</span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface-muted p-gb-2xl">
        <h2 className="text-gb-md font-semibold text-fg">Worth pointing out while demoing</h2>
        <ul className="flex list-disc flex-col gap-gb-md pl-gb-2xl text-gb-sm text-fg-tertiary">
          <li>
            The three scenarios are not three sets of screenshots. Status is computed by
            the committed <code className="text-fg">domain/status.ts</code> and{' '}
            <code className="text-fg">domain/staleness.ts</code> from version numbers in the
            fixtures, so the stale-review state on{' '}
            <strong className="font-semibold text-fg">In progress</strong> is real logic
            reacting to real data.
          </li>
          <li>
            Editing the CV on the Content page bumps its version and turns the assessment
            outdated, the same way it will in production.
          </li>
          <li>
            No AI text is ever applied without Accept, Dismiss or Edit manually. That is
            enforced by the suggestion component having no other path.
          </li>
          <li>
            The AACC section shows four pillar scores and deliberately no overall score.
            The type has no field for one.
          </li>
          <li>
            Delete with <code className="text-fg">rm -rf src/app/demo-throwaway</code>.
            Nothing outside the folder was touched.
          </li>
        </ul>
      </section>
    </div>
  );
}
