'use client';

import { useState } from 'react';
import { T } from '@/lib/i18n';

export type StrategyVideoPlaceholderProps = {
  readonly src?: string | undefined;
  readonly poster?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly fileName?: string | undefined;
  readonly duration?: string | undefined;
  readonly badge?: string | undefined;
  readonly aspectRatio?: '16:9' | '16:10' | 'auto';
  readonly className?: string | undefined;
  readonly onPlayClick?: (() => void) | undefined;
};

/**
 * StrategyVideoPlaceholder
 *
 * A reusable, responsive video container and demo placeholder tailored for the
 * Glowbal AI Strategy experience.
 *
 * - When `src` is provided: Plays the real HTML5 video with controls.
 * - When `src` is null/empty: Renders a sleek, branded interactive video player
 *   mockup with a prominent Rose play disc, duration tag, video title, simulated
 *   control bar, and an explicit file slot code tag (e.g. `public/videos/intro.mp4`)
 *   making it obvious where content creators or developers can add video clips.
 */
export function StrategyVideoPlaceholder({
  src,
  poster,
  title,
  subtitle,
  fileName = 'ai-strategy-demo.mp4',
  duration = '2:15',
  badge = 'Live Preview',
  aspectRatio = '16:9',
  className = '',
  onPlayClick,
}: StrategyVideoPlaceholderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const handlePlay = () => {
    if (src) {
      setIsPlaying(true);
    } else {
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3500);
    }
    onPlayClick?.();
  };

  const ratioClass =
    aspectRatio === '16:9'
      ? 'aspect-video'
      : aspectRatio === '16:10'
        ? 'aspect-[16/10]'
        : 'aspect-auto min-h-[300px]';

  return (
    <div
      className={`group relative w-full overflow-hidden rounded-gb-2xl border border-line/80 bg-surface-inverse-strong text-fg-on-inverse shadow-gb-xl ${ratioClass} ${className}`}
    >
      {/* Background radial glow effect */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-full bg-[radial-gradient(circle_at_center,_var(--color-gb-brand-600)_0%,_transparent_70%)] opacity-15 transition-opacity duration-500 group-hover:opacity-25"
      />

      {/* Simulated subtle grid lines */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"
      />

      {isPlaying && src ? (
        <video
          className="size-full object-contain"
          src={src}
          poster={poster}
          controls
          autoPlay
          playsInline
        />
      ) : (
        <div className="relative flex size-full flex-col justify-between p-gb-xl md:p-gb-2xl">
          {/* Top chrome bar */}
          <div className="flex items-center justify-between gap-gb-md z-10">
            <div className="inline-flex items-center gap-gb-sm rounded-gb-full border border-white/15 bg-white/10 px-gb-md py-gb-xxs backdrop-blur-md">
              <span className="size-2 rounded-gb-full bg-brand animate-pulse" />
              <span className="text-gb-xs font-semibold uppercase tracking-wider text-fg-on-inverse">
                <T k={badge} />
              </span>
              <span className="text-gb-xs text-white/40">|</span>
              <span className="text-gb-xs font-medium text-fg-on-inverse-secondary">1080p HD</span>
            </div>

            {duration ? (
              <span className="rounded-gb-md border border-white/10 bg-white/10 px-gb-sm py-gb-xxs font-mono text-gb-xs text-fg-on-inverse-secondary backdrop-blur-md">
                {duration}
              </span>
            ) : null}
          </div>

          {/* Center: Large Play Disc & Title & Slot tag */}
          <div className="flex flex-col items-center justify-center gap-gb-md text-center z-10 my-auto">
            <button
              type="button"
              onClick={handlePlay}
              aria-label={`Play ${title}`}
              className="relative flex size-14 md:size-20 items-center justify-center rounded-gb-full bg-brand text-white shadow-gb-lg transition-transform duration-300 hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              {/* Play triangle */}
              <svg
                className="ml-1 size-6 md:size-8 fill-current"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-gb-xs max-w-lg">
              <h4 className="font-display text-gb-lg md:text-gb-xl font-semibold text-fg-on-inverse">
                <T k={title} />
              </h4>
              {subtitle ? (
                <p className="text-gb-xs md:text-gb-sm text-fg-on-inverse-muted line-clamp-2">
                  <T k={subtitle} />
                </p>
              ) : null}
            </div>

            {/* Explicit file path hint badge so editors know where to add the clip */}
            <div className="mt-gb-xs flex items-center gap-gb-xs">
              <span className="text-gb-xs text-fg-on-inverse-muted">
                <T k="Video file slot" />:
              </span>
              <code className="rounded-gb-sm border border-white/15 bg-white/10 px-gb-md py-gb-xxs font-mono text-gb-xs text-fg-on-inverse-secondary">
                {fileName}
              </code>
            </div>
          </div>

          {/* Notification when clicking placeholder with no src */}
          {showNotification ? (
            <div
              role="status"
              className="absolute inset-x-gb-xl bottom-16 z-20 mx-auto max-w-md rounded-gb-lg border border-brand/50 bg-surface-inverse px-gb-lg py-gb-md text-center text-gb-xs text-fg-on-inverse shadow-gb-xl backdrop-blur animate-in fade-in slide-in-from-bottom-2"
            >
              <span className="font-semibold text-brand"><T k="Demo clip placeholder" />: </span>
              <T k="Replace with video file or URL in" /> <span className="font-mono text-fg-brand">{fileName}</span>
            </div>
          ) : null}

          {/* Bottom simulated media player scrubber & controls */}
          <div className="flex flex-col gap-gb-xs z-10">
            {/* Scrubber bar */}
            <div className="relative h-1.5 w-full overflow-hidden rounded-gb-full bg-white/20">
              <div className="h-full w-1/3 rounded-gb-full bg-brand transition-all duration-300 group-hover:w-2/5" />
            </div>

            <div className="flex items-center justify-between text-gb-xs text-fg-on-inverse-muted pt-gb-xs">
              <div className="flex items-center gap-gb-md">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="hover:text-fg-on-inverse transition-colors"
                  aria-label="Play or pause preview"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <span className="font-mono">0:00 / {duration}</span>
              </div>

              <div className="flex items-center gap-gb-md">
                <span className="hover:text-fg-on-inverse transition-colors cursor-pointer" title="Audio">
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                  </svg>
                </span>
                <span className="rounded border border-white/20 px-1 py-0.5 text-[10px] font-semibold">
                  CC
                </span>
                <span className="hover:text-fg-on-inverse transition-colors cursor-pointer" title="Fullscreen">
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
