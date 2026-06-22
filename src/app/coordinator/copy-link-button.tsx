'use client';

import { useState } from 'react';

/**
 * Copy-to-clipboard button for the coordinator's share link.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (e.g. insecure context) — user can still select the text.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="glow-button-secondary shrink-0 text-xs px-4 py-2"
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}
