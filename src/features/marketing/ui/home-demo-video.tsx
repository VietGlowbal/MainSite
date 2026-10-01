'use client';

import Image from 'next/image';
import { useState } from 'react';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';

export type FeatureDemoSource = {
  readonly src: string;
  readonly type: 'video/webm' | 'video/mp4';
};

export type FeatureDemoVideo = {
  /** WebM first when available; MP4 is the broad-compatibility fallback. */
  readonly sources: readonly FeatureDemoSource[];
  /** Prefer a compressed 16:10 WebP around 1280px wide. */
  readonly poster?: string;
  readonly captionsSrc?: string;
  readonly captionsLabel?: string;
  /** Shown in the poster's corner, e.g. "1:24". Omitted when unknown — never a placeholder. */
  readonly duration?: string;
};

/**
 * Click-to-load media boundary. Until the visitor asks to play, the page ships
 * only an optimized poster and no video sources, keeping Home's initial payload
 * independent of the demo recording sizes.
 *
 * Poster per the sales-journey handoff §7: a dark overlay, a 64px rose play
 * disc with a soft ring, a "Live preview" chip and the duration. It never
 * autoplays on load; pressing play starts it MUTED (the handoff's rule — sound
 * on a marketing page is something the visitor turns on, not off).
 */
export function HomeDemoVideo({
  title,
  video,
  locale = 'en',
}: {
  title: string;
  video: FeatureDemoVideo;
  locale?: Locale;
}) {
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-gb-xl bg-surface-inverse-strong px-gb-3xl text-center text-white">
        <p className="text-gb-md font-semibold">{getLocaleText(locale, 'The demo video could not be loaded.')}</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setActivated(false);
          }}
          className="rounded-gb-md border border-white/20 bg-white/10 px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {getLocaleText(locale, 'Try again')}
        </button>
      </div>
    );
  }

  if (activated) {
    return (
      <video
        className="size-full bg-surface-inverse-strong object-contain"
        aria-label={getLocaleText(locale, '{title} demo video', { title })}
        autoPlay
        muted
        controls
        playsInline
        preload="metadata"
        poster={video.poster}
        onError={() => setFailed(true)}
      >
        {video.sources.map((source) => (
          <source key={source.src} src={source.src} type={source.type} />
        ))}
        {video.captionsSrc ? (
          <track
            default
            kind="captions"
            src={video.captionsSrc}
            srcLang="en"
            label={video.captionsLabel ?? 'English'}
          />
        ) : null}
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={getLocaleText(locale, 'Play {title} demo video', { title })}
      className="group relative size-full overflow-hidden bg-surface-inverse-strong text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand"
    >
      {video.poster ? (
        <Image
          src={video.poster}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
      ) : null}
      <span className="absolute inset-0 bg-gb-neutral-990/55" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-gb-7xl items-center justify-center rounded-gb-full bg-brand shadow-[0_0_0_8px_color-mix(in_srgb,var(--color-brand)_25%,transparent)] transition-colors group-hover:bg-brand-hover">
          <span
            aria-hidden="true"
            className="ml-gb-xs h-0 w-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white"
          />
        </span>
      </span>
      <span className="absolute bottom-gb-xl left-gb-xl inline-flex items-center gap-gb-sm rounded-gb-full bg-surface px-gb-md py-gb-xs text-gb-xs font-semibold text-fg">
        <span aria-hidden="true" className="size-gb-sm rounded-gb-full bg-brand" />
        {getLocaleText(locale, 'Live preview')}
      </span>
      {video.duration ? (
        <span className="absolute bottom-gb-xl right-gb-xl rounded-gb-sm bg-black/70 px-gb-md py-gb-xxs font-mono text-gb-xs text-white">
          {video.duration}
        </span>
      ) : null}
    </button>
  );
}
