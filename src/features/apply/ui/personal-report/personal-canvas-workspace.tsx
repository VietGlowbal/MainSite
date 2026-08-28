'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PersonalReportV2, PersonalReportTrigger } from '../../domain';
import { Badge, Modal } from '@/shared/ui';
import { AreasForGrowthView } from './areas-for-growth';
import { CoreIdentityView } from './core-identity';
import { DrivingForceView } from './driving-force';
import { EmergingThemesView } from './emerging-themes';
import { IdentityEvidenceProfileView } from './identity-evidence-profile';
import {
  PersonalCanvasView,
  type PersonalCanvasSectionKey,
} from './personal-canvas';
import { PersonalPositioningView } from './personal-positioning';
import { ProofOfMeView } from './proof-of-me';
import {
  SnapshotCapabilityProfileView,
  SnapshotFuturePathwaysView,
  SnapshotGrowthMatrixView,
  SnapshotMotivationProfileView,
  SnapshotSocialProofSummaryView,
} from './personal-report-snapshot-insights';
import { PersonalReportInlineUpdateProvider } from './shared';
import { SignaturePatternView } from './signature-pattern';

type TabSpec = {
  id: string;
  label: string;
  content: ReactNode;
};

type SectionSpec = {
  key: PersonalCanvasSectionKey;
  index: number;
  label: string;
  title: string;
  description: string;
  tabs: TabSpec[];
};

/**
 * Canvas sounds are intentionally always enabled. AudioContext is still
 * created lazily from a user interaction, so browsers' autoplay policies are
 * respected without presenting another setting in an already dense report UI.
 */
function useCuteCanvasSounds() {
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      const context = audioRef.current;
      audioRef.current = null;
      if (context && context.state !== 'closed') void context.close();
    };
  }, []);

  function audio(): AudioContext | null {
    if (!audioRef.current) {
      try {
        audioRef.current = new AudioContext();
      } catch {
        return null;
      }
    }
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    return audioRef.current;
  }

  function tone(
    frequency: number,
    offset: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) {
    const context = audio();
    if (!context) return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.01, start + duration);

    filter.type = 'lowpass';
    filter.frequency.value = 2200;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function bubble(offset = 0) {
    const context = audio();
    if (!context) return;
    const start = context.currentTime + offset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(430, start);
    oscillator.frequency.exponentialRampToValueAtTime(830, start + 0.085);
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.35;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.018, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
  }

  function open() {
    bubble(0);
    tone(784, 0.025, 0.11, 0.016, 'sine');
    tone(988, 0.085, 0.15, 0.012, 'triangle');
    tone(1318, 0.145, 0.2, 0.008, 'sine');
  }

  function close() {
    tone(988, 0, 0.08, 0.012, 'sine');
    tone(784, 0.055, 0.09, 0.01, 'triangle');
    bubble(0.1);
  }

  function tab() {
    bubble(0);
    tone(760, 0.03, 0.08, 0.009, 'sine');
  }

  // Memoised so callers can list `sounds` as an effect dependency without the
  // effect re-running on every render. `open`/`close`/`tab` close over
  // `audioRef` and nothing else — no state, no props — so pinning the first
  // render's copies is safe and the empty dependency array is deliberate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ({ open, close, tab }), []);
}

function panelTitle(report: PersonalReportV2, section: PersonalCanvasSectionKey): string {
  switch (section) {
    case 'coreIdentity':
      return report.coreIdentity.available
        ? report.coreIdentity.headline ?? 'Core Identity'
        : 'Core Identity';
    case 'drivingForces':
      return report.drivingForce.available
        ? report.drivingForce.headline ?? 'Driving Forces'
        : 'Driving Forces';
    case 'provenCapabilities':
      return 'What your evidence demonstrates you can do';
    case 'socialProof': {
      const count = report.analytics?.evidenceSummary.totalItems;
      return count == null
        ? 'The evidence behind your profile'
        : `${count} evidence item${count === 1 ? '' : 's'} support your profile`;
    }
    case 'areasForGrowth':
      return 'Where stronger evidence could make your profile more complete';
    case 'longTermVision':
      return 'The directions emerging from your current trajectory';
  }
}

