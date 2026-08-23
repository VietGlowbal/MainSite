'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { PersonalReportV2, PersonalReportTrigger } from '../../domain';
import { Badge } from '@/shared/ui';
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

type ConnectorGeometry = {
  path: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
} | null;

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

function FocusModeIcon({ focused }: { focused: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[1.1rem] w-[1.1rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {focused ? (
        <>
          <path d="M3 9h6V3" />
          <path d="M21 9h-6V3" />
          <path d="M3 15h6v6" />
          <path d="M21 15h-6v6" />
        </>
      ) : (
        <>
          <path d="M8 3H3v5" />
          <path d="M16 3h5v5" />
          <path d="M8 21H3v-5" />
          <path d="M16 21h5v-5" />
        </>
      )}
    </svg>
  );
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
  onRegenerate,
}: {
  report: PersonalReportV2;
  returnTo: string | undefined;
  onRegenerate: ((trigger: PersonalReportTrigger) => void) | undefined;
}) {
  const [activeSection, setActiveSection] = useState<PersonalCanvasSectionKey | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [focusMode, setFocusMode] = useState(false);
  const [connector, setConnector] = useState<ConnectorGeometry>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const sounds = useCuteCanvasSounds();
  const reduceMotion = useReducedMotion();

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
      // Remember what to hand focus back to when the panel closes. Without
      // this, closing dumps a keyboard user at the top of the document.
      lastTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const firstTab = specs[section].tabs[0]?.id ?? 'overview';
      setActiveSection(section);
      setActiveTab(firstTab);
      setFocusMode(false);
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
    setFocusMode(false);
    setConnector(null);
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
      if ((event.key === 'f' || event.key === 'F') && activeSection) {
        event.preventDefault();
        setFocusMode((current) => !current);
        sounds.tab();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Previously this effect had no dependency array at all, so the listener
    // was torn down and rebound after every single render of a large report.
  }, [activeSection, closePanel, openSection, sounds]);

  // Move focus into the panel when it opens, and give it back when it closes.
  // On mobile the panel is a full-screen overlay; without this a keyboard or
  // screen-reader user opened it and stayed on the button underneath, with no
  // indication anything had happened.
  useEffect(() => {
    if (activeSection) {
      panelRef.current?.focus();
      return;
    }
    const trigger = lastTriggerRef.current;
    lastTriggerRef.current = null;
    if (!trigger) return;
    // Restore focus only when it would otherwise be lost: either it has already
    // fallen back to the body, or it is still inside the panel, which stays
    // mounted while its exit animation runs. If the user has clicked or tabbed
    // somewhere else in the meantime, leave them there — yanking them back is
    // worse than not restoring at all.
    const active = document.activeElement;
    const stranded =
      active === document.body ||
      active === null ||
      (active instanceof Node && panelRef.current?.contains(active) === true);
    if (stranded) trigger.focus();
  }, [activeSection]);

  useLayoutEffect(() => {
    if (!activeSection || focusMode) return;

    const workspace = workspaceRef.current;
    const panel = panelRef.current;
    if (!workspace || !panel) return;

    const update = () => {
      if (window.innerWidth < 1024) {
        setConnector(null);
        return;
      }

      // Both the mobile and desktop Canvas are mounted at once and hidden with
      // responsive CSS. Querying the first match anchors to the hidden mobile
      // copy on desktop, which is what caused the connector to originate near
      // the top of the page. Pick the control that actually has layout.
      const selected = Array.from(
        workspace.querySelectorAll<HTMLElement>(
          `[data-canvas-section="${activeSection}"]`,
        ),
      ).find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      });
      if (!selected) {
        setConnector(null);
        return;
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const startX = selectedRect.right - workspaceRect.left;
      const startY = selectedRect.top + selectedRect.height / 2 - workspaceRect.top;
      const endX = panelRect.left - workspaceRect.left + 2;
      const minEndY = panelRect.top - workspaceRect.top + 84;
      const maxEndY = panelRect.bottom - workspaceRect.top - 84;
      const endY = Math.min(Math.max(startY, minEndY), maxEndY);
      const midX = startX + (endX - startX) * 0.52;
      const height = Math.max(workspaceRect.height, panelRect.bottom - workspaceRect.top);

      setConnector({
        path: `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`,
        startX,
        startY,
        width: workspaceRect.width,
        height,
      });
    };

    // Grid columns and the panel both animate on open. Track their real
    // bounding boxes only while that transition is in flight, then let the
    // observers below handle any later responsive/content changes.
    let animationFrame = 0;
    const startedAt = performance.now();
    const trackOpeningLayout = (now: number) => {
      update();
      if (now - startedAt < 650) {
        animationFrame = window.requestAnimationFrame(trackOpeningLayout);
      }
    };
    animationFrame = window.requestAnimationFrame(trackOpeningLayout);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(workspace);
    observer?.observe(panel);
    window.addEventListener('resize', update);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [activeSection, focusMode, activeTab]);

  const panelInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: 36, scale: 0.985 };
  const panelExit = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: 24, scale: 0.99 };
  const panelTransition = reduceMotion
    ? { duration: 0.12 }
    : { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.82 };

  return (
    <section className="flex flex-col gap-gb-lg">
      <div
        ref={workspaceRef}
        className={[
          'relative grid items-start transition-[grid-template-columns,gap] duration-500',
          activeSection
            ? focusMode
              ? 'lg:grid-cols-[0_minmax(0,1fr)] lg:gap-0'
              : 'lg:grid-cols-[minmax(0,0.98fr)_minmax(34rem,1.02fr)] lg:gap-gb-xl'
            : 'lg:grid-cols-1',
        ].join(' ')}
      >
        <div
          className={[
            'min-w-0 transition duration-300',
            focusMode ? 'pointer-events-none opacity-10 blur-[2px]' : '',
          ].join(' ')}
        >
          <PersonalCanvasView
            report={report}
            activeSection={activeSection}
            onSelect={openSection}
          />
          <p className="mt-gb-md text-center text-gb-xs text-fg-muted print:hidden">
            Keyboard: 1–6 opens a section · Esc closes · F toggles focus
          </p>
        </div>

        <AnimatePresence initial={false}>
          {activeSection && activeSpec ? (
            <motion.aside
              key="personal-canvas-detail-panel"
              ref={panelRef}
              // -1 so it can receive programmatic focus without entering the
              // tab order. No aria-modal: on desktop this is a sticky side
              // panel beside live content, not a modal, and claiming otherwise
              // would tell a screen reader the rest of the page is inert.
              tabIndex={-1}
              aria-label={`${activeSpec.label} details`}
              initial={panelInitial}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={panelExit}
              transition={panelTransition}
              className={[
                'fixed inset-x-3 bottom-3 top-20 z-[80] flex min-h-0 flex-col overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-2xl',
                'lg:sticky lg:top-24 lg:z-20 lg:max-h-[calc(100vh-7rem)]',
              ].join(' ')}
            >
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
                      onClick={() => {
                        setFocusMode((current) => !current);
                        sounds.tab();
                      }}
                      aria-pressed={focusMode}
                      aria-label={focusMode ? 'Exit focus mode' : 'Focus this section'}
                      title={focusMode ? 'Exit focus mode' : 'Focus this section'}
                      className="hidden h-10 w-10 place-items-center rounded-gb-lg border border-line bg-surface text-fg-tertiary shadow-sm transition hover:border-brand/30 hover:bg-brand/5 hover:text-fg-brand lg:grid"
                    >
                      <FocusModeIcon focused={focusMode} />
                    </button>
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
                <PersonalReportInlineUpdateProvider onAnswered={onAnswered}>
                  {tab?.content}
                </PersonalReportInlineUpdateProvider>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {connector && activeSection && !focusMode ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-10 hidden overflow-visible text-fg-brand lg:block"
            width={connector.width}
            height={connector.height}
            viewBox={`0 0 ${connector.width} ${connector.height}`}
          >
            <motion.path
              key={activeSection}
              d={connector.path}
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="8 8"
              className="drop-shadow-sm"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
            />
            <circle
              cx={connector.startX}
              cy={connector.startY}
              r="7"
              fill="white"
              stroke="currentColor"
              strokeWidth="4"
            />
          </svg>
        ) : null}
      </div>
    </section>
  );
}
