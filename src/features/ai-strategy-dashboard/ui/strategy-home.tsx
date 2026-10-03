'use client';

import { useState } from 'react';
import { Button, Panel, Section, Badge, GlowbalIcon, KitIcon, ICONS, type GlowbalIconName } from '@/shared/ui';
import { T } from '@/lib/i18n';
import { StrategyVideoPlaceholder } from './strategy-video-placeholder';

export type StrategyHomeVideos = {
  readonly overviewVideoSrc?: string | undefined;
  readonly overviewPoster?: string | undefined;
  readonly featureVideos?: Partial<Record<string, { src?: string; poster?: string }>> | undefined;
};

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Review your profile',
    desc: 'Confirm your academics, activities, and target aspirations.',
  },
  {
    step: 2,
    title: 'Add achievements',
    desc: 'Include test scores, awards, leadership, and portfolio highlights.',
  },
  {
    step: 3,
    title: 'AI analyses your application',
    desc: 'Generates your in-depth Applicant Personal Analysis.',
  },
  {
    step: 4,
    title: 'AI compares you against your course',
    desc: 'Measures your fit against official university entry standards.',
  },
  {
    step: 5,
    title: 'Receive a live improvement roadmap',
    desc: 'Get prioritized tasks, AI coaching, and deadline tracking.',
  },
] as const;

type FeatureKey = 'portrait' | 'matching' | 'roadmap' | 'coach' | 'assets';

type FeatureItem = {
  readonly key: FeatureKey;
  readonly icon: GlowbalIconName;
  readonly badge: string;
  readonly title: string;
  readonly summary: string;
  readonly checks: readonly string[];
  readonly videoFile: string;
  readonly duration: string;
};

const FEATURES: readonly [FeatureItem, ...FeatureItem[]] = [
  {
    key: 'portrait',
    icon: 'personalReport',
    badge: 'Step 1 • Profile',
    title: 'Applicant Profile & Portrait',
    summary:
      'Comprehensive evaluation of your academic records, extracurriculars, personality, and competitive edge.',
    checks: [
      'Core identity & learning profile analysis',
      'Verified strengths across academic & personal experiences',
      'Identifies unique narrative themes for your application',
    ],
    videoFile: 'feature-1-portrait-demo.mp4',
    duration: '1:45',
  },
  {
    key: 'matching',
    icon: 'matchingReport',
    badge: 'Step 2 • Fit Score',
    title: 'Course Match & Fit Analysis',
    summary:
      'Compares your profile across 5 pillars against specific admission criteria of your dream university course.',
    checks: [
      '5-pillar compatibility score (Academic, Tests, Leadership, Motivation, Fit)',
      'Reach, Recommend, Safe admission tiering',
      'Pinpoints critical admission gaps before you apply',
    ],
    videoFile: 'feature-2-course-match.mp4',
    duration: '2:10',
  },
  {
    key: 'roadmap',
    icon: 'strategyMaster',
    badge: 'Step 3 • Action Plan',
    title: 'Personalised Action Roadmap',
    summary:
      'High-impact recommendations prioritized by urgency, effort, and value to close your admission gaps.',
    checks: [
      'Smart prioritized task queue with real deadlines',
      'Target categories: Tests, Academics, Essay, Extracurriculars',
      'High Impact vs Low Effort scoring to maximize results',
    ],
    videoFile: 'feature-3-action-roadmap.mp4',
    duration: '2:30',
  },
  {
    key: 'coach',
    icon: 'aiInsight',
    badge: 'Step 4 • Guidance',
    title: 'Interactive 24/7 AI Coach',
    summary:
      'Step-by-step guidance on every task, with instant re-analysis whenever you submit new achievements or evidence.',
    checks: [
      'Threaded AI coaching for every individual recommendation',
      'Upload evidence & documents for instant feedback',
      'Live re-analysis keeps your strategy current as you grow',
    ],
    videoFile: 'feature-4-ai-coach.mp4',
    duration: '1:55',
  },
  {
    key: 'assets',
    icon: 'essaySupport',
    badge: 'Step 5 • Documents',
    title: 'Application Assets & Essays',
    summary:
      'Targeted CV builder and structured statement outlines aligned with university admission committees.',
    checks: [
      'Target-profile CV builder tailored for international admissions',
      'Evidence-based Statement of Purpose (SOP) scaffolding',
      'Direct alignment with official course expectations',
    ],
    videoFile: 'feature-5-application-assets.mp4',
    duration: '2:05',
  },
];

