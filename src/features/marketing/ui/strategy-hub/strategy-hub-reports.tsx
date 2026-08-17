'use client';

import { useState } from 'react';
import { T, useT } from '@/lib/i18n';
import { Badge, Button, Container, ICONS, KitIcon, Panel } from '@/shared/ui';
import type { KitIconArt } from '@/shared/ui';

type ReportKey = 'personal' | 'matching' | 'strategy' | 'evaluation';

type ReportPanel = { label: string; description: string };

type ReportSpec = {
  key: ReportKey;
  icon: KitIconArt;
  title: string;
  summary: string;
  previewTitle: string;
  previewDescription: string;
  panels: readonly [ReportPanel, ReportPanel, ReportPanel, ReportPanel];
  calloutLabel: string;
  calloutBody: string;
  statusLabel: string;
  href: string;
  available: boolean;
};

const REPORTS: readonly ReportSpec[] = [
  {
    key: 'personal',
    icon: ICONS.usersTwo,
    title: 'Personal Report',
    summary: 'Understand your overall applicant profile.',
    previewTitle: 'Understand the applicant before the application.',
    previewDescription:
      'The strongest recurring signals across your profile, evidence and experiences — not tied to any one university.',
    panels: [
      { label: 'Core identity', description: 'The themes and patterns that consistently show up across your profile.' },
      { label: 'Proven capabilities', description: 'Strengths that are supported by your experiences and evidence.' },
      { label: 'Evidence quality', description: 'Where your profile is well supported and where detail is still thin.' },
      { label: 'Areas for growth', description: 'The parts of your overall profile that could become stronger over time.' },
    ],
    calloutLabel: 'Across all applications',
    calloutBody: 'This is your reusable personal foundation. It does not belong to one university or course.',
    statusLabel: 'Available now',
    href: '/ai-strategy/personal-report',
    available: true,
  },
  {
    key: 'matching',
    icon: ICONS.chartBreakoutSquare,
    title: 'Matching Report',
    summary: 'See how you align with a chosen course.',
    previewTitle: 'See how your profile fits a chosen university and course.',
    previewDescription:
      'Compares your profile against the university and course inside an application you open in My Portal.',
    panels: [
      { label: 'Academic fit', description: 'Compare your academic profile against what the course expects.' },
      { label: 'Course alignment', description: 'Understand how your interests and experiences connect to the subject.' },
      { label: 'Evidence fit', description: 'See which achievements strengthen this specific application.' },
      { label: 'Potential gaps', description: 'Identify the parts of the match that need stronger evidence or positioning.' },
    ],
    calloutLabel: 'Application specific',
    calloutBody: 'Open an application first. GlowBal then generates this report for that exact university and course.',
    statusLabel: 'Available now',
    href: '/apply',
    available: true,
  },
  {
    key: 'strategy',
    icon: ICONS.zap,
    title: 'Strategy Report',
    summary: 'Turn analysis into priorities and actions.',
    previewTitle: 'Turn the analysis into a plan you can actually follow.',
    previewDescription:
      'Priorities and actions tailored to the application you opened, with the reasoning behind each one.',
    panels: [
      { label: 'Top priorities', description: 'The highest-value improvements to focus on first.' },
      { label: 'Recommended actions', description: 'Concrete things you can do to strengthen the application.' },
      { label: 'Why it matters', description: 'The reasoning behind each recommendation.' },
      { label: 'What comes next', description: 'A clear sequence so you always know the next move.' },
    ],
    calloutLabel: 'Turns into action',
    calloutBody: 'Strategy recommendations become tasks inside your GlowBal workspace.',
    statusLabel: 'Part of GlowBal Plus',
    href: '/apply',
    available: true,
  },
  {
    key: 'evaluation',
    icon: ICONS.checkCircle,
    title: 'Evaluation Report',
    summary: 'Check readiness before submission.',
    previewTitle: 'Check readiness before submission.',
    previewDescription: "A pre-submission readiness check is on the roadmap — it isn't available yet.",
    panels: [
      { label: 'Application readiness', description: "A pre-submission readiness check is on the roadmap — it isn't available yet." },
      { label: 'Remaining gaps', description: "A pre-submission readiness check is on the roadmap — it isn't available yet." },
      { label: 'Document check', description: "A pre-submission readiness check is on the roadmap — it isn't available yet." },
      { label: 'Final recommendation', description: "A pre-submission readiness check is on the roadmap — it isn't available yet." },
    ],
    calloutLabel: 'Coming soon',
    calloutBody: "A pre-submission readiness check is on the roadmap — it isn't available yet.",
    statusLabel: 'Coming soon',
    href: '',
    available: false,
  },
];