function sectionSpecs({
  report,
  returnTo,
  onAnswered,
}: {
  report: PersonalReportV2;
  returnTo: string | undefined;
  onAnswered: (() => void) | undefined;
}): Record<PersonalCanvasSectionKey, SectionSpec> {
  const proof = (
    <ProofOfMeView
      section={report.proofOfMe}
      evidenceSummary={report.analytics?.evidenceSummary}
      overallSummary={undefined}
      returnTo={returnTo}
    />
  );

  return {
    coreIdentity: {
      key: 'coreIdentity',
      index: 1,
      label: 'Core Identity',
      title: panelTitle(report, 'coreIdentity'),
      description:
        'The recurring roles, behaviours and patterns that describe who you consistently show yourself to be.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <div className="flex flex-col gap-gb-lg">
              <CoreIdentityView section={report.coreIdentity} returnTo={returnTo} />
              <IdentityEvidenceProfileView report={report} />
            </div>
          ),
        },
        {
          id: 'signature-pattern',
          label: 'Signature Pattern',
          content: (
            <SignaturePatternView
              section={report.signaturePattern}
              patternSupport={report.analytics?.signaturePatternSupport}
              returnTo={returnTo}
            />
          ),
        },
        { id: 'evidence', label: 'Evidence', content: proof },
      ],
    },
    drivingForces: {
      key: 'drivingForces',
      index: 2,
      label: 'Driving Forces',
      title: panelTitle(report, 'drivingForces'),
      description:
        'What repeatedly motivates your choices, where those motivations appear in your experiences, and how confidently the evidence supports them.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <DrivingForceView
              section={report.drivingForce}
              returnTo={returnTo}
              onAnswered={onAnswered}
            />
          ),
        },
        {
          id: 'motivation-signals',
          label: 'Motivation Signals',
          content: <SnapshotMotivationProfileView report={report} />,
        },
        { id: 'evidence', label: 'Evidence', content: proof },
      ],
    },
    provenCapabilities: {
      key: 'provenCapabilities',
      index: 3,
      label: 'Proven Capabilities',
      title: panelTitle(report, 'provenCapabilities'),
      description:
        'What your evidence demonstrates you can do, how those strengths combine, and the positioning they create for you as an applicant.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: <SnapshotCapabilityProfileView report={report} />,
        },
        {
          id: 'positioning',
          label: 'Positioning',
          content: (
            <PersonalPositioningView
              section={report.personalPositioning}
              positioningDimensions={report.analytics?.positioningDimensions}
              returnTo={returnTo}
            />
          ),
        },
        { id: 'evidence', label: 'Evidence', content: proof },
      ],
    },
    socialProof: {
      key: 'socialProof',
      index: 4,
      label: 'Social Proof',
      title: panelTitle(report, 'socialProof'),
      description:
        'The tangible activities, outcomes and verification that make the claims in your profile credible.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: <SnapshotSocialProofSummaryView report={report} />,
        },
        { id: 'proof', label: 'Proof of Me', content: proof },
      ],
    },
    areasForGrowth: {
      key: 'areasForGrowth',
      index: 5,
      label: 'Areas for Growth',
      title: panelTitle(report, 'areasForGrowth'),
      description:
        'Where the current evidence is limited and where stronger proof could make the profile more complete. This is diagnosis, not your application strategy.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: <SnapshotGrowthMatrixView report={report} />,
        },
        {
          id: 'gaps',
          label: 'Evidence Gaps',
          content: <AreasForGrowthView report={report} />,
        },
      ],
    },
    longTermVision: {
      key: 'longTermVision',
      index: 6,
      label: 'Long-Term Vision',
      title: panelTitle(report, 'longTermVision'),
      description:
        'The themes and directions emerging from the choices you repeatedly make — presented as possibilities, not predictions.',
      tabs: [
        {
          id: 'overview',
          label: 'Overview',
          content: <SnapshotFuturePathwaysView report={report} />,
        },
        {
          id: 'themes',
          label: 'Emerging Themes',
          content: (
            <EmergingThemesView
              section={report.emergingThemes}
              themeMaturity={report.analytics?.themeMaturity}
              returnTo={returnTo}
            />
          ),
        },
        { id: 'evidence', label: 'Evidence', content: proof },
      ],
    },
  };
}

