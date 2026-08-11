'use client';

import Image from 'next/image';
import { useState } from 'react';

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
};

/**
 * Click-to-load media boundary. Until the visitor asks to play, the page ships
 * only an optimized poster and no video sources, keeping Home's initial payload
 * independent of the demo recording sizes.
 */
export function HomeDemoVideo({ title, video }: { title: string; video: FeatureDemoVideo }) {
  const [activated, setActivated] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-gb-xl bg-surface-inverse-strong px-gb-3xl text-center text-white">
        <p className="text-gb-md font-semibold">The demo video could not be loaded.</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setActivated(false);
          }}
          className="rounded-gb-md border border-white/20 bg-white/10 px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Try again
        </button>
      </div>
    );
  }

  if (activated) {
    return (
      <video
        className="size-full bg-surface-inverse-strong object-contain"
        aria-label={`${title} demo video`}
        autoPlay
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
        Your browser does not support video playback.
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Play ${title} demo video`}
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
      ) : (
        <>
          <div className="absolute inset-0 bg-surface-inverse-strong" />
          <div className="absolute left-[15%] top-[5%] size-[45%] rounded-gb-full bg-brand/30 blur-3xl" />
        </>
      )}
      <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-gb-lg">
        <span className="flex size-[72px] items-center justify-center rounded-gb-full border border-white/25 bg-white/15 shadow-gb-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
          <span
            aria-hidden="true"
            className="ml-gb-xs h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white"
          />
        </span>
        <span className="text-gb-md font-semibold">Play demo</span>
      </span>
    </button>
  );
}