const BENEFITS = [
  {
    title: 'Personalised',
    body: 'Every recommendation is unique.',
    icon: 'targetProfile' as const,
  },
  {
    title: 'AI Powered',
    body: 'Analyses hundreds of factors instantly.',
    icon: 'aiInsight' as const,
  },
  {
    title: 'Continuously Updated',
    body: 'Improve something? Ask for a re-analysis and your strategy catches up.',
    icon: 'progressUpdate' as const,
  },
  {
    title: 'Course Specific',
    body: 'Every recommendation is based on your chosen university course.',
    icon: 'universities' as const,
  },
] as const;

/** Placeholder — not real student quotes. Preserved for specs & screenshot tests. */
const TESTIMONIALS = [
  {
    quote: 'I had no idea what universities actually wanted.',
    attribution: 'Sample testimonial',
    tag: 'Accepted Imperial College London',
  },
  {
    quote: 'The strategy showed me weaknesses I never considered.',
    attribution: 'Sample testimonial',
    tag: 'Accepted University of Melbourne',
  },
  {
    quote: 'It made the application process much less stressful.',
    attribution: 'Sample testimonial',
    tag: 'Accepted NUS Singapore',
  },
] as const;

export function StrategyHome({
  courseName,
  universityName,
  startHref,
  videos,
}: {
  courseName: string;
  universityName: string;
  startHref: string;
  videos?: StrategyHomeVideos | undefined;
}) {
  const [activeTab, setActiveTab] = useState<FeatureKey>('portrait');
  const currentFeature = FEATURES.find((f) => f.key === activeTab) ?? FEATURES[0];

  const handleScrollToOverviewVideo = () => {
    const el = document.getElementById('ai-strategy-video-overview');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div data-no-auto-translate className="flex flex-col gap-gb-7xl">
      {/* ─────────────────── 1. HERO SECTION ─────────────────── */}
      <Section
        padded={false}
        className="pt-gb-6xl pb-gb-4xl"
        containerClassName="flex flex-col items-center gap-gb-2xl text-center"
      >
        {/* Course & University Pill */}
        <div className="inline-flex items-center gap-gb-sm rounded-gb-full border border-border-subtle bg-brand-subtle/70 px-gb-lg py-gb-xs text-gb-sm font-semibold text-fg-brand shadow-gb-xs">
          <GlowbalIcon name="planGlobalEducation" size={16} tone="current" />
          <span>
            {courseName} · {universityName}
          </span>
        </div>

        {/* Main Title */}
        <h1 className="max-w-gb-width-xl font-display text-gb-display-sm md:text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
          <T k="Build your personalised roadmap into university." />
        </h1>

        {/* Subtitle */}
        <p className="max-w-gb-width-xl text-gb-lg md:text-gb-xl text-fg-tertiary leading-relaxed">
          <T k="Our AI analyses your profile, compares you against your chosen university course, and creates a personalised action plan that updates as you improve." />
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-gb-md pt-gb-sm">
          <Button href={startHref} size="lg" className="min-w-64 shadow-gb-sm">
            <T k="Start My Strategy" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleScrollToOverviewVideo}
            className="min-w-52"
          >
            <KitIcon art={ICONS.zapFast} frame={18} className="text-fg-brand" />
            <T k="Watch Walkthrough" />
          </Button>
        </div>

        {/* Value Trust Markers */}
        <div className="flex flex-wrap items-center justify-center gap-x-gb-2xl gap-y-gb-sm pt-gb-md text-gb-xs font-medium text-fg-tertiary">
          <span className="flex items-center gap-gb-xs">
            <KitIcon art={ICONS.checkCircle} frame={16} className="text-fg-brand" />
            <T k="500+ University Standards" />
          </span>
          <span className="flex items-center gap-gb-xs">
            <KitIcon art={ICONS.checkCircle} frame={16} className="text-fg-brand" />
            <T k="5-Pillar Fit Scoring" />
          </span>
          <span className="flex items-center gap-gb-xs">
            <KitIcon art={ICONS.checkCircle} frame={16} className="text-fg-brand" />
            <T k="Real-Time Strategy Updates" />
          </span>
        </div>
      </Section>

      {/* ─────────────────── 2. HERO VIDEO OVERVIEW PLACEHOLDER ─────────────────── */}
      <div id="ai-strategy-video-overview" className="w-full max-w-5xl mx-auto px-gb-md">
        <StrategyVideoPlaceholder
          src={videos?.overviewVideoSrc}
          poster={videos?.overviewPoster}
          title="AI Strategy Overview Video"
          subtitle="Watch a 2-minute walkthrough to see how AI Strategy turns your target into an actionable plan."
          fileName="public/videos/ai-strategy-overview.mp4"
          duration="2:30"
          badge="Live Preview"
          aspectRatio="16:9"
        />
      </div>

      {/* ─────────────────── 3. HOW IT WORKS ─────────────────── */}
      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <div className="flex flex-col gap-gb-xs">
          <h2 className="font-display text-gb-display-sm font-semibold text-fg">
            <T k="How it works" />
          </h2>
          <p className="text-gb-md text-fg-tertiary">
            <T k="A clear 5-stage process designed to turn your university ambitions into an accepted offer." />
          </p>
        </div>

        <div className="grid gap-gb-lg sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((item) => (
            <Panel
              key={item.step}
              className="flex flex-col justify-between gap-gb-lg border-border-subtle bg-surface hover:border-brand/40 transition-colors"
            >
              <div className="flex flex-col gap-gb-md">
                <div className="flex items-center justify-between">
                  <span className="flex size-[40px] items-center justify-center rounded-gb-full bg-brand-subtle text-gb-md font-bold text-fg-brand">
                    {item.step}
                  </span>
                  <span className="text-gb-xs font-semibold text-fg-tertiary uppercase tracking-wider">
                    <T k={`Step ${item.step}`} />
                  </span>
                </div>
                <h3 className="text-gb-md font-semibold text-fg leading-snug">
                  <T k={item.title} />
                </h3>
              </div>
              <p className="text-gb-xs text-fg-tertiary leading-relaxed">
                <T k={item.desc} />
              </p>
            </Panel>
          ))}
        </div>
      </Section>

      {/* ─────────────────── 4. CORE FEATURES SHOWCASE & VIDEO SLOTS ─────────────────── */}
      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <div className="flex flex-col gap-gb-xs">
          <div className="flex items-center gap-gb-sm">
            <Badge variant="brand-subtle">
              <T k="Key capabilities" />
            </Badge>
          </div>
          <h2 className="font-display text-gb-display-sm font-semibold text-fg">
            <T k="Core Features of AI Strategy" />
          </h2>
          <p className="max-w-2xl text-gb-md text-fg-tertiary">
            <T k="Explore how AI Strategy guides your journey from profile assessment to university admission." />
          </p>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="flex overflow-x-auto gap-gb-sm pb-gb-xs border-b border-border-subtle">
          {FEATURES.map((feature) => {
            const isActive = feature.key === activeTab;
            return (
              <button
                key={feature.key}
                type="button"
                onClick={() => setActiveTab(feature.key)}
                className={`inline-flex items-center gap-gb-sm whitespace-nowrap rounded-gb-lg px-gb-lg py-gb-md text-gb-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-brand text-white shadow-gb-xs'
                    : 'bg-surface-muted text-fg-secondary hover:bg-surface-subtle hover:text-fg'
                }`}
              >
                <GlowbalIcon
                  name={feature.icon}
                  size={20}
                  tone={isActive ? 'current' : 'two-tone'}
                />
                <T k={feature.title} />
              </button>
            );
          })}
        </div>

        {/* Active Feature Display Card */}
        <Panel className="border-border-subtle bg-surface shadow-gb-sm p-gb-2xl lg:p-gb-4xl">
          <div className="grid gap-gb-4xl lg:grid-cols-12 lg:items-center">
            {/* Left Content Column */}
            <div className="flex flex-col gap-gb-xl lg:col-span-5">
              <div className="flex flex-col gap-gb-sm">
                <div className="flex items-center gap-gb-sm">
                  <span className="flex size-10 items-center justify-center rounded-gb-lg bg-brand-surface">
                    <GlowbalIcon name={currentFeature.icon} size={24} />
                  </span>
                  <Badge variant="brand-chip">
                    <T k={currentFeature.badge} />
                  </Badge>
                </div>

                <h3 className="font-display text-gb-display-xs font-semibold text-fg">
                  <T k={currentFeature.title} />
                </h3>

                <p className="text-gb-md text-fg-secondary leading-relaxed">
                  <T k={currentFeature.summary} />
                </p>
              </div>

              {/* Checklist */}
              <ul className="flex flex-col gap-gb-md">
                {currentFeature.checks.map((check) => (
                  <li key={check} className="flex items-start gap-gb-md">
                    <KitIcon
                      art={ICONS.checkCircle}
                      frame={18}
                      className="mt-gb-xxs shrink-0 text-fg-brand"
                    />
                    <span className="text-gb-sm font-medium text-fg">
                      <T k={check} />
                    </span>
                  </li>
                ))}
              </ul>

              {/* Hint badge */}
              <div className="rounded-gb-lg border border-border-subtle bg-surface-muted p-gb-md text-gb-xs text-fg-tertiary">
                <span className="font-semibold text-fg"><T k="Demo clip placeholder" />: </span>
                <T k="Replace with video file or URL in" />{' '}
                <code className="rounded bg-surface px-gb-xs py-0.5 font-mono text-fg-brand">
                  public/videos/{currentFeature.videoFile}
                </code>
              </div>
            </div>

            {/* Right Video Placeholder Slot */}
            <div className="lg:col-span-7">
              <StrategyVideoPlaceholder
                src={videos?.featureVideos?.[currentFeature.key]?.src}
                poster={videos?.featureVideos?.[currentFeature.key]?.poster}
                title={currentFeature.title}
                subtitle={currentFeature.summary}
                fileName={`public/videos/${currentFeature.videoFile}`}
                duration={currentFeature.duration}
                badge={currentFeature.badge}
                aspectRatio="16:10"
              />
            </div>
          </div>
        </Panel>
      </Section>

      {/* ─────────────────── 5. CORE VALUE PILLARS / BENEFITS ─────────────────── */}
      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <div className="grid gap-gb-3xl sm:grid-cols-2 xl:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <Panel
              key={benefit.title}
              className="flex flex-col gap-gb-md border-border-subtle bg-surface hover:shadow-gb-sm transition-all"
            >
              <div className="flex size-10 items-center justify-center rounded-gb-lg bg-brand-surface">
                <GlowbalIcon name={benefit.icon} size={20} />
              </div>
              <div>
                <p className="text-gb-lg font-semibold text-fg">
                  <T k={benefit.title} />
                </p>
                <p className="mt-gb-xs text-gb-sm text-fg-tertiary leading-relaxed">
                  <T k={benefit.body} />
                </p>
              </div>
            </Panel>
          ))}
        </div>
      </Section>

      {/* ─────────────────── 6. VIDEO WALKTHROUGHS & GUIDES GALLERY ─────────────────── */}
      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <div className="flex flex-col gap-gb-xs">
          <h2 className="font-display text-gb-display-sm font-semibold text-fg">
            <T k="Video Walkthroughs & Guides" />
          </h2>
          <p className="text-gb-md text-fg-tertiary">
            <T k="Short video walkthroughs explaining each step of your application journey." />
          </p>
        </div>

        <div className="grid gap-gb-2xl md:grid-cols-3">
          <div className="flex flex-col gap-gb-md">
            <StrategyVideoPlaceholder
              title="Overview Walkthrough"
              fileName="public/videos/overview-walkthrough.mp4"
              duration="2:30"
              badge="Overview"
              aspectRatio="16:9"
            />
            <div>
              <h4 className="font-semibold text-gb-md text-fg">
                <T k="Overview Walkthrough" />
              </h4>
              <p className="text-gb-xs text-fg-tertiary mt-gb-xxs">
                <T k="Watch a 2-minute walkthrough to see how AI Strategy turns your target into an actionable plan." />
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-gb-md">
            <StrategyVideoPlaceholder
              title="Match Analysis Guide"
              fileName="public/videos/match-analysis-guide.mp4"
              duration="2:10"
              badge="Analysis"
              aspectRatio="16:9"
            />
            <div>
              <h4 className="font-semibold text-gb-md text-fg">
                <T k="Match Analysis Guide" />
              </h4>
              <p className="text-gb-xs text-fg-tertiary mt-gb-xxs">
                <T k="Compares your profile across 5 pillars against specific admission criteria of your dream university course." />
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-gb-md">
            <StrategyVideoPlaceholder
              title="Roadmap Execution"
              fileName="public/videos/roadmap-execution.mp4"
              duration="2:45"
              badge="Execution"
              aspectRatio="16:9"
            />
            <div>
              <h4 className="font-semibold text-gb-md text-fg">
                <T k="Roadmap Execution" />
              </h4>
              <p className="text-gb-xs text-fg-tertiary mt-gb-xxs">
                <T k="High-impact recommendations prioritized by urgency, effort, and value to close your admission gaps." />
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ─────────────────── 7. WHAT STUDENTS SAY ─────────────────── */}
      <Section padded={false} containerClassName="flex flex-col gap-gb-3xl">
        <h2 className="font-display text-gb-display-sm font-semibold text-fg">
          <T k="What students say" />
        </h2>
        <div className="grid gap-gb-3xl sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Panel
              key={t.quote}
              className="flex flex-col justify-between gap-gb-lg border-border-subtle bg-surface"
            >
              <div className="flex flex-col gap-gb-md">
                {/* 5 Stars */}
                <div className="flex items-center gap-1 text-fg-brand">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-gb-sm">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-gb-md text-fg leading-relaxed">
                  “<T k={t.quote} />”
                </p>
              </div>

              <div className="border-t border-border-subtle pt-gb-md flex items-center justify-between">
                <span className="text-gb-sm font-medium text-fg-secondary">
                  <T k={t.attribution} />
                </span>
                <span className="text-gb-xs text-fg-brand font-medium">
                  {t.tag}
                </span>
              </div>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  );
}