export function PersonalCanvasWorkspace({
  report,
  returnTo,
  applicationId,
  onRegenerate,
}: {
  report: PersonalReportV2;
  returnTo: string | undefined;
  applicationId?: string | undefined;
  onRegenerate: ((trigger: PersonalReportTrigger) => void) | undefined;
}) {
  const [activeSection, setActiveSection] = useState<PersonalCanvasSectionKey | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const sounds = useCuteCanvasSounds();

  const onAnswered = useMemo(
    () => (onRegenerate ? () => onRegenerate('supplement_answer') : undefined),
    [onRegenerate],
  );
  const specs = useMemo(
    () => sectionSpecs({ report, returnTo, onAnswered }),
    [report, returnTo, onAnswered],
  );

  const activeSpec = activeSection ? specs[activeSection] : null;
  const tab =
    activeSpec?.tabs.find((candidate) => candidate.id === activeTab) ?? activeSpec?.tabs[0];

  const openSection = useCallback(
    (section: PersonalCanvasSectionKey) => {
      const firstTab = specs[section].tabs[0]?.id ?? 'overview';
      setActiveSection(section);
      setActiveTab(firstTab);
      sounds.open();
    },
    [specs, sounds],
  );

  const closePanel = useCallback(() => {
    setActiveSection((current) => {
      if (!current) return current;
      sounds.close();
      return null;
    });
  }, [sounds]);

  function selectTab(tabId: string) {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    sounds.tab();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A modifier means the browser or OS owns this chord, not us. Without
      // this guard Cmd/Ctrl+F toggled focus mode AND called preventDefault(),
      // which broke find-in-page on the whole report, and Cmd/Ctrl+1..6 opened
      // a section behind the tab the user was switching to.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const shortcuts: Record<string, PersonalCanvasSectionKey> = {
        '1': 'coreIdentity',
        '2': 'drivingForces',
        '3': 'provenCapabilities',
        '4': 'socialProof',
        '5': 'areasForGrowth',
        '6': 'longTermVision',
      };

      if (event.key === 'Escape') closePanel();
      const shortcut = shortcuts[event.key];
      if (shortcut) openSection(shortcut);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Previously this effect had no dependency array at all, so the listener
    // was torn down and rebound after every single render of a large report.
  }, [activeSection, closePanel, openSection, sounds]);

  return (
    <section className="flex flex-col gap-gb-lg">
      <div className="min-w-0">
          <PersonalCanvasView
            report={report}
            activeSection={activeSection}
            onSelect={openSection}
          />
          <p className="mt-gb-md text-center text-gb-xs text-fg-muted print:hidden">
            Keyboard: 1–6 opens a section · Esc closes
          </p>
      </div>

      {activeSpec ? (
        <Modal
          open={Boolean(activeSection)}
          onClose={closePanel}
          label={`${activeSpec.label} details`}
          className="max-w-4xl overflow-hidden p-0"
        >
          <div className="flex max-h-[85vh] min-h-0 flex-col" data-report-auto-translate>
              <header className="shrink-0 border-b border-line bg-surface px-gb-xl pt-gb-xl">
                <div className="flex items-start justify-between gap-gb-lg">
                  <div className="min-w-0">
                    <Badge variant="brand-subtle">
                      {activeSpec.index}. {activeSpec.label}
                    </Badge>
                    <h2
                      className="mt-gb-lg font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
                      data-no-auto-translate
                    >
                      {activeSpec.title}
                    </h2>
                    <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-tertiary">
                      {activeSpec.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-gb-sm print:hidden">
                    <button
                      type="button"
                      onClick={closePanel}
                      aria-label="Close section"
                      className="grid h-10 w-10 place-items-center rounded-gb-lg border border-line bg-surface text-gb-lg text-fg-tertiary shadow-sm transition hover:border-brand/30 hover:bg-brand/5 hover:text-fg-brand"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="mt-gb-lg flex gap-gb-xl overflow-x-auto" role="tablist">
                  {activeSpec.tabs.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      role="tab"
                      aria-selected={candidate.id === tab?.id}
                      onClick={() => selectTab(candidate.id)}
                      className={[
                        'shrink-0 border-b-2 pb-gb-md text-gb-sm font-semibold transition',
                        candidate.id === tab?.id
                          ? 'border-brand text-fg-brand'
                          : 'border-transparent text-fg-muted hover:text-fg',
                      ].join(' ')}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              </header>

              <div
                key={`${activeSection}-${tab?.id ?? 'overview'}`}
                role="tabpanel"
                className="min-h-0 flex-1 overflow-y-auto p-gb-xl"
              >
                <PersonalReportInlineUpdateProvider onAnswered={onAnswered} applicationId={applicationId}>
                  {tab?.content}
                </PersonalReportInlineUpdateProvider>
              </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
