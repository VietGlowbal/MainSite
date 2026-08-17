'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Synthesized UI sound effects for the Strategy Hub — ported from the
 * approved prototype's Web Audio design (oscillator + gain envelope, no
 * audio files). Defaults to on, per the owner's call to ship the prototype's
 * always-on sound design rather than muting it by default.
 *
 * The `AudioContext` is created lazily on first play, never on mount: browsers
 * block autoplaying/uninitialized contexts until a real user gesture, and a
 * marketing page loads long before any click happens.
 */
export function useStrategyHubSound() {
  const [enabled, setEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtor();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => undefined);
    }
    return audioCtxRef.current;
  }, []);

  const tone = useCallback(
    (
      notes: readonly { freq: number; delay: number }[],
      { type, gain, duration }: { type: OscillatorType; gain: number; duration: number },
      isEnabled: boolean,
    ) => {
      if (!isEnabled) return;
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const { freq, delay } of notes) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gainNode.gain.value = gain;
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + duration);
      }
    },
    [getContext],
  );

  const sweep = useCallback(
    (
      { from, to, gain, duration }: { from: number; to: number; gain: number; duration: number },
      isEnabled: boolean,
    ) => {
      if (!isEnabled) return;
      const ctx = getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(to, now + duration);
      gainNode.gain.value = gain;
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    },
    [getContext],
  );

  // Closing a panel / dismissing something.
  const playPop = useCallback(
    () => sweep({ from: 600, to: 200, gain: 0.2, duration: 0.08 }, enabled),
    [sweep, enabled],
  );
  // Opening a panel / selecting a card.
  const playBubble = useCallback(
    () => sweep({ from: 300, to: 900, gain: 0.15, duration: 0.12 }, enabled),
    [sweep, enabled],
  );
  // Starting the tour / re-enabling sound.
  const playChime = useCallback(
    () =>
      tone(
        [
          { freq: 523.25, delay: 0 },
          { freq: 659.25, delay: 0.06 },
          { freq: 783.99, delay: 0.12 },
          { freq: 1046.5, delay: 0.18 },
        ],
        { type: 'sine', gain: 0.15, duration: 0.3 },
        enabled,
      ),
    [tone, enabled],
  );
  // A stronger flourish for the biggest CTAs.
  const playFanfare = useCallback(
    () =>
      tone(
        [
          { freq: 523.25, delay: 0 },
          { freq: 659.25, delay: 0.08 },
          { freq: 783.99, delay: 0.16 },
          { freq: 987.77, delay: 0.24 },
          { freq: 1046.5, delay: 0.32 },
        ],
        { type: 'triangle', gain: 0.2, duration: 0.4 },
        enabled,
      ),
    [tone, enabled],
  );

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      if (next) {
        // Re-enabling plays a confirmation chime, same as the prototype —
        // but it must read the NEW value directly since `enabled` above is
        // still the pre-toggle closure value on this render.
        const ctx = getContext();
        if (ctx) {
          tone(
            [
              { freq: 523.25, delay: 0 },
              { freq: 659.25, delay: 0.06 },
              { freq: 783.99, delay: 0.12 },
              { freq: 1046.5, delay: 0.18 },
            ],
            { type: 'sine', gain: 0.15, duration: 0.3 },
            true,
          );
        }
      }
      return next;
    });
  }, [getContext, tone]);

  return { enabled, toggle, playPop, playBubble, playChime, playFanfare };
}
