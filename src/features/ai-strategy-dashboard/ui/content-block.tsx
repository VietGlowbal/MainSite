'use client';

import type { ContentBlock, ContentBlockValue } from '@/lib/match-insights';
import { CONTENT_BLOCK_TYPES } from '@/lib/match-insights';
import { BLOCK_INPUT_REGISTRY, FallbackBlock } from './content-blocks/registry';

/**
 * Content Block — the genUI body of a recommendation's detail page. One of
 * four fixed shapes, chosen by the AI at generation time (see `ContentBlock`
 * in `@/lib/match-insights`): a repeatable table, a single long-form answer,
 * a checklist of steps, or a single-select decision. `null` means the task is
 * completed in another tool instead.
 *
 * THIS IS A DISPATCHER (§6.4). Each shape's input lives in
 * `./content-blocks/<shape>-input.tsx` and is resolved through the exhaustive
 * `BLOCK_INPUT_REGISTRY`; this component owns no block state and renders none.
 * A `null` schema — or one whose `type` falls outside `CONTENT_BLOCK_TYPES`
 * (an older/newer generator, a malformed payload) — degrades to
 * `FallbackBlock`: an honest note that there is nothing editable here, never
 * a crash and never raw JSON on screen.
 *
 * EACH SUB-COMPONENT OWNS ITS OWN SAVE. There is no shared array of state to
 * keep in sync across views the way the planner's list/board/calendar do —
 * this page shows one task at a time — so each block PATCHes
 * `contentValue` directly, the same self-contained pattern `AiCoachPanel` and
 * `EvidenceUpload` already use for `applicationId`/`recommendationId`. The
 * PATCH fallback below (`saveContentValue`) is what an input receives when
 * the caller supplies no `onSave`; canonical Micro-step detail supplies its
 * own, legacy recommendations use their existing route.
 */
export function ContentBlockInput({
  applicationId,
  recommendationId,
  schema,
  value,
  onSave,
}: {
  applicationId: string;
  recommendationId: string;
  /** `null`, or any object the caller casts as a `ContentBlock` — unknown shapes degrade to FallbackBlock. */
  schema: ContentBlock | null;
  value: ContentBlockValue | null;
  /** Canonical Micro-step detail supplies this; legacy recommendations use their existing route. */
  onSave?: (contentValue: ContentBlockValue) => Promise<boolean>;
}) {
  if (!schema || !CONTENT_BLOCK_TYPES.includes(schema.type)) {
    return <FallbackBlock />;
  }
  const BlockInput = BLOCK_INPUT_REGISTRY[schema.type];
  const save =
    onSave ?? ((contentValue: ContentBlockValue) => saveContentValue(applicationId, recommendationId, contentValue));
  // A saved value whose variant doesn't match the schema's type (possible
  // after a generator changed a block's shape) is as good as absent.
  const matchedValue = value !== null && value.type === schema.type ? value : null;
  return <BlockInput schema={schema} value={matchedValue} onSave={save} />;
}

async function saveContentValue(
  applicationId: string,
  recommendationId: string,
  contentValue: ContentBlockValue,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/applications/${applicationId}/strategy/recommendations/${recommendationId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentValue }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