export function StrategyHubReports({ onSelect }: { onSelect: () => void }) {
  const t = useT();
  const [activeKey, setActiveKey] = useState<ReportKey>('personal');
  const active = REPORTS.find((report) => report.key === activeKey) ?? REPORTS[0]!;

  return (
    <section id="reports" className="pt-gb-9xl">
      <Container className="flex flex-col gap-gb-3xl">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-gb-sm text-center">
          <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
            <T k="Your GlowBal reports" />
          </p>
          <h2 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            <T k="Three reports. Each one answers a different question." />
          </h2>
          <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            <T k="Explore what each report is for before you open an application and generate anything." />
          </p>
        </div>

        <div className="grid gap-gb-xl lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <ul className="flex flex-col gap-gb-md">
            {REPORTS.map((report) => (
              <li key={report.key}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveKey(report.key);
                    onSelect();
                  }}
                  aria-pressed={report.key === activeKey}
                  className={[
                    'flex w-full items-center gap-gb-lg rounded-gb-xl border p-gb-lg text-left transition-all',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    report.key === activeKey
                      ? 'border-brand bg-brand-subtle shadow-gb-sm'
                      : 'border-line bg-surface hover:translate-x-1 hover:shadow-gb-sm motion-reduce:hover:translate-x-0',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-gb-6xl w-gb-6xl shrink-0 items-center justify-center rounded-gb-lg',
                      report.available ? 'bg-brand text-on-brand' : 'bg-surface-muted text-fg-muted',
                    ].join(' ')}
                  >
                    <KitIcon art={report.icon} frame={22} />
                  </span>
                  <span className="flex flex-1 flex-col gap-gb-xxs">
                    <span className="flex items-center gap-gb-sm">
                      <span className="font-display text-gb-md font-semibold text-fg">{t(report.title)}</span>
                      {!report.available && (
                        <Badge variant="neutral-chip">
                          <T k="Coming soon" />
                        </Badge>
                      )}
                    </span>
                    <span className="text-gb-sm text-fg-tertiary">{t(report.summary)}</span>
                  </span>
                  <KitIcon
                    art={ICONS.arrowRight}
                    frame={18}
                    className={report.key === activeKey ? 'text-fg-brand' : 'text-fg-muted'}
                  />
                </button>
              </li>
            ))}
          </ul>

          <Panel key={active.key} padding="md" className="flex flex-col gap-gb-xl motion-safe:animate-[gbStrategyPreviewIn_0.38s_ease-out_both]">
            <div className="flex items-center gap-gb-md">
              <span className="flex h-3 w-3 rounded-full bg-line" aria-hidden="true" />
              <span className="flex h-3 w-3 rounded-full bg-line" aria-hidden="true" />
              <span className="flex h-3 w-3 rounded-full bg-line" aria-hidden="true" />
              <span className="ml-gb-sm text-gb-xs font-semibold text-fg-muted">
                GlowBal · {t(active.title)}
              </span>
            </div>

            <div className="flex flex-col gap-gb-sm">
              <h3 className="font-display text-gb-xl font-semibold tracking-gb-display-tight text-fg">
                {t(active.previewTitle)}
              </h3>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary">{t(active.previewDescription)}</p>
            </div>

            <div className="grid gap-gb-md sm:grid-cols-2">
              {active.panels.map((panel) => (
                <div key={panel.label} className="rounded-gb-lg border border-line bg-surface-muted p-gb-lg">
                  <p className="text-gb-sm font-semibold text-fg">{t(panel.label)}</p>
                  <p className="mt-gb-xxs text-gb-xs leading-relaxed text-fg-tertiary">{t(panel.description)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-gb-lg border border-brand/20 bg-brand-subtle p-gb-lg">
              <p className="text-gb-xs font-semibold uppercase tracking-[0.1em] text-fg-brand">
                {t(active.calloutLabel)}
              </p>
              <p className="mt-gb-xxs text-gb-sm text-fg-secondary">{t(active.calloutBody)}</p>
            </div>

            {active.available ? (
              <Button href={active.href} size="lg" className="self-start">
                <T k="Explore →" />
              </Button>
            ) : (
              <Button size="lg" className="self-start" disabled>
                <T k="Coming soon" />
              </Button>
            )}
          </Panel>
        </div>
      </Container>
    </section>
  );
}
